/**
 * News & Intelligence Router — 11 endpoints ported from elite-writer-app
 * Covers: news, news/fetch, news/status, gnews, mediastack, 
 *         pipeline/fetch-news, pipeline/fetch-rss, pipeline/run-all,
 *         intelligence/daily-brief, intelligence/learn, intelligence/patterns
 */
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { newsItems, intelligenceItems, intelligenceLearnings, dailyBriefs, feeds } from "../../drizzle/schema";

// ─── News API Helpers ─────────────────────────────────────

async function fetchNewsAPI(apiKey: string, query?: string, category?: string, limit = 10) {
  let url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=${limit}&apiKey=${apiKey}`;
  if (query) {
    url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=${limit}&sortBy=publishedAt&apiKey=${apiKey}`;
  } else if (category) {
    url += `&category=${category}`;
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await response.json() as any;
  if (data.status !== "ok") throw new Error(data.message || "NewsAPI request failed");

  return (data.articles || []).map((a: any) => ({
    source: "NewsAPI",
    title: a.title,
    description: a.description,
    url: a.url,
    imageUrl: a.urlToImage,
    publishedAt: a.publishedAt,
    sourceName: a.source?.name,
  }));
}

async function fetchMediaStack(apiKey: string, query?: string, category?: string, limit = 10) {
  let url = `http://api.mediastack.com/v1/news?access_key=${apiKey}&limit=${limit}&languages=en`;
  if (query) url += `&keywords=${encodeURIComponent(query)}`;
  if (category) url += `&categories=${category.toLowerCase()}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await response.json() as any;
  if (data.error) throw new Error(data.error.message || "MediaStack request failed");

  return (data.data || []).map((a: any) => ({
    source: "MediaStack",
    title: a.title,
    description: a.description,
    url: a.url,
    imageUrl: a.image,
    publishedAt: a.published_at,
    sourceName: a.source,
  }));
}

async function fetchGNews(apiKey: string, query?: string, category?: string, limit = 10) {
  let url = `https://gnews.io/api/v4/top-headlines?token=${apiKey}&max=${limit}&lang=en`;
  if (query) {
    url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&token=${apiKey}&max=${limit}&lang=en`;
  } else if (category) {
    url += `&topic=${category.toLowerCase()}`;
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await response.json() as any;
  if (data.errors) throw new Error(data.errors[0] || "GNews request failed");

  return (data.articles || []).map((a: any) => ({
    source: "GNews",
    title: a.title,
    description: a.description,
    url: a.url,
    imageUrl: a.image,
    publishedAt: a.publishedAt,
    sourceName: a.source?.name,
  }));
}

async function fetchRSSFeed(feedUrl: string, limit = 20) {
  try {
    const response = await fetch(feedUrl, { signal: AbortSignal.timeout(8000) });
    const text = await response.text();
    // Simple XML parsing for RSS items
    const items: any[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(text)) !== null && items.length < limit) {
      const xml = match[1];
      const getTag = (tag: string) => {
        const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${tag}>`, "s"));
        return m ? m[1].trim() : "";
      };
      items.push({
        source: "RSS",
        title: getTag("title"),
        description: getTag("description").slice(0, 500),
        url: getTag("link"),
        publishedAt: getTag("pubDate"),
        sourceName: feedUrl,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export const newsRouter = router({
  // POST /api/news/fetch — Fetch news from configured APIs
  fetch: protectedProcedure
    .input(z.object({
      source: z.enum(["newsapi", "mediastack", "gnews", "all"]).default("all"),
      query: z.string().optional(),
      category: z.string().optional(),
      limit: z.number().min(1).max(100).default(10),
    }))
    .mutation(async ({ input }) => {
      const { source, query, category, limit } = input;
      let articles: any[] = [];

      if (source === "newsapi" || source === "all") {
        if (ENV.newsapiKey) {
          try { articles.push(...await fetchNewsAPI(ENV.newsapiKey, query, category, limit)); } catch { /* skip */ }
        }
      }
      if (source === "mediastack" || source === "all") {
        if (ENV.mediastackKey) {
          try { articles.push(...await fetchMediaStack(ENV.mediastackKey, query, category, limit)); } catch { /* skip */ }
        }
      }
      if (source === "gnews" || source === "all") {
        if (ENV.gnewsKey) {
          try { articles.push(...await fetchGNews(ENV.gnewsKey, query, category, limit)); } catch { /* skip */ }
        }
      }

      return { success: true, articles, count: articles.length };
    }),

  // GET /api/news/status — Check which news APIs are configured
  status: publicProcedure.query(() => ({
    apis: {
      newsapi: !!ENV.newsapiKey,
      mediastack: !!ENV.mediastackKey,
      gnews: !!ENV.gnewsKey,
    },
    total: [ENV.newsapiKey, ENV.mediastackKey, ENV.gnewsKey].filter(Boolean).length,
  })),

  // Fetch and store news to DB
  fetchAndStore: protectedProcedure
    .input(z.object({
      query: z.string().optional(),
      category: z.string().optional(),
      limit: z.number().default(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Fetch from all sources
      const allArticles: any[] = [];
      if (ENV.newsapiKey) {
        try { allArticles.push(...await fetchNewsAPI(ENV.newsapiKey, input.query, input.category, input.limit)); } catch { /* skip */ }
      }
      if (ENV.gnewsKey) {
        try { allArticles.push(...await fetchGNews(ENV.gnewsKey, input.query, input.category, input.limit)); } catch { /* skip */ }
      }
      if (ENV.mediastackKey) {
        try { allArticles.push(...await fetchMediaStack(ENV.mediastackKey, input.query, input.category, input.limit)); } catch { /* skip */ }
      }

      // Store to DB
      let stored = 0;
      for (const article of allArticles) {
        try {
          await db.insert(newsItems).values({
            userId: ctx.user.id,
            title: article.title || "Untitled",
            description: article.description,
            url: article.url,
            imageUrl: article.imageUrl,
            source: article.source,
            sourceName: article.sourceName,
            category: input.category,
            publishedAt: article.publishedAt ? new Date(article.publishedAt) : undefined,
          });
          stored++;
        } catch { /* skip duplicates */ }
      }

      return { success: true, fetched: allArticles.length, stored };
    }),

  // List stored news
  list: protectedProcedure
    .input(z.object({
      limit: z.number().default(50),
      category: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      let query = db.select().from(newsItems).where(eq(newsItems.userId, ctx.user.id));
      return query.orderBy(desc(newsItems.createdAt)).limit(input.limit);
    }),

  // RSS feed fetch
  fetchRSS: protectedProcedure
    .input(z.object({
      feedUrls: z.array(z.string()),
      limit: z.number().default(20),
    }))
    .mutation(async ({ input }) => {
      const allItems: any[] = [];
      const results = await Promise.allSettled(
        input.feedUrls.map(url => fetchRSSFeed(url, input.limit))
      );
      for (const result of results) {
        if (result.status === "fulfilled") {
          allItems.push(...result.value);
        }
      }
      return { success: true, items: allItems, count: allItems.length };
    }),

  // Run full pipeline: fetch all → score sentiment → persist intelligence → generate brief
  // Gap #4: Trend-to-article automation + Gap #6: Sentiment persistence
  runPipeline: protectedProcedure
    .input(z.object({
      topics: z.array(z.string()).optional(),
      rssFeeds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();

      // Step 0: If no RSS feeds provided, auto-load from user's saved feeds or use curated defaults
      let rssFeeds = input.rssFeeds || [];
      if (rssFeeds.length === 0 && db) {
        try {
          const userFeeds = await db.select().from(feeds)
            .where(and(eq(feeds.userId, ctx.user.id), eq(feeds.active, 1)));
          rssFeeds = userFeeds.map(f => f.url).filter((u): u is string => !!u);
        } catch { /* skip */ }
      }
      // Fallback to curated defaults
      if (rssFeeds.length === 0) {
        rssFeeds = [
          'https://feeds.reuters.com/reuters/businessNews',
          'https://feeds.hbr.org/harvardbusiness',
          'https://techcrunch.com/feed/',
          'https://www.wired.com/feed/rss',
          'https://www.theverge.com/rss/index.xml',
          'https://www.fastcompany.com/latest/rss?format=xml',
          'https://www.inc.com/rss/',
          'https://rss.ap.org/article/topnews',
          'https://www.vox.com/rss/index.xml',
          'https://www.technologyreview.com/feed/',
        ];
      }

      // Step 1: Fetch news from APIs
      const articles: any[] = [];
      if (ENV.newsapiKey) {
        for (const topic of (input.topics || ["business", "technology"])) {
          try { articles.push(...await fetchNewsAPI(ENV.newsapiKey, topic, undefined, 5)); } catch { /* skip */ }
        }
      }
      if (ENV.gnewsKey) {
        for (const topic of (input.topics || ["business"])) {
          try { articles.push(...await fetchGNews(ENV.gnewsKey, topic, undefined, 5)); } catch { /* skip */ }
        }
      }

      // Step 2: Fetch RSS — now uses curated feeds automatically
      if (rssFeeds.length > 0) {
        const rssResults = await Promise.allSettled(rssFeeds.map(url => fetchRSSFeed(url, 10)));
        for (const r of rssResults) {
          if (r.status === "fulfilled") articles.push(...r.value);
        }
      }

      // Step 3: Score sentiment and viral potential for each article (Gap #6)
      const articleSummaries = articles.slice(0, 30).map((a, i) =>
        `${i + 1}. [${a.source}] ${a.title} — ${(a.description || "").slice(0, 150)}`
      ).join("\n");

      // AI-powered sentiment + relevance scoring
      let sentimentData: any = { items: [] };
      try {
        const sentimentResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a content intelligence engine. Score each news item for viral potential (1-100), sentiment (positive/negative/neutral/mixed), and relevance to freelance writing opportunities. Return ONLY valid JSON.",
            },
            {
              role: "user",
              content: `Score these articles:\n\n${articleSummaries}\n\nReturn JSON:\n{\n  "items": [\n    {\n      "index": <1-based>,\n      "viral_score": <1-100>,\n      "sentiment": "positive|negative|neutral|mixed",\n      "niche_tags": ["tag1", "tag2"],\n      "article_opportunity": "<brief pitch angle>",\n      "suggested_publications": ["pub1", "pub2"]\n    }\n  ]\n}`,
            },
          ],
          response_format: { type: "json_object" },
        });
        const sentText = sentimentResult.choices[0]?.message?.content ?? "";
        try { sentimentData = JSON.parse(sentText); } catch { /* skip */ }
      } catch { /* skip sentiment scoring if LLM fails */ }

      // Step 4: Persist scored items to intelligenceItems table (Gap #6)
      let persistedCount = 0;
      if (db && sentimentData.items) {
        for (const scored of sentimentData.items) {
          const articleIdx = (scored.index || 1) - 1;
          const article = articles[articleIdx];
          if (!article) continue;
          try {
            await db.insert(intelligenceItems).values({
              userId: ctx.user.id,
              title: article.title || "Untitled",
              summary: (article.description || "").slice(0, 500),
              source: article.source || "Unknown",
              url: article.url || "",
              category: scored.niche_tags?.[0] || article.category || "general",
              relevanceScore: scored.viral_score || 50,
              saved: false,
              metadata: {
                sentiment: scored.sentiment,
                viral_score: scored.viral_score,
                niche_tags: scored.niche_tags,
                article_opportunity: scored.article_opportunity,
                suggested_publications: scored.suggested_publications,
                source_name: article.sourceName,
                published_at: article.publishedAt,
              },
            });
            persistedCount++;
          } catch { /* skip duplicates */ }
        }
      }

      // Step 5: Generate intelligence brief
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a senior intelligence analyst producing an editorial brief for a premium freelance content team. Focus on high-viral-potential stories with clear article opportunities. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Analyze these news items and generate an intelligence brief:\n\n${articleSummaries}\n\nSentiment scores available:\n${JSON.stringify(sentimentData.items?.slice(0, 10) || [])}\n\nReturn JSON:\n{\n  "date": "${new Date().toISOString().split("T")[0]}",\n  "headline": "<main opportunity>",\n  "summary": "<3-4 sentence overview>",\n  "topStories": [{"title": "", "summary": "", "articleOpportunity": "", "suggestedAngle": "", "urgency": "high|medium|low", "sentiment": "positive|negative|neutral", "viralScore": 0}],\n  "trendingTopics": ["<topic>"],\n  "actionItems": ["<action>"],\n  "totalArticlesAnalyzed": ${articles.length},\n  "sentimentBreakdown": {"positive": 0, "negative": 0, "neutral": 0, "mixed": 0}\n}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content ?? "";
      let briefData;
      try { briefData = JSON.parse(text); } catch { briefData = { summary: text }; }

      // Store brief
      if (db) {
        await db.insert(dailyBriefs).values({
          userId: ctx.user.id,
          date: new Date().toISOString().split("T")[0],
          content: briefData,
        });
      }

      return { 
        success: true, 
        brief: briefData, 
        articlesProcessed: articles.length,
        sentimentScored: sentimentData.items?.length || 0,
        intelligencePersisted: persistedCount,
        feedsUsed: rssFeeds.length,
      };
    }),
});

// ─── Intelligence Router ──────────────────────────────────

export const intelligenceRouter = router({
  // Daily brief generation (enhanced version with news integration)
  dailyBrief: protectedProcedure
    .input(z.object({ topics: z.array(z.string()).optional() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch recent news first
      const recentNews: any[] = [];
      if (ENV.gnewsKey) {
        for (const topic of (input.topics || ["business", "technology", "finance"])) {
          try { recentNews.push(...await fetchGNews(ENV.gnewsKey, topic, undefined, 3)); } catch { /* skip */ }
        }
      }

      const newsContext = recentNews.length > 0
        ? `\n\nRecent news to incorporate:\n${recentNews.map((n, i) => `${i + 1}. ${n.title} (${n.sourceName})`).join("\n")}`
        : "";

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a senior intelligence analyst producing a daily editorial brief for a premium content team. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Generate today's intelligence brief.\n\nDate: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}\nPriority topics: ${(input.topics || ["business", "technology", "health", "finance"]).join(", ")}${newsContext}\n\nReturn JSON:\n{\n  "date": "${new Date().toISOString().split("T")[0]}",\n  "headline": "<main editorial opportunity>",\n  "summary": "<3-4 sentence overview>",\n  "topStories": [{"title": "", "summary": "", "articleOpportunity": "", "suggestedAngle": "", "urgency": "high|medium|low"}],\n  "dataReleases": ["<upcoming data>"],\n  "trendingTopics": ["<topic>"],\n  "actionItems": ["<action>"]\n}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content ?? "";
      try { return { success: true, data: JSON.parse(text), usage: result.usage }; }
      catch { return { success: true, data: { summary: text }, usage: result.usage }; }
    }),

  // Learn from articles — extract patterns
  learn: protectedProcedure
    .input(z.object({
      articleIds: z.array(z.number()).optional(),
      content: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const contentToAnalyze = input.content || "";

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a content intelligence engine. Analyze the provided content and extract patterns, topics, and writing style insights. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Analyze this content and extract patterns:\n\n${contentToAnalyze.slice(0, 6000)}\n\nReturn JSON:\n{\n  "patterns": [{"type": "topic|style|structure|audience", "pattern": "<description>", "confidence": <0.0-1.0>}],\n  "topics": ["<detected topic>"],\n  "styleAttributes": {"tone": "", "complexity": "", "targetAudience": ""},\n  "recommendations": ["<actionable recommendation>"]\n}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content ?? "";
      let data;
      try { data = JSON.parse(text); } catch { data = { patterns: [] }; }

      // Store learnings
      if (data.patterns) {
        for (const p of data.patterns) {
          await db.insert(intelligenceLearnings).values({
            userId: ctx.user.id,
            type: p.type || "general",
            pattern: p.pattern,
            confidence: String(p.confidence || 0.5),
            sourceArticleIds: input.articleIds || [],
          });
        }
      }

      return { success: true, data, usage: result.usage };
    }),

  // Get stored patterns
  patterns: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(intelligenceLearnings)
      .where(eq(intelligenceLearnings.userId, ctx.user.id))
      .orderBy(desc(intelligenceLearnings.createdAt))
      .limit(100);
  }),

  // Apply patterns to content
  applyPatterns: protectedProcedure
    .input(z.object({
      content: z.string(),
      patternIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get user's learned patterns
      const patterns = await db.select().from(intelligenceLearnings)
        .where(eq(intelligenceLearnings.userId, ctx.user.id))
        .orderBy(desc(intelligenceLearnings.createdAt))
        .limit(20);

      const patternContext = patterns.map(p => `- ${p.type}: ${p.pattern}`).join("\n");

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a content optimization engine. Apply learned patterns to improve the content. Return the improved content with explanation of changes.",
          },
          {
            role: "user",
            content: `Apply these learned patterns to improve this content:\n\nPatterns:\n${patternContext}\n\nContent:\n${input.content.slice(0, 6000)}\n\nReturn the improved content with a brief summary of what was changed and why.`,
          },
        ],
      });

      const text = result.choices[0]?.message?.content ?? "";
      return { success: true, improvedContent: text, usage: result.usage };
    }),
});
