/**
 * Feeds & Funnels Router — 6 endpoints ported from elite-writer-app
 * Covers: feeds/list, feeds/upsert, feeds/delete,
 *         funnels/create, funnels/optimize, funnels/score
 */
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { feeds, funnels, type InsertFeed, type InsertFunnel } from "../../drizzle/schema";

// ─── Feeds Router ─────────────────────────────────────────

export const feedsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(feeds)
      .where(eq(feeds.userId, ctx.user.id))
      .orderBy(desc(feeds.createdAt));
  }),

  upsert: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      type: z.enum(["rss", "email"]).default("rss"),
      url: z.string().optional(),
      emailFrom: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      active: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      if (input.id) {
        // Update
        const { id, ...updates } = input;
        const setObj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(updates)) {
          if (v !== undefined) {
            setObj[k] = k === "active" ? (v ? 1 : 0) : v;
          }
        }
        await db.update(feeds).set(setObj)
          .where(and(eq(feeds.id, id), eq(feeds.userId, ctx.user.id)));
        return { success: true, action: "updated", id };
      } else {
        // Create
        const [result] = await db.insert(feeds).values({
          userId: ctx.user.id,
          name: input.name,
          type: input.type,
          url: input.url ?? null,
          emailFrom: input.emailFrom ?? null,
          keywords: input.keywords || [],
          active: input.active ? 1 : 0,
        }).$returningId();
        return { success: true, action: "created", id: result.id };
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(feeds)
        .where(and(eq(feeds.id, input.id), eq(feeds.userId, ctx.user.id)));
      return { success: true };
    }),

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Gap #1 + #5: Seed curated feeds into the database
  // Seeds 31 curated feeds with publication mapping
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  seed: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    // Check if already seeded
    const existing = await db.select().from(feeds)
      .where(eq(feeds.userId, ctx.user.id));
    
    if (existing.length >= 20) {
      return { success: true, action: 'skipped', message: 'Feeds already seeded', count: existing.length };
    }

    const CURATED = [
      { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews', keywords: ['business', 'markets', 'economy'] },
      { name: 'Bloomberg Markets', url: 'https://feeds.bloomberg.com/markets/news.rss', keywords: ['finance', 'markets', 'investing'] },
      { name: 'Harvard Business Review', url: 'https://feeds.hbr.org/harvardbusiness', keywords: ['management', 'strategy', 'leadership'] },
      { name: 'Fast Company', url: 'https://www.fastcompany.com/latest/rss?format=xml', keywords: ['innovation', 'design', 'leadership'] },
      { name: 'Inc. Magazine', url: 'https://www.inc.com/rss/', keywords: ['startups', 'entrepreneurship', 'growth'] },
      { name: 'Entrepreneur', url: 'https://www.entrepreneur.com/latest.rss', keywords: ['business', 'startups', 'growth'] },
      { name: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', keywords: ['finance', 'markets', 'economy'] },
      { name: 'Forbes Innovation', url: 'https://www.forbes.com/innovation/feed/', keywords: ['tech', 'innovation', 'disruption'] },
      { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', keywords: ['tech', 'startups', 'funding'] },
      { name: 'Wired', url: 'https://www.wired.com/feed/rss', keywords: ['tech', 'culture', 'science'] },
      { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', keywords: ['tech', 'gadgets', 'culture'] },
      { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', keywords: ['tech', 'science', 'analysis'] },
      { name: 'AP News', url: 'https://rss.ap.org/article/topnews', keywords: ['news', 'breaking', 'politics'] },
      { name: 'The Conversation', url: 'https://theconversation.com/us/articles.atom', keywords: ['research', 'academia', 'analysis'] },
      { name: 'Vox', url: 'https://www.vox.com/rss/index.xml', keywords: ['explainer', 'policy', 'analysis'] },
      { name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', keywords: ['news', 'culture', 'politics'] },
      { name: 'Foreign Policy', url: 'https://foreignpolicy.com/feed/', keywords: ['geopolitics', 'international', 'policy'] },
      { name: 'Healthline', url: 'https://www.healthline.com/rss', keywords: ['health', 'wellness', 'nutrition'] },
      { name: 'Psychology Today', url: 'https://www.psychologytoday.com/us/blog/rss', keywords: ['psychology', 'mental-health', 'behavior'] },
      { name: 'The Cut', url: 'https://www.thecut.com/feed/rss/', keywords: ['culture', 'style', 'power'] },
      { name: 'Refinery29', url: 'https://www.refinery29.com/rss.xml', keywords: ['lifestyle', 'fashion', 'culture'] },
      { name: 'Scientific American', url: 'https://rss.sciam.com/ScientificAmerican-Global', keywords: ['science', 'research', 'discovery'] },
      { name: 'Nature News', url: 'https://www.nature.com/nature.rss', keywords: ['research', 'science', 'biology'] },
      { name: 'Conde Nast Traveler', url: 'https://www.cntraveler.com/feed/rss', keywords: ['travel', 'destinations', 'luxury'] },
      { name: 'Eater', url: 'https://www.eater.com/rss/index.xml', keywords: ['food', 'restaurants', 'dining'] },
      { name: 'Nieman Lab', url: 'https://www.niemanlab.org/feed/', keywords: ['journalism', 'media', 'writing'] },
      { name: 'The Write Life', url: 'https://thewritelife.com/feed/', keywords: ['freelance', 'writing', 'publishing'] },
      { name: 'Contently', url: 'https://contently.com/feed/', keywords: ['content-strategy', 'marketing', 'writing'] },
      { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', keywords: ['ai', 'biotech', 'emerging-tech'] },
      { name: 'Rest of World', url: 'https://restofworld.org/feed/', keywords: ['global', 'technology', 'emerging-markets'] },
      { name: 'Hacker News', url: 'https://hnrss.org/frontpage', keywords: ['tech', 'startups', 'programming'] },
    ];

    let seeded = 0;
    for (const feed of CURATED) {
      try {
        await db.insert(feeds).values({
          userId: ctx.user.id,
          name: feed.name,
          type: 'rss',
          url: feed.url,
          emailFrom: null,
          keywords: feed.keywords,
          active: feed.name === 'Hacker News' ? 0 : 1,
        });
        seeded++;
      } catch { /* skip duplicates */ }
    }

    return { success: true, action: 'seeded', count: seeded, total: CURATED.length };
  }),
});

// ─── Funnels Router ───────────────────────────────────────

const VALID_FUNNEL_TYPES = ["lead_gen", "sales", "webinar", "product_launch", "tripwire", "high_ticket", "membership"] as const;

export const funnelsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(funnels)
      .where(eq(funnels.userId, ctx.user.id))
      .orderBy(desc(funnels.createdAt));
  }),

  // Create a complete funnel with AI-generated stages
  create: protectedProcedure
    .input(z.object({
      funnelType: z.enum(VALID_FUNNEL_TYPES),
      productName: z.string().min(1),
      productDescription: z.string().optional(),
      targetAudience: z.string().optional(),
      pricePoint: z.string().optional(),
      goals: z.string().optional(),
      existingAssets: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an elite marketing funnel architect. Design complete, conversion-optimized marketing funnels with specific copy, CTAs, and email sequences for each stage. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Design a complete ${input.funnelType} funnel:

Product: ${input.productName}
Description: ${input.productDescription || "N/A"}
Target Audience: ${input.targetAudience || "General"}
Price Point: ${input.pricePoint || "N/A"}
Goals: ${input.goals || "Maximize conversions"}
Existing Assets: ${input.existingAssets || "None"}

Return JSON:
{
  "name": "<funnel name>",
  "stages": [
    {
      "order": <number>,
      "name": "<stage name>",
      "type": "<awareness|interest|consideration|conversion|retention>",
      "channel": "<social|email|landing_page|webinar|checkout>",
      "headline": "<headline copy>",
      "body": "<body copy>",
      "cta": "<call to action>",
      "emailSubject": "<if email stage>",
      "timing": "<when this stage fires, e.g. 'Day 0', 'Day 3'>",
      "metrics": ["<KPI to track>"],
      "tips": "<optimization tip>"
    }
  ],
  "totalStages": <number>,
  "estimatedTimeline": "<e.g. 14 days>",
  "requiredTools": ["<tool needed>"],
  "budgetEstimate": "<estimated ad/tool spend>"
}`,
          },
        ],
        response_format: { type: "json_object" },
        maxTokens: 4000,
      });

      const text = result.choices[0]?.message?.content ?? "";
      let funnelData;
      try { funnelData = JSON.parse(text); } catch { funnelData = { name: input.productName, stages: [] }; }

      // Store funnel
      const db = await getDb();
      let funnelId: number | undefined;

      if (db) {
        const [res] = await db.insert(funnels).values({
          userId: ctx.user.id,
          name: funnelData.name || `${input.funnelType} for ${input.productName}`,
          funnelType: input.funnelType,
          productName: input.productName,
          productDescription: input.productDescription ?? null,
          targetAudience: input.targetAudience ?? null,
          pricePoint: input.pricePoint ?? null,
          stages: funnelData.stages,
          status: "draft",
        }).$returningId();
        funnelId = res.id;
      }

      return { success: true, funnelId, data: funnelData, usage: result.usage };
    }),

  // Optimize an existing funnel
  optimize: protectedProcedure
    .input(z.object({
      funnelId: z.number(),
      performanceData: z.record(z.string(), z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [funnel] = await db.select().from(funnels)
        .where(and(eq(funnels.id, input.funnelId), eq(funnels.userId, ctx.user.id)));

      if (!funnel) throw new Error("Funnel not found");

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a conversion rate optimization expert. Analyze funnel performance and suggest specific improvements. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Optimize this marketing funnel:

Name: ${funnel.name}
Type: ${funnel.funnelType}
Product: ${funnel.productName}
Current stages: ${JSON.stringify(funnel.stages, null, 2)}
${input.performanceData ? `Performance data: ${JSON.stringify(input.performanceData)}` : "No performance data available — suggest general optimizations."}

Return JSON:
{
  "optimizations": [
    {
      "stage": "<stage name>",
      "issue": "<identified problem>",
      "recommendation": "<specific fix>",
      "expectedImpact": "<estimated improvement>",
      "priority": "<high|medium|low>"
    }
  ],
  "overallScore": <0-100>,
  "summary": "<2-3 sentence optimization summary>",
  "abTests": [{"name": "", "description": "", "hypothesis": ""}]
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content ?? "";
      let data;
      try { data = JSON.parse(text); } catch { data = { optimizations: [] }; }

      // Update funnel with optimization data
      await db.update(funnels)
        .set({ optimizationData: data, status: "optimizing" })
        .where(eq(funnels.id, input.funnelId));

      return { success: true, data, usage: result.usage };
    }),

  // Score a funnel
  score: protectedProcedure
    .input(z.object({ funnelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [funnel] = await db.select().from(funnels)
        .where(and(eq(funnels.id, input.funnelId), eq(funnels.userId, ctx.user.id)));

      if (!funnel) throw new Error("Funnel not found");

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a marketing funnel auditor. Score the funnel on key dimensions. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Score this marketing funnel:\n\nName: ${funnel.name}\nType: ${funnel.funnelType}\nProduct: ${funnel.productName}\nStages: ${JSON.stringify(funnel.stages)}\n\nReturn JSON:\n{\n  "overall": <0-100>,\n  "dimensions": {\n    "clarity": {"score": <0-100>, "feedback": ""},\n    "persuasion": {"score": <0-100>, "feedback": ""},\n    "userExperience": {"score": <0-100>, "feedback": ""},\n    "conversion": {"score": <0-100>, "feedback": ""},\n    "completeness": {"score": <0-100>, "feedback": ""}\n  },\n  "improvements": ["<suggestion>"]\n}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content ?? "";
      let scoreData;
      try { scoreData = JSON.parse(text); } catch { scoreData = { overall: 0 }; }

      await db.update(funnels)
        .set({ score: scoreData.overall, scoreData })
        .where(eq(funnels.id, input.funnelId));

      return { success: true, scoreData, usage: result.usage };
    }),

  // Delete funnel
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(funnels)
        .where(and(eq(funnels.id, input.id), eq(funnels.userId, ctx.user.id)));
      return { success: true };
    }),
});
