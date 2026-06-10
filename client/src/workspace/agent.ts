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
  | "continue";

export interface RouteConfig {
  model: string;
  label: string;
}

// OpenRouter slugs — the server routes them through its provider chain.
export const DEFAULT_ROUTES: Record<AgentTask, RouteConfig> = {
  score_idea: { model: "anthropic/claude-haiku-4.5", label: "Score idea" },
  match_publications: { model: "anthropic/claude-haiku-4.5", label: "Match publications" },
  research_brief: { model: "anthropic/claude-sonnet-4.6", label: "Research brief" },
  create_offer: { model: "anthropic/claude-opus-4.8", label: "Create offer" },
  humanize: { model: "anthropic/claude-opus-4.8", label: "Humanize" },
  tighten: { model: "anthropic/claude-opus-4.8", label: "Tighten" },
  expand: { model: "anthropic/claude-opus-4.8", label: "Expand" },
  headlines: { model: "anthropic/claude-opus-4.8", label: "Headlines" },
  continue: { model: "anthropic/claude-opus-4.8", label: "Continue draft" },
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
    const saved = JSON.parse(localStorage.getItem("ew_agent_routes") ?? "{}");
    const merged = { ...DEFAULT_ROUTES } as Record<AgentTask, RouteConfig>;
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
