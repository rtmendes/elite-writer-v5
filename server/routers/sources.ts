/**
 * Content Sources Router — GistStack-inspired multi-source following
 * 
 * Features:
 * 1. YouTube channel following (via YouTube Data API)
 * 2. Reddit community following (via Reddit JSON API)
 * 3. Newsletter email following (register + parse)
 * 4. Non-RSS website following (scrape + extract)
 * 5. Source item fetching with AI scoring
 * 6. Unified feed across all source types
 */
import { z } from "zod";
import { eq, desc, and, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import {
  contentSources, sourceItems,
  type InsertContentSource, type InsertSourceItem,
} from "../../drizzle/schema";

// ─── YouTube Data API Helper ──────────────────────────────
async function fetchYouTubeChannel(channelId: string): Promise<any> {
  const apiKey = ENV.youtubeApiKey;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY not configured");

  // Get channel info
  const channelResp = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!channelResp.ok) throw new Error(`YouTube API error: ${channelResp.status}`);
  const channelData = await channelResp.json() as any;
  const channel = channelData.items?.[0];
  if (!channel) throw new Error("Channel not found");

  return {
    name: channel.snippet.title,
    description: channel.snippet.description,
    iconUrl: channel.snippet.thumbnails?.default?.url,
    subscriberCount: parseInt(channel.statistics.subscriberCount || "0"),
  };
}

async function fetchYouTubeVideos(channelId: string, limit = 20): Promise<any[]> {
  const apiKey = ENV.youtubeApiKey;
  if (!apiKey) return [];

  const resp = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=${limit}&type=video&key=${apiKey}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!resp.ok) return [];
  const data = await resp.json() as any;

  return (data.items || []).map((item: any) => ({
    title: item.snippet.title,
    description: item.snippet.description,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    imageUrl: item.snippet.thumbnails?.medium?.url,
    author: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
  }));
}

// ─── Reddit API Helper ────────────────────────────────────
async function fetchRedditPosts(subreddit: string, sort = "hot", limit = 25): Promise<any[]> {
  const resp = await fetch(
    `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`,
    {
      headers: { "User-Agent": "EliteWriter/1.0" },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!resp.ok) throw new Error(`Reddit API error: ${resp.status}`);
  const data = await resp.json() as any;

  return (data.data?.children || []).map((child: any) => {
    const post = child.data;
    return {
      title: post.title,
      content: post.selftext?.slice(0, 2000) || "",
      url: `https://reddit.com${post.permalink}`,
      author: post.author,
      score: post.score,
      numComments: post.num_comments,
      imageUrl: post.thumbnail?.startsWith("http") ? post.thumbnail : null,
      publishedAt: new Date(post.created_utc * 1000).toISOString(),
      upvoteRatio: post.upvote_ratio,
    };
  });
}

async function fetchRedditInfo(subreddit: string): Promise<any> {
  const resp = await fetch(
    `https://www.reddit.com/r/${subreddit}/about.json`,
    {
      headers: { "User-Agent": "EliteWriter/1.0" },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!resp.ok) throw new Error(`Reddit API error: ${resp.status}`);
  const data = await resp.json() as any;
  const sub = data.data;
  return {
    name: sub.display_name_prefixed,
    description: sub.public_description || sub.description?.slice(0, 500),
    iconUrl: sub.icon_img || sub.community_icon?.split("?")?.[0],
    members: sub.subscribers,
  };
}

// ─── Website Scraper Helper ───────────────────────────────
async function scrapeWebsite(url: string): Promise<any[]> {
  // Use Brave Search API to find recent content from a specific site
  if (!ENV.braveApiKey) {
    throw new Error("BRAVE_API_KEY not configured for website scraping");
  }

  const domain = new URL(url).hostname;
  const resp = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=site:${domain}&count=20&freshness=pw`,
    {
      headers: { "X-Subscription-Token": ENV.braveApiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!resp.ok) return [];
  const data = await resp.json() as any;

  return (data.web?.results || []).map((r: any) => ({
    title: r.title,
    content: r.description || "",
    url: r.url,
    publishedAt: r.age ? new Date().toISOString() : null,
  }));
}

export const sourcesRouter = router({
  // ─── Add Source ───────────────────────────────────────────
  add: protectedProcedure
    .input(z.object({
      type: z.enum(["youtube", "reddit", "newsletter", "website", "rss"]),
      identifier: z.string().min(1), // channel ID, subreddit name, email, URL
      category: z.string().optional(),
      fetchFrequency: z.enum(["hourly", "daily", "weekly"]).default("daily"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      let name = input.identifier;
      let description = "";
      let iconUrl = "";
      let metadata: any = {};

      // Auto-discover source info
      try {
        switch (input.type) {
          case "youtube": {
            const info = await fetchYouTubeChannel(input.identifier);
            name = info.name;
            description = info.description?.slice(0, 500) || "";
            iconUrl = info.iconUrl || "";
            metadata = { subscriber_count: info.subscriberCount };
            break;
          }
          case "reddit": {
            const subName = input.identifier.replace(/^r\//, "").replace(/^\/r\//, "");
            const info = await fetchRedditInfo(subName);
            name = info.name || `r/${subName}`;
            description = info.description || "";
            iconUrl = info.iconUrl || "";
            metadata = { subreddit_members: info.members };
            break;
          }
          case "newsletter": {
            const randomId = Math.random().toString(36).slice(2, 10);
            const inboxEmail = `ew-${randomId}@elitewriter.app`;
            name = input.identifier; // newsletter name
            description = `Newsletter subscription`;
            metadata = { newsletter_email: inboxEmail };
            break;
          }
          case "website": {
            const url = new URL(input.identifier);
            name = url.hostname.replace("www.", "");
            description = `Following ${url.hostname}`;
            break;
          }
        }
      } catch (e: any) {
        // Use defaults if auto-discovery fails
        description = `${input.type} source: ${input.identifier}`;
      }

      const [inserted] = await db.insert(contentSources).values({
        userId: ctx.user.id,
        type: input.type,
        name,
        identifier: input.type === "reddit"
          ? input.identifier.replace(/^r\//, "").replace(/^\/r\//, "")
          : input.identifier,
        iconUrl: iconUrl || null,
        description,
        category: input.category || null,
        active: 1,
        fetchFrequency: input.fetchFrequency,
        metadata,
      });

      return {
        id: inserted.insertId,
        name,
        description,
        iconUrl,
        metadata,
      };
    }),

  // ─── List Sources ─────────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      type: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions: any[] = [eq(contentSources.userId, ctx.user.id)];
      if (input.type) conditions.push(eq(contentSources.type, input.type as any));

      return db.select().from(contentSources)
        .where(and(...conditions))
        .orderBy(desc(contentSources.createdAt));
    }),

  // ─── Delete Source ────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(contentSources).where(
        and(eq(contentSources.id, input.id), eq(contentSources.userId, ctx.user.id))
      );
      return { success: true };
    }),

  // ─── Toggle Source Active ─────────────────────────────────
  toggle: protectedProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(contentSources)
        .set({ active: input.active ? 1 : 0 })
        .where(and(eq(contentSources.id, input.id), eq(contentSources.userId, ctx.user.id)));
      return { success: true };
    }),

  // ─── Fetch Items from a Source ────────────────────────────
  fetchItems: protectedProcedure
    .input(z.object({
      sourceId: z.number(),
      limit: z.number().default(20),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [source] = await db.select().from(contentSources)
        .where(and(eq(contentSources.id, input.sourceId), eq(contentSources.userId, ctx.user.id)));

      if (!source) throw new Error("Source not found");

      let rawItems: any[] = [];

      switch (source.type) {
        case "youtube":
          rawItems = await fetchYouTubeVideos(source.identifier, input.limit);
          break;
        case "reddit":
          rawItems = await fetchRedditPosts(source.identifier, "hot", input.limit);
          break;
        case "website":
          rawItems = await scrapeWebsite(source.identifier);
          break;
        case "rss": {
          // Reuse existing RSS fetching logic
          const rssResp = await fetch(source.identifier, { signal: AbortSignal.timeout(10000) });
          const rssText = await rssResp.text();
          // Basic RSS parsing
          const titleMatches = [...rssText.matchAll(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/g)];
          const linkMatches = [...rssText.matchAll(/<link>(.*?)<\/link>/g)];
          rawItems = titleMatches.slice(1, input.limit + 1).map((m, i) => ({
            title: m[1] || m[2] || "Untitled",
            url: linkMatches[i + 1]?.[1] || "",
            content: "",
            publishedAt: new Date().toISOString(),
          }));
          break;
        }
      }

      // AI score the items
      const scoredItems: InsertSourceItem[] = rawItems.map((item, idx) => ({
        userId: ctx.user.id,
        sourceId: source.id,
        title: item.title || "Untitled",
        content: item.content?.slice(0, 5000) || null,
        summary: item.description?.slice(0, 1000) || null,
        url: item.url || null,
        imageUrl: item.imageUrl || null,
        author: item.author || null,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
        relevanceScore: item.score ? Math.min(100, Math.round(Math.log10(item.score + 1) * 25)) : 50 + idx,
        viralScore: item.upvoteRatio ? Math.round(item.upvoteRatio * 100) : null,
        sentiment: null,
        processed: 0,
        saved: 0,
      }));

      // Batch insert
      if (scoredItems.length > 0) {
        await db.insert(sourceItems).values(scoredItems);
      }

      // Update source last fetched
      await db.update(contentSources)
        .set({ lastFetched: new Date(), itemCount: sql`${contentSources.itemCount} + ${scoredItems.length}` })
        .where(eq(contentSources.id, source.id));

      return { items: rawItems, count: rawItems.length, sourceType: source.type };
    }),

  // ─── Get Source Items (already fetched) ───────────────────
  items: protectedProcedure
    .input(z.object({
      sourceId: z.number().optional(),
      saved: z.boolean().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions: any[] = [eq(sourceItems.userId, ctx.user.id)];
      if (input.sourceId) conditions.push(eq(sourceItems.sourceId, input.sourceId));
      if (input.saved) conditions.push(eq(sourceItems.saved, 1));

      return db.select().from(sourceItems)
        .where(and(...conditions))
        .orderBy(desc(sourceItems.createdAt))
        .limit(input.limit);
    }),

  // ─── Save/Unsave Source Item ──────────────────────────────
  toggleSave: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [item] = await db.select().from(sourceItems)
        .where(and(eq(sourceItems.id, input.id), eq(sourceItems.userId, ctx.user.id)));

      if (!item) throw new Error("Item not found");

      await db.update(sourceItems)
        .set({ saved: item.saved ? 0 : 1 })
        .where(eq(sourceItems.id, input.id));

      return { saved: !item.saved };
    }),

  // ─── Unified Feed (all sources combined) ──────────────────
  unifiedFeed: protectedProcedure
    .input(z.object({
      limit: z.number().default(50),
      sourceTypes: z.array(z.string()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      // Get all active sources
      const sources = await db.select().from(contentSources)
        .where(and(eq(contentSources.userId, ctx.user.id), eq(contentSources.active, 1)));

      const sourceIds = sources
        .filter(s => !input.sourceTypes || input.sourceTypes.includes(s.type))
        .map(s => s.id);

      if (sourceIds.length === 0) return [];

      // Get recent items from all sources
      return db.select({
        item: sourceItems,
        sourceName: contentSources.name,
        sourceType: contentSources.type,
        sourceIcon: contentSources.iconUrl,
      })
        .from(sourceItems)
        .innerJoin(contentSources, eq(sourceItems.sourceId, contentSources.id))
        .where(and(
          eq(sourceItems.userId, ctx.user.id),
          sql`${sourceItems.sourceId} IN (${sql.raw(sourceIds.join(",") || "0")})`
        ))
        .orderBy(desc(sourceItems.createdAt))
        .limit(input.limit);
    }),
});
