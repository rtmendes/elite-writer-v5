/**
 * Strategy Builder & Keyword Discovery Router — Blazly-inspired
 * 
 * Features:
 * 1. Keyword Discovery — difficulty, volume, intent, trend analysis
 * 2. Strategy Builder — pillar-and-cluster content plans
 * 3. Strategy Enhancement — AI-powered strategy upgrade
 * 4. Save & Deploy — auto-generate all articles from strategy
 * 5. Bulk Generator — CSV-based batch article generation
 * 6. Blog Idea Generation from saved keywords
 */
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import {
  contentStrategies, keywordResearch,
  type InsertContentStrategy, type InsertKeywordResearchItem,
} from "../../drizzle/schema";

export const strategyRouter = router({
  // ═══════════════════════════════════════════════════════════
  // KEYWORD DISCOVERY
  // ═══════════════════════════════════════════════════════════

  keywords: router({
    // ─── Discover Keywords ────────────────────────────────────
    discover: protectedProcedure
      .input(z.object({
        topic: z.string().min(1),
        count: z.number().default(20),
        includeAIVisibility: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        // Use Brave Search for real keyword context
        let searchContext = "";
        if (ENV.braveApiKey) {
          try {
            const resp = await fetch(
              `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(input.topic)}&count=10`,
              {
                headers: { "X-Subscription-Token": ENV.braveApiKey, Accept: "application/json" },
                signal: AbortSignal.timeout(10000),
              }
            );
            if (resp.ok) {
              const data = await resp.json() as any;
              searchContext = (data.web?.results || [])
                .map((r: any) => `${r.title}: ${r.description}`)
                .join("\n");
            }
          } catch { /* continue */ }
        }

        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert SEO keyword researcher. Discover ${input.count} keywords related to the topic.

${searchContext ? `Current search landscape:\n${searchContext}\n` : ""}

For each keyword provide realistic estimates:
- Keyword Difficulty (0-100)
- Monthly Search Volume (estimated)
- CPC (estimated cost per click)
- Trend (rising, stable, declining)
- Search Intent (informational, navigational, commercial, transactional)
${input.includeAIVisibility ? "- AI Visibility (whether AI models mention this topic, competition level in AI responses)" : ""}

Return JSON:
{
  "keywords": [
    {
      "keyword": "...",
      "difficulty": 0-100,
      "volume": N,
      "cpc": 0.00,
      "trend": "rising|stable|declining",
      "intent": "informational|navigational|commercial|transactional",
      "related": ["related1", "related2"],
      ${input.includeAIVisibility ? '"ai_visibility": { "mentioned_in_chatgpt": true/false, "mentioned_in_gemini": true/false, "ai_competition": "low|medium|high" },' : ""}
      "blog_ideas": ["blog title idea 1", "blog title idea 2"]
    }
  ],
  "topic_overview": "brief overview of the keyword landscape",
  "recommended_strategy": "which keywords to target first and why"
}`,
            },
            {
              role: "user",
              content: `Discover keywords for: "${input.topic}"`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.4,
        });

        const text = result.choices[0]?.message?.content || "{}";
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { keywords: [], error: "Failed to parse keyword data" };
        }

        // Save keywords to DB
        const db = await getDb();
        if (db && parsed.keywords?.length) {
          const values: InsertKeywordResearchItem[] = parsed.keywords.map((kw: any) => ({
            userId: ctx.user.id,
            keyword: kw.keyword,
            difficulty: kw.difficulty || null,
            volume: kw.volume || null,
            cpc: kw.cpc?.toString() || null,
            trend: kw.trend || null,
            intent: kw.intent || null,
            relatedKeywords: kw.related || [],
            aiVisibility: kw.ai_visibility || null,
            blogIdeas: kw.blog_ideas || [],
          }));
          await db.insert(keywordResearch).values(values);
        }

        return parsed;
      }),

    // ─── List Saved Keywords ──────────────────────────────────
    list: protectedProcedure
      .input(z.object({
        saved: z.boolean().optional(),
        intent: z.string().optional(),
        limit: z.number().default(100),
      }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const conditions: any[] = [eq(keywordResearch.userId, ctx.user.id)];
        if (input.saved) conditions.push(eq(keywordResearch.saved, 1));
        if (input.intent) conditions.push(eq(keywordResearch.intent, input.intent as any));
        return db.select().from(keywordResearch)
          .where(and(...conditions))
          .orderBy(desc(keywordResearch.createdAt))
          .limit(input.limit);
      }),

    // ─── Toggle Save Keyword ──────────────────────────────────
    toggleSave: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const [item] = await db.select().from(keywordResearch)
          .where(and(eq(keywordResearch.id, input.id), eq(keywordResearch.userId, ctx.user.id)));
        if (!item) throw new Error("Keyword not found");
        await db.update(keywordResearch)
          .set({ saved: item.saved ? 0 : 1 })
          .where(eq(keywordResearch.id, input.id));
        return { saved: !item.saved };
      }),

    // ─── Generate Blog Ideas for Keyword ──────────────────────
    generateIdeas: protectedProcedure
      .input(z.object({
        keywordId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const [kw] = await db.select().from(keywordResearch)
          .where(and(eq(keywordResearch.id, input.keywordId), eq(keywordResearch.userId, ctx.user.id)));
        if (!kw) throw new Error("Keyword not found");

        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Generate 10 unique, compelling blog title ideas for the keyword "${kw.keyword}".

Consider:
- Search intent: ${kw.intent || "mixed"}
- Difficulty: ${kw.difficulty || "unknown"}/100
- Volume: ${kw.volume || "unknown"}

Titles should:
- Be click-worthy but not clickbait
- Include the target keyword naturally
- Vary in format (how-to, listicle, comparison, guide, case study)
- Target different stages of the buyer journey

Return JSON:
{
  "ideas": [
    { "title": "...", "format": "how-to|listicle|comparison|guide|case_study|opinion", "estimated_difficulty": "easy|medium|hard" }
  ]
}`,
            },
            {
              role: "user",
              content: `Generate blog ideas for: "${kw.keyword}"`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.8,
        });

        const text = result.choices[0]?.message?.content || "{}";
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { ideas: [] };
        }

        // Update keyword with blog ideas
        const titles = (parsed.ideas || []).map((i: any) => i.title);
        await db.update(keywordResearch)
          .set({ blogIdeas: titles })
          .where(eq(keywordResearch.id, input.keywordId));

        return parsed;
      }),

    // ─── Delete Keyword ───────────────────────────────────────
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        await db.delete(keywordResearch).where(
          and(eq(keywordResearch.id, input.id), eq(keywordResearch.userId, ctx.user.id))
        );
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════
  // STRATEGY BUILDER
  // ═══════════════════════════════════════════════════════════

  strategies: router({
    // ─── List Strategies ──────────────────────────────────────
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(contentStrategies)
        .where(eq(contentStrategies.userId, ctx.user.id))
        .orderBy(desc(contentStrategies.updatedAt));
    }),

    // ─── Create Strategy (pillar + clusters) ──────────────────
    create: protectedProcedure
      .input(z.object({
        primaryKeyword: z.string().min(1),
        brandId: z.number().optional(),
        name: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Create a comprehensive pillar-and-cluster content strategy for "${input.primaryKeyword}".

A pillar-cluster strategy organizes content around a central topic (pillar) with related subtopics (clusters).
This improves topical authority, internal linking, and visibility in both search and AI engines.

Return JSON:
{
  "pillarTopic": "title of the main pillar article",
  "pillarOutline": "3-4 sentence description of what the pillar covers",
  "clusters": [
    {
      "keyword": "cluster keyword",
      "title": "blog post title",
      "status": "planned",
      "difficulty": 0-100,
      "volume": N,
      "intent": "informational|commercial|transactional"
    }
  ],
  "strategy_name": "short name for this strategy",
  "estimated_total_words": N,
  "competition_level": "low|medium|high",
  "estimated_time_to_rank": "3-6 months",
  "internal_linking_plan": "description of how pieces connect"
}`,
            },
            {
              role: "user",
              content: `Build pillar-cluster strategy for: "${input.primaryKeyword}"`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.5,
        });

        const text = result.choices[0]?.message?.content || "{}";
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error("Failed to generate strategy");
        }

        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const [inserted] = await db.insert(contentStrategies).values({
          userId: ctx.user.id,
          brandId: input.brandId || null,
          name: input.name || parsed.strategy_name || `Strategy: ${input.primaryKeyword}`,
          primaryKeyword: input.primaryKeyword,
          pillarTopic: parsed.pillarTopic || null,
          pillarContent: parsed.pillarOutline || null,
          clusters: parsed.clusters || [],
          totalArticles: (parsed.clusters?.length || 0) + 1, // clusters + pillar
          status: "draft",
          metadata: {
            competition_level: parsed.competition_level,
            estimated_traffic: parsed.estimated_total_words,
            content_gap_analysis: parsed.internal_linking_plan,
          },
        }).returning({ id: contentStrategies.id });

        return { id: inserted.id, ...parsed };
      }),

    // ─── Enhance Strategy ─────────────────────────────────────
    enhance: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const [strategy] = await db.select().from(contentStrategies)
          .where(and(eq(contentStrategies.id, input.id), eq(contentStrategies.userId, ctx.user.id)));

        if (!strategy) throw new Error("Strategy not found");

        const currentClusters = (strategy.clusters as any[]) || [];

        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Enhance an existing content strategy with more in-depth topics and actionable SEO tasks.

Current strategy:
- Pillar: ${strategy.pillarTopic}
- Primary keyword: ${strategy.primaryKeyword}
- Current clusters: ${currentClusters.map(c => c.title).join(", ")}

Enhancement requirements:
1. Add 5-8 more cluster topics to fill content gaps
2. Add specific actionable SEO tasks for each cluster
3. Suggest internal linking structure
4. Identify quick-win opportunities
5. Add long-tail keyword variations

Return JSON:
{
  "additional_clusters": [
    {
      "keyword": "...",
      "title": "...",
      "status": "planned",
      "difficulty": 0-100,
      "volume": N,
      "intent": "...",
      "seo_tasks": ["task1", "task2"]
    }
  ],
  "internal_linking_map": { "pillar": ["cluster1", "cluster2"], "cluster1": ["cluster3"] },
  "quick_wins": ["quick win 1", "quick win 2"],
  "content_gaps_filled": ["gap1", "gap2"],
  "estimated_ranking_boost": "description of expected improvement"
}`,
            },
            {
              role: "user",
              content: `Enhance this content strategy for "${strategy.primaryKeyword}"`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.5,
        });

        const text = result.choices[0]?.message?.content || "{}";
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error("Failed to enhance strategy");
        }

        // Merge new clusters with existing
        const enhancedClusters = [
          ...currentClusters,
          ...(parsed.additional_clusters || []),
        ];

        await db.update(contentStrategies).set({
          clusters: enhancedClusters,
          enhanced: 1,
          totalArticles: enhancedClusters.length + 1,
          metadata: {
            ...(strategy.metadata as any || {}),
            content_gap_analysis: parsed.content_gaps_filled?.join("; ") || "",
            quick_wins: parsed.quick_wins,
            linking_map: parsed.internal_linking_map,
          },
        }).where(eq(contentStrategies.id, input.id));

        return { ...parsed, totalClusters: enhancedClusters.length };
      }),

    // ─── Execute Strategy (generate all articles) ─────────────
    execute: protectedProcedure
      .input(z.object({
        id: z.number(),
        clusterIndex: z.number().optional(), // Generate single cluster article, or all if omitted
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");

        const [strategy] = await db.select().from(contentStrategies)
          .where(and(eq(contentStrategies.id, input.id), eq(contentStrategies.userId, ctx.user.id)));

        if (!strategy) throw new Error("Strategy not found");

        const clusters = (strategy.clusters as any[]) || [];
        const targetClusters = input.clusterIndex !== undefined
          ? [clusters[input.clusterIndex]]
          : clusters.filter(c => c.status === "planned");

        if (targetClusters.length === 0) {
          return { message: "No planned articles to generate" };
        }

        // Generate content for each cluster (limited to 3 at a time)
        const results: any[] = [];
        for (const cluster of targetClusters.slice(0, 3)) {
          if (!cluster) continue;

          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `Generate a complete, SEO-optimized blog article for the topic: "${cluster.title}"

Part of pillar strategy: "${strategy.pillarTopic}" (keyword: "${strategy.primaryKeyword}")
Target keyword: "${cluster.keyword}"
Intent: ${cluster.intent || "informational"}

Requirements:
- 1200-2000 words
- SEO optimized for the target keyword
- GEO/AEO optimized (structured for AI citation)
- Include FAQ section
- Markdown format
- Link opportunities back to pillar topic

Return JSON:
{
  "title": "final article title",
  "content": "full article in markdown",
  "meta_description": "max 160 chars",
  "word_count": N,
  "headings": ["H2: ...", "H3: ..."],
  "faq": [{ "q": "...", "a": "..." }]
}`,
              },
              {
                role: "user",
                content: `Write the article: "${cluster.title}"`,
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.6,
          });

          const text = result.choices[0]?.message?.content || "{}";
          try {
            results.push({ cluster: cluster.keyword, ...JSON.parse(text) });
          } catch {
            results.push({ cluster: cluster.keyword, error: "Failed to generate" });
          }
        }

        // Update strategy status
        await db.update(contentStrategies).set({
          status: "executing",
        }).where(eq(contentStrategies.id, input.id));

        return { generated: results.length, articles: results };
      }),

    // ─── Update Strategy ──────────────────────────────────────
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        status: z.enum(["draft", "active", "executing", "completed"]).optional(),
        clusters: z.array(z.any()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const { id, ...updates } = input;
        await db.update(contentStrategies).set(updates)
          .where(and(eq(contentStrategies.id, id), eq(contentStrategies.userId, ctx.user.id)));
        return { success: true };
      }),

    // ─── Delete Strategy ──────────────────────────────────────
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        await db.delete(contentStrategies).where(
          and(eq(contentStrategies.id, input.id), eq(contentStrategies.userId, ctx.user.id))
        );
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════
  // BULK GENERATOR
  // ═══════════════════════════════════════════════════════════

  bulkGenerate: protectedProcedure
    .input(z.object({
      articles: z.array(z.object({
        title: z.string(),
        primaryKeyword: z.string(),
        secondaryKeywords: z.array(z.string()).optional(),
      })),
      tone: z.string().default("professional"),
      wordCount: z.number().default(1500),
    }))
    .mutation(async ({ input }) => {
      const results: any[] = [];

      for (const article of input.articles.slice(0, 5)) { // Limit to 5 per batch
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `Generate a complete, SEO-optimized article.
Title: "${article.title}"
Primary keyword: "${article.primaryKeyword}"
${article.secondaryKeywords?.length ? `Secondary keywords: ${article.secondaryKeywords.join(", ")}` : ""}
Tone: ${input.tone}
Target: ~${input.wordCount} words

Return JSON:
{
  "title": "...",
  "content": "full article in markdown",
  "meta_description": "max 160 chars",
  "word_count": N
}`,
            },
            {
              role: "user",
              content: `Write: "${article.title}"`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.6,
        });

        const text = result.choices[0]?.message?.content || "{}";
        try {
          results.push({ input: article, ...JSON.parse(text) });
        } catch {
          results.push({ input: article, error: "Failed to generate" });
        }
      }

      return { generated: results.length, total: input.articles.length, articles: results };
    }),
});
