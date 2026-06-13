/**
 * Financial Accelerator — ports the old elite-writer-app module into v5.
 *
 * The $100K–$200K/mo goal engine: frontend (freelance fees) + backend (offer)
 * revenue vs a monthly goal, the offer stack, article→lead→deal attribution,
 * and a free-model "next best action" that reads the live funnel and tells the
 * operator the 3 highest-leverage moves. Composes existing v5 data (earnings,
 * products, pitches→articles funnel, settings) — no new tables.
 */
import { z } from "zod";
import { and, desc, eq, gte } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM, TIER } from "../_core/llm";
import { getDb } from "../db";
import { earnings, products, articles, pitches, userSettings } from "../../drizzle/schema";

const DEFAULT_GOAL = 200000;

function monthStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export const acceleratorRouter = router({
  // Live revenue engine + offer stack + attribution, all from real v5 data.
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const uid = ctx.user.id;
    const since = monthStart();

    const [settingsRow] = await db.select().from(userSettings).where(eq(userSettings.userId, uid)).limit(1);
    const goalMonthly = Number((settingsRow?.settings as any)?.monthly_revenue_goal) || DEFAULT_GOAL;

    const monthEarnings = await db.select().from(earnings)
      .where(and(eq(earnings.userId, uid), gte(earnings.date, since)));
    const frontendRevenue = monthEarnings.filter((e) => e.type === "content").reduce((s, e) => s + Number(e.amount), 0);
    const backendRevenue = monthEarnings.filter((e) => e.type === "product").reduce((s, e) => s + Number(e.amount), 0);
    const mrr = frontendRevenue + backendRevenue;

    const dayOfMonth = Math.max(1, new Date().getDate());
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dailyRunRate = mrr / dayOfMonth;
    const projectedMonth = Math.round(dailyRunRate * daysInMonth);
    const goalPct = Math.min(Math.round((mrr / goalMonthly) * 100), 100);
    const gapToGoal = Math.max(0, goalMonthly - projectedMonth);

    const offers = await db.select().from(products).where(eq(products.userId, uid)).orderBy(desc(products.updatedAt));

    // Attribution: each earning row attributed to its source (article/publication/offer).
    const attributions = monthEarnings
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 20)
      .map((e) => ({
        id: e.id,
        source: e.source,
        type: e.type,
        amount: Number(e.amount),
        description: e.description,
        date: e.date,
      }));

    const articleCount = (await db.select({ id: articles.id }).from(articles).where(eq(articles.userId, uid))).length;
    const pitchCount = (await db.select({ id: pitches.id }).from(pitches).where(eq(pitches.userId, uid))).length;

    return {
      goalMonthly, frontendRevenue, backendRevenue, mrr,
      dailyRunRate: Math.round(dailyRunRate), projectedMonth, goalPct, gapToGoal,
      offers, attributions,
      counts: { offers: offers.length, articles: articleCount, pitches: pitchCount, earnings: monthEarnings.length },
    };
  }),

  setGoal: protectedProcedure
    .input(z.object({ goalMonthly: z.number().min(0) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);
      if (existing) {
        await db.update(userSettings)
          .set({ settings: { ...(existing.settings || {}), monthly_revenue_goal: input.goalMonthly } })
          .where(eq(userSettings.userId, ctx.user.id));
      } else {
        await db.insert(userSettings).values({ userId: ctx.user.id, settings: { monthly_revenue_goal: input.goalMonthly } });
      }
      return { goalMonthly: input.goalMonthly };
    }),

  // Free-model strategist: reads the live funnel, returns 3 ranked next actions.
  nextBestAction: protectedProcedure
    .input(z.object({
      goalMonthly: z.number(), mrr: z.number(), projectedMonth: z.number(),
      frontendRevenue: z.number(), backendRevenue: z.number(),
      offers: z.array(z.object({ name: z.string(), price: z.any().optional() })).default([]),
      topSources: z.array(z.string()).default([]),
    }))
    .mutation(async ({ input }) => {
      const res = await invokeLLM({
        model: TIER.freeBig,
        maxTokens: 1500,
        messages: [
          { role: "system", content: "You are a revenue strategist for a one-operator media business that monetizes freelance articles into backend offers. Be specific and numeric. Return STRICT JSON only." },
          { role: "user", content: `Monthly goal: $${input.goalMonthly}. This month so far: $${input.mrr} (frontend/freelance $${input.frontendRevenue}, backend/offers $${input.backendRevenue}). Projected month-end: $${input.projectedMonth}. Offer stack: ${input.offers.map((o) => `${o.name} ($${o.price})`).join(", ") || "none"}. Top revenue sources: ${input.topSources.join(", ") || "none"}.

Return STRICT JSON: {"diagnosis": "<one sentence on the biggest gap to goal>", "actions": [{"action": "<specific move>", "why": "<expected $ impact>", "effort": "low|medium|high"}]} — exactly 3 actions, ranked by impact-to-effort.` },
        ],
      });
      const txt = res.choices?.[0]?.message?.content ?? "";
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
      return { diagnosis: "Could not parse strategy this run — try again.", actions: [] };
    }),
});
