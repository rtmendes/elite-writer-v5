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
import { createHash } from "crypto";
import { eq, desc, and, sql, inArray, lt } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM, TIER } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import {
  contentSources, sourceItems, feedSeen,
  type InsertContentSource, type InsertSourceItem,
} from "../../drizzle/schema";

// ─── YouTube Data API Helper ──────────────────────────────
// Resolve whatever the operator pastes — channel URL, @handle, /c/ or /user/
// vanity URL, bare handle, or a raw UC… id — to a canonical channel ID, so the
// stored identifier always works with the videos endpoint.
async function resolveYouTubeChannelId(raw: string): Promise<string> {
  const apiKey = ENV.youtubeApiKey;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY not configured");
  const input = raw.trim();

  // 1. Already a channel ID
  if (/^UC[\w-]{20,}$/.test(input)) return input;

  // 2. Pull pieces out of a URL if present
  let handle = "";
  let username = "";
  let searchTerm = input.replace(/^@/, "");
  const urlMatch = input.match(/youtube\.com\/(channel\/(UC[\w-]+)|@([\w.-]+)|c\/([\w.-]+)|user\/([\w.-]+))/i);
  if (urlMatch) {
    if (urlMatch[2]) return urlMatch[2];        // /channel/UC...
    if (urlMatch[3]) handle = urlMatch[3];      // /@handle
    if (urlMatch[4]) searchTerm = urlMatch[4];  // /c/name
    if (urlMatch[5]) username = urlMatch[5];    // /user/name
  } else if (input.startsWith("@")) {
    handle = input.slice(1);
  }

  const lookups: string[] = [];
  if (handle) lookups.push(`forHandle=@${encodeURIComponent(handle)}`);
  if (username) lookups.push(`forUsername=${encodeURIComponent(username)}`);
  for (const q of lookups) {
    const resp = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=id&${q}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (resp.ok) {
      const data = (await resp.json()) as any;
      const id = data.items?.[0]?.id;
      if (id) return id;
    }
  }

  // 3. Last resort — search by name and take the top channel hit
  const searchResp = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(searchTerm)}&key=${apiKey}`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (searchResp.ok) {
    const data = (await searchResp.json()) as any;
    const id = data.items?.[0]?.id?.channelId;
    if (id) return id;
  }
  throw new Error(`Could not resolve a YouTube channel from "${raw}"`);
}

async function fetchYouTubeChannel(channelIdOrUrl: string): Promise<any> {
  const apiKey = ENV.youtubeApiKey;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY not configured");

  const channelId = await resolveYouTubeChannelId(channelIdOrUrl);

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
    channelId,
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

// ─── Ingest pipeline: dedup → screen → store-actionable-only ───────────────
// The architecture that keeps storage bounded: a fetched URL is screened once
// (feed_seen ledger), only items that clear the relevance bar are stored, and
// unsaved/unprocessed items are purged after RETAIN_DAYS. Shared by the manual
// "pull" button and the daily 4am-ET proactive refresh job.
const SCREEN_MIN = Number(process.env.SOURCE_MIN_RELEVANCE ?? 6);
const RETAIN_DAYS = Number(process.env.SOURCE_RETAIN_DAYS ?? 14);
const SEEN_RETAIN_DAYS = 30;
const sha1 = (s: string) => createHash("sha1").update(s).digest("hex");

let feedSeenEnsured = false;
async function ensureFeedSeenTable(db: any) {
  if (feedSeenEnsured) return;
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`feed_seen\` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    sourceId INT NOT NULL,
    urlHash VARCHAR(40) NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_feed_seen (userId, urlHash),
    INDEX idx_feed_seen_created (createdAt)
  )`));
  feedSeenEnsured = true;
}

async function fetchRawForSource(source: any, limit: number): Promise<any[]> {
  switch (source.type) {
    case "youtube": return fetchYouTubeVideos(source.identifier, limit);
    case "reddit": return fetchRedditPosts(source.identifier, "hot", limit);
    case "website": return scrapeWebsite(source.identifier);
    case "rss": {
      const rssResp = await fetch(source.identifier, { signal: AbortSignal.timeout(10000) });
      const rssText = await rssResp.text();
      const titleMatches = [...rssText.matchAll(/<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/g)];
      const linkMatches = [...rssText.matchAll(/<link>(.*?)<\/link>/g)];
      return titleMatches.slice(1, limit + 1).map((m, i) => ({
        title: m[1] || m[2] || "Untitled",
        url: linkMatches[i + 1]?.[1] || "",
        content: "",
        publishedAt: new Date().toISOString(),
      }));
    }
    default: return [];
  }
}

// One free-model pass scores the new items against the operator's beats; only
// the actionable ones are kept. Resilient: on any failure, keep nothing rather
// than store noise (the items stay in feed_seen so they're not re-screened).
async function screenItems(items: any[], beats: string): Promise<Map<number, { score: number; beat: string }>> {
  const keep = new Map<number, { score: number; beat: string }>();
  if (items.length === 0) return keep;
  const list = items.map((it, i) => `${i}. ${String(it.title || "").slice(0, 160)}${it.content || it.description ? ` — ${String(it.content || it.description).slice(0, 160)}` : ""}`).join("\n");
  try {
    const res = await invokeLLM({
      model: TIER.free,
      maxTokens: 1500,
      messages: [
        { role: "system", content: "You screen raw feed items for a freelance writer. Keep only items that could plausibly seed a pitch or article for these beats. Be strict — most feed items are noise. Return STRICT JSON only." },
        { role: "user", content: `BEATS: ${beats}\n\nFEED ITEMS:\n${list}\n\nReturn STRICT JSON array, one object per RELEVANT item only (drop the rest): [{"index": <n>, "score": <1-10 relevance>, "beat": "<matching beat>"}]` },
      ],
    });
    const txt = res.choices?.[0]?.message?.content ?? "";
    const m = txt.match(/\[[\s\S]*\]/);
    if (m) {
      for (const row of JSON.parse(m[0])) {
        const idx = Number(row.index);
        const score = Number(row.score) || 0;
        if (Number.isInteger(idx) && idx >= 0 && idx < items.length && score >= SCREEN_MIN) {
          keep.set(idx, { score, beat: String(row.beat || "").slice(0, 80) });
        }
      }
    }
  } catch (err) {
    console.warn("[feed] screening failed — keeping nothing this pass:", err instanceof Error ? err.message : err);
  }
  return keep;
}

/** Fetch a source, dedup against feed_seen, screen the new items, store only the
 *  actionable ones. Returns counts. The core of the bounded-storage design. */
export async function ingestSource(db: any, source: any, limit: number, beats: string): Promise<{ fetched: number; fresh: number; kept: number }> {
  await ensureFeedSeenTable(db);
  const raw = (await fetchRawForSource(source, limit)).filter((it) => it.url);
  if (raw.length === 0) return { fetched: 0, fresh: 0, kept: 0 };

  const hashes = raw.map((it) => sha1(it.url));
  const existing = await db.select({ urlHash: feedSeen.urlHash }).from(feedSeen)
    .where(and(eq(feedSeen.userId, source.userId), inArray(feedSeen.urlHash, hashes)));
  const seen = new Set(existing.map((r: any) => r.urlHash));
  const fresh = raw.filter((_, i) => !seen.has(hashes[i]));
  if (fresh.length === 0) return { fetched: raw.length, fresh: 0, kept: 0 };

  const keep = await screenItems(fresh, beats);

  // Record every fresh URL as seen (kept or not) so we never re-screen it.
  await db.insert(feedSeen).values(fresh.map((it) => ({ userId: source.userId, sourceId: source.id, urlHash: sha1(it.url) }))).onDuplicateKeyUpdate({ set: { sourceId: source.id } });

  const toStore: InsertSourceItem[] = [];
  fresh.forEach((item, i) => {
    const decision = keep.get(i);
    if (!decision) return;
    toStore.push({
      userId: source.userId,
      sourceId: source.id,
      title: item.title || "Untitled",
      content: item.content?.slice(0, 5000) || null,
      summary: item.description?.slice(0, 1000) || null,
      url: item.url || null,
      imageUrl: item.imageUrl || null,
      author: item.author || null,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
      relevanceScore: decision.score * 10,
      viralScore: item.upvoteRatio ? Math.round(item.upvoteRatio * 100) : null,
      sentiment: null,
      keyInsights: decision.beat ? [decision.beat] : null,
      processed: 0,
      saved: 0,
    });
  });
  if (toStore.length > 0) await db.insert(sourceItems).values(toStore);

  await db.update(contentSources)
    .set({ lastFetched: new Date(), itemCount: sql`${contentSources.itemCount} + ${toStore.length}` })
    .where(eq(contentSources.id, source.id));

  return { fetched: raw.length, fresh: fresh.length, kept: toStore.length };
}

/** Retention: drop unsaved/unprocessed items after RETAIN_DAYS, and old dedup
 *  ledger rows after 30d. Keeps storage tracking actionable items, not volume. */
export async function purgeOldFeedData(db: any): Promise<{ items: number; seen: number }> {
  await ensureFeedSeenTable(db);
  const itemCut = new Date(Date.now() - RETAIN_DAYS * 86400e3);
  const seenCut = new Date(Date.now() - SEEN_RETAIN_DAYS * 86400e3);
  const delItems: any = await db.delete(sourceItems)
    .where(and(eq(sourceItems.saved, 0), eq(sourceItems.processed, 0), lt(sourceItems.createdAt, itemCut)));
  const delSeen: any = await db.delete(feedSeen).where(lt(feedSeen.createdAt, seenCut));
  return { items: delItems?.[0]?.affectedRows ?? 0, seen: delSeen?.[0]?.affectedRows ?? 0 };
}

/** Refresh every active source for every user (4am-ET daily job entrypoint). */
export async function refreshAllActiveSources(beats: string, perSource = 20): Promise<{ sources: number; kept: number }> {
  const db = await getDb();
  if (!db) return { sources: 0, kept: 0 };
  const active = await db.select().from(contentSources).where(eq(contentSources.active, 1));
  let kept = 0;
  for (const source of active) {
    try {
      const r = await ingestSource(db, source, perSource, beats);
      kept += r.kept;
    } catch (err) {
      console.warn(`[feed] refresh failed for source ${source.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return { sources: active.length, kept };
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
      let resolvedIdentifier = input.identifier; // youtube: replaced with canonical UC… id

      // Auto-discover source info
      try {
        switch (input.type) {
          case "youtube": {
            const info = await fetchYouTubeChannel(input.identifier);
            name = info.name;
            description = info.description?.slice(0, 500) || "";
            iconUrl = info.iconUrl || "";
            metadata = { subscriber_count: info.subscriberCount };
            resolvedIdentifier = info.channelId; // store canonical UC… id, not the pasted URL/handle
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
        // YouTube is useless without a resolved channel ID — fail loudly so the
        // operator can fix the URL/handle instead of getting a dead source.
        if (input.type === "youtube") throw new Error(`Couldn't add YouTube channel: ${e?.message || "channel not found"}`);
        // Other types: degrade gracefully with defaults.
        description = `${input.type} source: ${input.identifier}`;
      }

      if (input.type === "reddit") {
        resolvedIdentifier = input.identifier.replace(/^\/?r\//, "");
      }

      const [inserted] = await db.insert(contentSources).values({
        userId: ctx.user.id,
        type: input.type,
        name,
        identifier: resolvedIdentifier,
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

      // Dedup → screen → store only actionable items (bounded-storage pipeline).
      const beats = process.env.SCOUT_NICHES || "freelance writing, business, marketing, women's health, parenting, personal finance, technology, entrepreneurship";
      const r = await ingestSource(db, source, input.limit, beats);
      return { count: r.kept, fresh: r.fresh, fetched: r.fetched, sourceType: source.type };
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
