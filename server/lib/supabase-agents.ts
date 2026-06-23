/**
 * Supabase Agent Bridge (READ)
 * ----------------------------
 * Read-only counterpart to supabase-sync.ts. Pulls the LIVE platform agent
 * registry, activity logs, and AI spend from the self-hosted Command Center
 * Supabase (supabase.insightprofit.live) so Elite Writer's Agent area can show
 * REAL production agent data — not just this app's local AI Ledger.
 *
 * Tables (owned by the Command Center, confirmed against insightprofit-command-v2):
 *   ai_agents      — agent registry. category='ai_agent' = true agents (the
 *                    table also holds projects/workflows; we filter to agents
 *                    only, honoring the Tools≠Agents taxonomy rule).
 *   agent_logs     — recent agent runs (agent_name, status, cost_usd, created_at).
 *   ai_expense_log — per-call AI spend (agent_name, cost_usd, date, model).
 *
 * Auth: prefers the public ANON key (SUPABASE_ANON_KEY); falls back to the
 * service key only if anon is unset. Zero new deps — native fetch + ENV.
 * Fire-safe: any failure returns { configured } with an error string, never throws.
 */

import { ENV } from "../_core/env";

const AGENT_CATEGORY = "ai_agent";

function key(): string {
  return ENV.supabaseAnonKey || ENV.supabaseServiceKey;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const k = key();
  return { apikey: k, Authorization: `Bearer ${k}`, ...extra };
}

function url(path: string): string {
  return `${ENV.supabaseUrl}/rest/v1/${path}`;
}

/** GET helper. Returns parsed rows + the total count from the Content-Range
 *  header when count=exact was requested. Throws on non-2xx so callers can
 *  surface a real error message. */
async function sbGet<T>(path: string, opts?: { count?: boolean }): Promise<{ rows: T[]; total: number | null }> {
  const res = await fetch(url(path), {
    headers: headers(opts?.count ? { Prefer: "count=exact" } : undefined),
  });
  if (!res.ok) {
    throw new Error(`supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const rows = (await res.json()) as T[];
  // Content-Range looks like "0-11/562" — the part after "/" is the exact total.
  const cr = res.headers.get("content-range");
  const total = cr && cr.includes("/") ? Number(cr.split("/")[1]) : null;
  return { rows, total: Number.isFinite(total as number) ? total : null };
}

// ── Public shapes ──────────────────────────────────────────
export interface PlatformAgent { name: string; status: string | null; platform: string | null }
export interface PlatformLog { agent: string; status: string | null; cost: number; error: string | null; at: number | null }
export interface AgentSpend { agent: string; cost: number; runs: number }

export interface PlatformAgentData {
  configured: boolean;
  host: string | null;
  error: string | null;
  agents: { total: number; sample: PlatformAgent[]; thisApp: PlatformAgent[] };
  logs: PlatformLog[];
  spend: { total: number; month: number; today: number; byAgent: AgentSpend[] };
}

function emptyData(configured: boolean, error: string | null = null): PlatformAgentData {
  return {
    configured,
    host: ENV.supabaseUrl || null,
    error,
    agents: { total: 0, sample: [], thisApp: [] },
    logs: [],
    spend: { total: 0, month: 0, today: 0, byAgent: [] },
  };
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/**
 * Fetches the live platform agent registry, recent logs, and spend rollup.
 * Never throws — on any failure returns emptyData with an error message so the
 * UI can show a graceful "couldn't reach the registry" state.
 */
export async function fetchPlatformAgentData(): Promise<PlatformAgentData> {
  if (!ENV.supabaseUrl || !key()) return emptyData(false);

  // allSettled, not all: these tables are owned by the Command Center, not us.
  // One renamed column shouldn't blank the whole panel — degrade per-source.
  const [registryR, thisAppR, logsR, expensesR] = await Promise.allSettled([
    sbGet<PlatformAgent & { id?: string }>(
      `ai_agents?select=name,status,platform&category=eq.${AGENT_CATEGORY}&order=name.asc&limit=24`,
      { count: true },
    ),
    sbGet<PlatformAgent>(
      `ai_agents?select=name,status,platform&category=eq.${AGENT_CATEGORY}&platform=ilike.*${ENV.appId}*&limit=10`,
    ),
    sbGet<{ agent_name?: string; status?: string; cost_usd?: number; error_message?: string; created_at?: string }>(
      `agent_logs?select=agent_name,status,cost_usd,error_message,created_at&order=created_at.desc&limit=12`,
    ),
    sbGet<{ agent?: string; cost_usd?: number; created_at?: string }>(
      `ai_expense_log?select=agent,cost_usd,created_at&order=created_at.desc&limit=1000`,
    ),
  ]);

  const registry = registryR.status === "fulfilled" ? registryR.value : { rows: [], total: 0 };
  const thisApp = thisAppR.status === "fulfilled" ? thisAppR.value : { rows: [], total: 0 };
  const logs = logsR.status === "fulfilled" ? logsR.value : { rows: [], total: 0 };
  const expenses = expensesR.status === "fulfilled" ? expensesR.value : { rows: [], total: 0 };

  // If every source failed, surface a single error (likely host/auth-wide).
  const firstErr = [registryR, thisAppR, logsR, expensesR].find((r) => r.status === "rejected") as
    | PromiseRejectedResult
    | undefined;
  if (registryR.status === "rejected" && logsR.status === "rejected" && expensesR.status === "rejected") {
    return emptyData(true, firstErr?.reason?.message || "Failed to reach the agent registry");
  }

  // Spend rollup (today / month / total + top agents).
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  let total = 0, month = 0, today = 0;
  const byAgent = new Map<string, AgentSpend>();
  for (const e of expenses.rows) {
    const cost = Number(e.cost_usd) || 0;
    total += cost;
    const t = e.created_at ? Date.parse(e.created_at) : NaN;
    if (Number.isFinite(t)) {
      if (t >= monthStart.getTime()) month += cost;
      if (t >= todayStart.getTime()) today += cost;
    }
    const name = e.agent || "—";
    const a = byAgent.get(name) ?? { agent: name, cost: 0, runs: 0 };
    a.cost = round(a.cost + cost);
    a.runs += 1;
    byAgent.set(name, a);
  }

  return {
    configured: true,
    host: ENV.supabaseUrl,
    error: null,
    agents: {
      total: registry.total ?? registry.rows.length,
      sample: registry.rows.map((r) => ({ name: r.name, status: r.status, platform: r.platform })),
      thisApp: thisApp.rows,
    },
    logs: logs.rows.map((l) => ({
      agent: l.agent_name || "—",
      status: l.status ?? null,
      cost: Number(l.cost_usd) || 0,
      error: l.error_message ?? null,
      at: l.created_at ? Date.parse(l.created_at) : null,
    })),
    spend: {
      total: round(total),
      month: round(month),
      today: round(today),
      byAgent: [...byAgent.values()].sort((a, b) => b.cost - a.cost).slice(0, 8),
    },
  };
}
