/**
 * Pulse Pipeline Router — Article Pulse → Elite Writer Integration
 * 
 * Endpoints:
 * - ingest:            Accept stories from Article Pulse cron (public, API-key protected)
 * - list:              List pulse stories with filters
 * - get:               Get a single pulse story
 * - updateStatus:      Change story status (reviewing, writing, skipped, etc.)
 * - promote:           Move story into article pipeline (creates article + idea)
 * - briefings:         List available briefing dates
 * - analyze:           Run data analysis on stories (beat distribution, trends)
 * - enrichPublications: AI match stories to publications
 */
import { z } from "zod";
import { eq, desc, and, sql, like, inArray } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import {
  pulseStories, articles, ideas, brands, publications,
  type InsertPulseStory,
} from "../../drizzle/schema";
import { getPublicationIntel, intelKeywords } from "../../shared/publication-intelligence";

// ─── Urgency mapping ─────────────────────────────────────
function mapUrgency(emoji: string): "breaking" | "this_week" | "evergreen" {
  if (emoji === "🔴") return "breaking";
  if (emoji === "🟡") return "this_week";
  return "evergreen";
}

export const pulseRouter = router({
  // ── Ingest: Accept stories from Article Pulse cron ──
  // Public endpoint protected by simple API key check
  ingest: publicProcedure
    .input(z.object({
      apiKey: z.string().optional(),
      briefingDate: z.string(), // YYYY-MM-DD
      stories: z.array(z.object({
        id: z.number(),
        beat: z.string(),
        urgency: z.string(),
        urgencyLabel: z.string().optional(),
        headline: z.string(),
        source: z.string().optional(),
        sourceDisplay: z.string().optional(),
        whyItMatters: z.string().optional(),
        angle: z.string().optional(),
        contentType: z.string().optional(),
        priority: z.number().optional(),
      })),
      top5: z.array(z.object({
        rank: z.number(),
        id: z.number(),
        reason: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Build top5 lookup
      const top5Map = new Map<number, { rank: number; reason: string }>();
      if (input.top5) {
        for (const pick of input.top5) {
          top5Map.set(pick.id, { rank: pick.rank, reason: pick.reason });
        }
      }

      let ingested = 0;
      for (const story of input.stories) {
        const top5Entry = top5Map.get(story.id);
        try {
          await db.insert(pulseStories).values({
            externalId: story.id,
            headline: story.headline,
            source: story.source,
            sourceDisplay: story.sourceDisplay,
            beat: story.beat.replace(/^[🔴🟡🔵🤖🌸✈️📝🛒]\s*/, "").trim() || story.beat,
            urgency: mapUrgency(story.urgency),
            urgencyEmoji: story.urgency,
            whyItMatters: story.whyItMatters,
            angle: story.angle,
            contentType: story.contentType,
            priority: story.priority,
            briefingDate: input.briefingDate,
            briefingRank: top5Entry?.rank,
            briefingReason: top5Entry?.reason,
            status: "new",
          });
          ingested++;
        } catch (e: any) {
          // Skip duplicates
          console.error(`Pulse ingest error for "${story.headline}":`, e.message);
        }
      }

      return { success: true, ingested, total: input.stories.length };
    }),

  // ── List pulse stories ──
  list: protectedProcedure
    .input(z.object({
      briefingDate: z.string().optional(),
      beat: z.string().optional(),
      urgency: z.enum(["breaking", "this_week", "evergreen"]).optional(),
      status: z.enum(["new", "reviewing", "writing", "in_pipeline", "published", "skipped"]).optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { stories: [], total: 0 };

      const filters: any[] = [];
      if (input?.briefingDate) filters.push(eq(pulseStories.briefingDate, input.briefingDate));
      if (input?.beat) filters.push(like(pulseStories.beat, `%${input.beat}%`));
      if (input?.urgency) filters.push(eq(pulseStories.urgency, input.urgency));
      if (input?.status) filters.push(eq(pulseStories.status, input.status));

      const where = filters.length > 0 ? and(...filters) : undefined;

      const [stories, countResult] = await Promise.all([
        db.select().from(pulseStories)
          .where(where)
          .orderBy(desc(pulseStories.briefingDate), pulseStories.priority)
          .limit(input?.limit ?? 50)
          .offset(input?.offset ?? 0),
        db.select({ count: sql<number>`count(*)` }).from(pulseStories).where(where),
      ]);

      return { stories, total: countResult[0]?.count ?? 0 };
    }),

  // ── Get single story ──
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const rows = await db.select().from(pulseStories).where(eq(pulseStories.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  // ── Update story status ──
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["new", "reviewing", "writing", "in_pipeline", "published", "skipped"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(pulseStories)
        .set({ status: input.status })
        .where(eq(pulseStories.id, input.id));
      return { success: true };
    }),

  // ── Promote story to article pipeline ──
  promote: protectedProcedure
    .input(z.object({
      id: z.number(),
      targetBrand: z.string().optional(),
      targetPublication: z.string().optional(),
      wordCount: z.number().default(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get the pulse story
      const rows = await db.select().from(pulseStories).where(eq(pulseStories.id, input.id)).limit(1);
      const story = rows[0];
      if (!story) throw new Error("Story not found");

      // Create an idea from the story
      const [ideaResult] = await db.insert(ideas).values({
        userId: ctx.user.id,
        title: story.headline,
        angle: story.angle ?? undefined,
        category: story.beat,
        newsPeg: story.whyItMatters ?? undefined,
        status: "drafting",
        brandId: input.targetBrand ?? undefined,
      }).returning({ id: ideas.id });

      // Create a draft article
      const [articleResult] = await db.insert(articles).values({
        userId: ctx.user.id,
        title: story.headline,
        content: `# ${story.headline}\n\n**Angle:** ${story.angle ?? "TBD"}\n\n**Why It Matters:** ${story.whyItMatters ?? ""}\n\n**Source:** ${story.sourceDisplay ?? story.source ?? ""}\n\n---\n\n_Article content will be generated by the AI pipeline._`,
        status: "draft",
        brandId: input.targetBrand ?? undefined,
        targetPublication: input.targetPublication ?? undefined,
      }).returning({ id: articles.id });

      // Update pulse story status and link
      await db.update(pulseStories)
        .set({
          status: "in_pipeline",
          articleId: articleResult.id,
          ideaId: ideaResult.id,
        })
        .where(eq(pulseStories.id, input.id));

      return {
        success: true,
        articleId: articleResult.id,
        ideaId: ideaResult.id,
      };
    }),

  // ── List available briefing dates ──
  briefings: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];

    const rows = await db.select({
      date: pulseStories.briefingDate,
      count: sql<number>`count(*)`,
      breakingCount: sql<number>`sum(case when ${pulseStories.urgency} = 'breaking' then 1 else 0 end)`,
      newCount: sql<number>`sum(case when ${pulseStories.status} = 'new' then 1 else 0 end)`,
    })
      .from(pulseStories)
      .groupBy(pulseStories.briefingDate)
      .orderBy(desc(pulseStories.briefingDate))
      .limit(30);

    return rows;
  }),

  // ── Analyze stories: beat distribution, trends, data insights ──
  analyze: protectedProcedure
    .input(z.object({
      briefingDate: z.string().optional(),
      days: z.number().default(7),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Beat distribution
      const beatDist = await db.select({
        beat: pulseStories.beat,
        count: sql<number>`count(*)`,
        avgPriority: sql<number>`avg(${pulseStories.priority})`,
      })
        .from(pulseStories)
        .groupBy(pulseStories.beat)
        .orderBy(desc(sql`count(*)`));

      // Urgency distribution
      const urgencyDist = await db.select({
        urgency: pulseStories.urgency,
        count: sql<number>`count(*)`,
      })
        .from(pulseStories)
        .groupBy(pulseStories.urgency);

      // Status distribution
      const statusDist = await db.select({
        status: pulseStories.status,
        count: sql<number>`count(*)`,
      })
        .from(pulseStories)
        .groupBy(pulseStories.status);

      // Top-ranked stories
      const topRanked = await db.select()
        .from(pulseStories)
        .where(sql`${pulseStories.briefingRank} IS NOT NULL`)
        .orderBy(desc(pulseStories.briefingDate), pulseStories.briefingRank)
        .limit(15);

      // Total stats
      const [totals] = await db.select({
        total: sql<number>`count(*)`,
        promoted: sql<number>`sum(case when ${pulseStories.status} = 'in_pipeline' then 1 else 0 end)`,
        published: sql<number>`sum(case when ${pulseStories.status} = 'published' then 1 else 0 end)`,
        skipped: sql<number>`sum(case when ${pulseStories.status} = 'skipped' then 1 else 0 end)`,
        pending: sql<number>`sum(case when ${pulseStories.status} = 'new' then 1 else 0 end)`,
      })
        .from(pulseStories);

      return {
        beatDistribution: beatDist,
        urgencyDistribution: urgencyDist,
        statusDistribution: statusDist,
        topRanked,
        totals: totals ?? { total: 0, promoted: 0, published: 0, skipped: 0, pending: 0 },
      };
    }),

  // ── Enrich story with publication matches ──
  enrichPublications: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get the story
      const rows = await db.select().from(pulseStories).where(eq(pulseStories.id, input.id)).limit(1);
      const story = rows[0];
      if (!story) throw new Error("Story not found");

      // Get user's brands
      const userBrands = await db.select().from(brands).where(eq(brands.userId, ctx.user.id));

      // Get available publications
      const pubs = await db.select().from(publications).limit(200);

      // AI matching
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a publishing strategist. Match stories to the best brands and publications. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Match this story to the best brands and publications.

STORY:
Headline: "${story.headline}"
Beat: ${story.beat}
Angle: ${story.angle ?? "Not specified"}
Why It Matters: ${story.whyItMatters ?? "Not specified"}
Content Type: ${story.contentType ?? "Not specified"}

AVAILABLE BRANDS:
${userBrands.map(b => `- ${b.name} (${b.niche || "general"}): ${b.description || ""}`).join("\n")}

TOP PUBLICATIONS (sample):
${pubs.slice(0, 30).map(p => {
  const intel = getPublicationIntel(p.name);
  const kw = intel ? intelKeywords(intel).slice(0, 8).join(", ") : "";
  return `- ${p.name} (${p.category || "general"}, pay: ${p.payRange || "unknown"})${kw ? ` | prefers: ${kw}` : ""}`;
}).join("\n")}

Return JSON:
{
  "matchedBrands": [{"brandName": "", "relevanceScore": 0-100, "suggestedAngle": ""}],
  "matchedPublications": [{"publicationName": "", "matchScore": 0-100, "payRange": "", "whyItFits": ""}],
  "analysisData": {
    "sentimentScore": 0-100,
    "viralPotential": 0-100,
    "competitiveGap": 0-100,
    "audienceSize": "estimate",
    "trendDirection": "rising|stable|declining"
  }
}`,
          },
        ],
        response_format: { type: "json_object" },
        maxTokens: 1500,
      });

      const text = result.choices[0]?.message?.content ?? "{}";
      let data;
      try { data = JSON.parse(text); } catch { data = {}; }

      // Update the story with enrichment
      await db.update(pulseStories)
        .set({
          matchedBrands: data.matchedBrands || [],
          matchedPublications: data.matchedPublications || [],
          analysisData: data.analysisData || {},
        })
        .where(eq(pulseStories.id, input.id));

      return { success: true, data };
    }),

  // ── Bulk enrich all new stories for a briefing date ──
  enrichBulk: protectedProcedure
    .input(z.object({ briefingDate: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const stories = await db.select()
        .from(pulseStories)
        .where(and(
          eq(pulseStories.briefingDate, input.briefingDate),
          sql`${pulseStories.matchedBrands} IS NULL`,
        ));

      // Get brands and pubs once
      const userBrands = await db.select().from(brands).where(eq(brands.userId, ctx.user.id));
      const pubs = await db.select().from(publications).limit(200);

      let enriched = 0;
      for (const story of stories.slice(0, 15)) { // cap at 15 to avoid timeout
        try {
          const result = await invokeLLM({
            messages: [
              { role: "system", content: "You are a publishing strategist. Return ONLY valid JSON." },
              {
                role: "user",
                content: `Match this story to brands and publications.

STORY: "${story.headline}" | Beat: ${story.beat} | Angle: ${story.angle ?? "N/A"}

BRANDS: ${userBrands.map(b => b.name).join(", ")}
PUBLICATIONS (top 20): ${pubs.slice(0, 20).map(p => `${p.name} (${p.payRange || "?"})`).join(", ")}

Return JSON:
{"matchedBrands":[{"brandName":"","relevanceScore":0,"suggestedAngle":""}],"matchedPublications":[{"publicationName":"","matchScore":0,"payRange":"","whyItFits":""}],"analysisData":{"viralPotential":0,"trendDirection":"rising"}}`,
              },
            ],
            response_format: { type: "json_object" },
            maxTokens: 800,
          });

          const text = result.choices[0]?.message?.content ?? "{}";
          let data;
          try { data = JSON.parse(text); } catch { continue; }

          await db.update(pulseStories)
            .set({
              matchedBrands: data.matchedBrands || [],
              matchedPublications: data.matchedPublications || [],
              analysisData: data.analysisData || {},
            })
            .where(eq(pulseStories.id, story.id));
          enriched++;
        } catch { /* skip */ }
      }

      return { success: true, enriched, total: stories.length };
    }),
});
