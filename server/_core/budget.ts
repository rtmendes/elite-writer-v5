// AI budget enforcement — ported from elite-writer-app's LLM gateway.
// invokeLLM records exact usage per (day, model) and refuses new calls once
// the daily cap is reached. Metering always runs; ENFORCEMENT only activates
// when AI_DAILY_BUDGET_USD is set, so deployments without it are unaffected.
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { aiUsage } from "../../drizzle/schema";

// $/1M tokens, rough family pricing for internal budget math (not billing).
// Update alongside provider price changes; unknown models use `default`.
const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus": { in: 5.0, out: 25.0 },
  "claude-sonnet": { in: 1.5, out: 7.5 },
  "claude-haiku": { in: 0.25, out: 1.25 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10.0 },
  gemini: { in: 0.1, out: 0.4 },
  perplexity: { in: 1.0, out: 1.0 },
  default: { in: 1.5, out: 7.5 },
};

function priceFor(model: string): { in: number; out: number } {
  const m = model.toLowerCase();
  for (const key of Object.keys(PRICING)) {
    if (key !== "default" && m.includes(key)) return PRICING[key];
  }
  return PRICING.default;
}

export function estimateCostMicros(
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number }
): number {
  if (!usage) return 0;
  const p = priceFor(model);
  const usd =
    ((usage.prompt_tokens ?? 0) * p.in + (usage.completion_tokens ?? 0) * p.out) / 1e6;
  return Math.round(usd * 1e6); // micro-dollars, integer-safe
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function spentTodayMicros(): Promise<number> {
  try {
    const db = await getDb();
    if (!db) return 0;
    const rows = await db
      .select({ total: sql<number>`COALESCE(SUM(${aiUsage.costMicros}), 0)` })
      .from(aiUsage)
      .where(sql`${aiUsage.day} = ${todayKey()}`);
    return Number(rows[0]?.total ?? 0);
  } catch {
    return 0; // table may not exist yet — never block on metering infra
  }
}

/** Throws when the daily budget (AI_DAILY_BUDGET_USD) is exhausted. */
export async function assertBudget(): Promise<void> {
  const capUsd = Number(process.env.AI_DAILY_BUDGET_USD || 0);
  if (!capUsd || Number.isNaN(capUsd)) return; // enforcement opt-in
  const spent = await spentTodayMicros();
  if (spent >= capUsd * 1e6) {
    throw new Error(
      `Daily AI budget reached ($${(spent / 1e6).toFixed(2)} of $${capUsd.toFixed(2)}). Resets at midnight UTC, or raise AI_DAILY_BUDGET_USD.`
    );
  }
}

/** Fire-and-forget usage recording — one aggregated row per (day, model). */
export function recordUsage(
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number }
): void {
  if (!usage) return;
  void (async () => {
    try {
      const db = await getDb();
      if (!db) return;
      await db
        .insert(aiUsage)
        .values({
          day: todayKey(),
          model: model.slice(0, 200),
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          costMicros: estimateCostMicros(model, usage),
          calls: 1,
        })
        .onDuplicateKeyUpdate({
          set: {
            promptTokens: sql`${aiUsage.promptTokens} + ${usage.prompt_tokens ?? 0}`,
            completionTokens: sql`${aiUsage.completionTokens} + ${usage.completion_tokens ?? 0}`,
            costMicros: sql`${aiUsage.costMicros} + ${estimateCostMicros(model, usage)}`,
            calls: sql`${aiUsage.calls} + 1`,
          },
        });
    } catch {
      /* metering must never break a request */
    }
  })();
}
