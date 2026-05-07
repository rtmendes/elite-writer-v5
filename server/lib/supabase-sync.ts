/**
 * Supabase Sync Bridge
 * ---------------------
 * Fire-and-forget sync of Elite Writer article lifecycle events
 * to the Command Center's Supabase `pipeline_items` table, and
 * errors to `system_errors`.
 *
 * Zero new dependencies — uses native fetch + ENV vars already in env.ts.
 */

import { ENV } from "../_core/env";

// ── Stage mapping ──────────────────────────────────────────
const STAGE_MAP: Record<string, string> = {
  draft: "queued",
  review: "in_progress",
  scored: "review",
  pitched: "review",
  published: "done",
  // idea statuses (if ever routed here)
  idea: "queued",
  researching: "queued",
  drafting: "queued",
  scoring: "review",
  pitching: "review",
};

function mapStage(status: string): string {
  return STAGE_MAP[status] ?? "queued";
}

// ── Helpers ────────────────────────────────────────────────
function sbHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: ENV.supabaseServiceKey,
    Authorization: `Bearer ${ENV.supabaseServiceKey}`,
  };
}

function sbUrl(path: string): string {
  return `${ENV.supabaseUrl}/rest/v1/${path}`;
}

// ── Primary sync function ──────────────────────────────────
export interface SyncPayload {
  articleId: number;
  title: string;
  status: string;
  brandId?: string | null;
  score?: number | null;
  wordCount?: number | null;
  targetPublication?: string | null;
}

/**
 * Upserts an article into the Command Center pipeline_items table.
 * Fire-and-forget — failures are logged but never throw.
 */
export function syncArticleToPipeline(payload: SyncPayload): void {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) return;

  const run = async () => {
    const stage = mapStage(payload.status);
    const metadata = {
      elite_writer_id: payload.articleId,
      score: payload.score ?? null,
      word_count: payload.wordCount ?? null,
      target_publication: payload.targetPublication ?? null,
      source_url: "https://elitewriter.insightprofit.live",
    };

    // Check for existing item by elite_writer_id
    const findRes = await fetch(
      sbUrl(`pipeline_items?source_app=eq.elite-writer&metadata->>elite_writer_id=eq.${payload.articleId}&select=id`),
      { headers: sbHeaders() },
    );

    if (findRes.ok) {
      const existing = await findRes.json();
      if (existing.length > 0) {
        // Update existing
        await fetch(sbUrl(`pipeline_items?id=eq.${existing[0].id}`), {
          method: "PATCH",
          headers: { ...sbHeaders(), Prefer: "return=minimal" },
          body: JSON.stringify({
            title: payload.title,
            stage,
            priority: (payload.score ?? 0) >= 8 ? "high" : "medium",
            brand: payload.brandId ?? null,
            metadata,
          }),
        });
        return;
      }
    }

    // Insert new
    await fetch(sbUrl("pipeline_items"), {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        title: payload.title,
        stage,
        priority: (payload.score ?? 0) >= 8 ? "high" : "medium",
        brand: payload.brandId ?? null,
        source_app: "elite-writer",
        assigned_to: null,
        metadata,
      }),
    });
  };

  run().catch((err) => {
    console.error("[supabase-sync] pipeline sync failed:", err?.message ?? err);
    reportError("Pipeline sync failed", err);
  });
}

// ── Error reporting ────────────────────────────────────────
/**
 * Logs an error to the Command Center system_errors table.
 * Fire-and-forget — never throws.
 */
export function reportError(
  message: string,
  error?: unknown,
  severity: "info" | "warn" | "error" | "critical" = "error",
  meta?: Record<string, unknown>,
): void {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) return;

  const stack =
    error instanceof Error ? error.stack : error ? String(error) : null;

  fetch(sbUrl("system_errors"), {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({
      source: "elite-writer",
      severity,
      message,
      stack,
      metadata: meta ?? {},
    }),
  }).catch(() => {
    // Swallow — we can't recurse on error-reporting failures
    console.error("[supabase-sync] error reporting failed:", message);
  });
}
