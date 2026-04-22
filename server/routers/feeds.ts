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
