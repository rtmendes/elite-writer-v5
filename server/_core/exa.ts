// ── Exa search (semantic web search for the opportunity scout) ─────────────
// Search API tier only ($5 per 1,000 searches = $0.005/call) — NOT the
// high-compute Agent API. Every call is cost-logged to the central
// record_cost_event system (agent: elite-writer-v5-exa) so the Command Center
// Chief-of-Staff / CFO agents can track spend against the prepaid balance.
import { ENV } from "./env";
import { recordCentralCost } from "./proactiveAgents";

const COST_PER_SEARCH = 0.005;

export interface ExaResult {
  title: string;
  url: string;
  publishedDate?: string;
  text?: string;
}

export function exaConfigured(): boolean {
  return Boolean(process.env.EXA_API_KEY);
}

/** Semantic web search. Returns [] (never throws) so scout jobs stay resilient. */
export async function exaSearch(query: string, numResults = 10, opts: { daysBack?: number; includeText?: boolean } = {}): Promise<ExaResult[]> {
  const key = process.env.EXA_API_KEY;
  if (!key) return [];
  try {
    const body: Record<string, unknown> = {
      query,
      numResults,
      type: "auto",
    };
    if (opts.daysBack) {
      body.startPublishedDate = new Date(Date.now() - opts.daysBack * 864e5).toISOString();
    }
    if (opts.includeText) body.contents = { text: { maxCharacters: 1200 } };

    const resp = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Cost-log every billable call (even failures count against quota rarely;
    // log only successes to keep the CFO ledger honest).
    if (!resp.ok) {
      console.warn(`[exa] search failed: ${resp.status} ${(await resp.text()).slice(0, 120)}`);
      return [];
    }
    void recordCentralCost("exa_search", "exa/search", 0, 0, COST_PER_SEARCH, query.slice(0, 100));
    const data = await resp.json();
    return (data.results ?? []).map((r: { title?: string; url?: string; publishedDate?: string; text?: string }) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      publishedDate: r.publishedDate,
      text: r.text,
    }));
  } catch (err) {
    console.warn("[exa] search error:", err instanceof Error ? err.message : err);
    return [];
  }
}
