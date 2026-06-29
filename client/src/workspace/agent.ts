// ── Workspace agent layer (client side) ────────────────────────────────────
// All AI calls run SERVER-SIDE through the workspace tRPC router (v5 env keys,
// OpenRouter-first routing, agent personas). This module is the client shim:
// task routing preferences, monthly budget gate, and the local AI Ledger
// records (which sync to MySQL like any other workspace rows).
import { createRow, db } from "./db";
import { wsTrpc } from "./trpcClient";

export type AgentTask =
  | "score_idea"
  | "research_brief"
  | "match_publications"
  | "create_offer"
  | "humanize"
  | "tighten"
  | "expand"
  | "headlines"
  | "continue"
  | "proofread";

export interface RouteConfig {
  model: string;
  label: string;
}

// OpenRouter slugs — mirrors server TASK_MODELS defaults (fast paid tier).
// Settings → Models panel overrides these via ew_model_tiers in localStorage.
export const DEFAULT_ROUTES: Record<AgentTask, RouteConfig> = {
  score_idea:         { model: "anthropic/claude-haiku-4.5",    label: "Score idea" },
  match_publications: { model: "anthropic/claude-haiku-4.5",    label: "Match publications" },
  research_brief:     { model: "google/gemini-2.5-flash",       label: "Research brief" },
  create_offer:       { model: "google/gemini-2.5-flash",       label: "Create offer" },
  humanize:           { model: "google/gemini-2.5-flash",       label: "Humanize" },
  tighten:            { model: "google/gemini-2.5-flash",       label: "Tighten" },
  expand:             { model: "google/gemini-2.5-flash",       label: "Expand" },
  headlines:          { model: "anthropic/claude-haiku-4.5",    label: "Headlines" },
  continue:           { model: "google/gemini-2.5-flash",       label: "Continue draft" },
  proofread:          { model: "anthropic/claude-sonnet-4.6",   label: "Proofread" },
};

// Tier → tasks mapping, used to apply Settings → Models overrides
const TIER_TASKS: Record<string, AgentTask[]> = {
  fast:     ["research_brief", "create_offer", "humanize", "tighten", "expand", "continue"],
  standard: ["proofread"],
  cheap:    ["score_idea", "match_publications", "headlines"],
};

export const MODEL_CHOICES = [
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-opus-4.8",
  "openai/gpt-4o",
  "google/gemini-2.0-flash-001",
];

export function getRoutes(): Record<AgentTask, RouteConfig> {
  try {
    // 1. Start with defaults
    const merged = { ...DEFAULT_ROUTES } as Record<AgentTask, RouteConfig>;
    // 2. Apply tier overrides from Settings → Models panel
    const settings = JSON.parse(localStorage.getItem("elite-writer-settings") ?? "{}");
    const tiers: Record<string, string> = settings?.models ?? {};
    for (const [tier, tasks] of Object.entries(TIER_TASKS)) {
      const model = tiers[tier];
      if (model) {
        for (const task of tasks as AgentTask[]) merged[task] = { ...merged[task], model };
      }
    }
    // 3. Per-task overrides (from the workspace agent panel) win over tier
    const saved = JSON.parse(localStorage.getItem("ew_agent_routes") ?? "{}");
    for (const k of Object.keys(merged) as AgentTask[]) {
      if (saved[k]?.model) merged[k] = { ...merged[k], model: saved[k].model };
    }
    return merged;
  } catch {
    return DEFAULT_ROUTES;
  }
}

export function setRouteModel(task: AgentTask, model: string) {
  const saved = JSON.parse(localStorage.getItem("ew_agent_routes") ?? "{}");
  saved[task] = { model };
  localStorage.setItem("ew_agent_routes", JSON.stringify(saved));
}

export function getBudget(): number {
  return Number(localStorage.getItem("ew_agent_budget") ?? 50);
}
export function setBudget(v: number) {
  localStorage.setItem("ew_agent_budget", String(v));
}

// ── Ledger (a normal synced workspace database — chartable, filterable) ────
async function getLedgerDb() {
  const all = await db.databases.toArray();
  return all.find((d) => d.name === "AI Ledger");
}

export async function monthSpend(): Promise<number> {
  const ledger = await getLedgerDb();
  if (!ledger) return 0;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const rows = await db.rows.where("dbId").equals(ledger.id).toArray();
  const costField = ledger.fields.find((f) => f.name === "Cost");
  if (!costField) return 0;
  return rows
    .filter((r) => r.createdAt >= monthStart.getTime())
    .reduce((sum, r) => sum + (Number(r.values[costField.id]) || 0), 0);
}

async function recordLedger(task: AgentTask, model: string, tokensIn: number, tokensOut: number, cost: number, context: string) {
  const ledger = await getLedgerDb();
  if (!ledger) return;
  const byName = new Map(ledger.fields.map((f) => [f.name, f.id]));
  const opts = ledger.fields.find((f) => f.name === "Task")?.options ?? [];
  const taskOpt = opts.find((o) => o.name === DEFAULT_ROUTES[task].label);
  await createRow(ledger.id, {
    [byName.get("Entry") ?? ""]: `${DEFAULT_ROUTES[task].label} — ${context.slice(0, 60)}`,
    [byName.get("Task") ?? ""]: taskOpt?.id ?? null,
    [byName.get("Model") ?? ""]: model.replace(/^.*\//, ""),
    [byName.get("Tokens in") ?? ""]: tokensIn,
    [byName.get("Tokens out") ?? ""]: tokensOut,
    [byName.get("Cost") ?? ""]: Math.round(cost * 10000) / 10000,
    [byName.get("Date") ?? ""]: new Date().toISOString().slice(0, 10),
  });
}

// ── The single entry point for every workspace AI call ─────────────────────
export async function runTask(task: AgentTask, prompt: string, context = ""): Promise<string> {
  const spent = await monthSpend();
  const budget = getBudget();
  if (budget > 0 && spent >= budget) {
    throw new Error(
      `Monthly AI budget reached ($${spent.toFixed(2)} of $${budget}). Raise it in Workspace settings.`,
    );
  }

  const route = getRoutes()[task];
  const result = await wsTrpc.workspace.runAgent.mutate({
    task,
    prompt,
    context,
    model: route.model,
  });

  void recordLedger(task, result.model, result.tokensIn, result.tokensOut, result.cost, context);
  return result.text;
}
