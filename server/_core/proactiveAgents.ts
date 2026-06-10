/**
 * Proactive agent loop — agents act WITHOUT being asked.
 *
 * Jobs (all budget-capped via the AI Ledger, all costs recorded centrally):
 *  - Scout (Thomas Fischer): files fresh news-pegged article ideas into the
 *    Article Pipeline workspace database, at most once per ~20h and only while
 *    fewer than 12 ideas are waiting. Uses live NewsAPI headlines when available.
 *  - Scorer (Priya Sharma): auto-scores any pipeline row sitting in Idea or
 *    Research status that has no AI Score yet.
 *  - Quality Guardian (Elena Vasquez): reviews rows reaching Edit/Submitted and
 *    stamps an Approved/Blocked verdict with reasons before anything goes out.
 *
 * Everything is written into the workspace tables (wsDatabases/wsRows) with a
 * fresh updatedAt, so every device's sync picks the changes up automatically.
 */
import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../db";
import { AGENT_PERSONAS } from "../routers/agents";
import { ENV } from "./env";
import { invokeLLM } from "./llm";

const uid = () => nanoid(12);

// ── Workspace data model mirrors (kept minimal, matches client types.ts) ───
interface WsSelectOption { id: string; name: string; color: string }
interface WsField { id: string; name: string; type: string; options?: WsSelectOption[]; width?: number }
interface WsDatabase { id: string; name: string; icon: string; fields: WsField[]; views: unknown[]; createdAt: number; updatedAt: number; description?: string }
interface WsRow { id: string; dbId: string; values: Record<string, unknown>; doc?: unknown[]; sortOrder: number; createdAt: number; updatedAt: number }

async function dbExec(query: string): Promise<Array<Record<string, unknown>>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.execute(sql.raw(query));
  return ((result as unknown as [Array<Record<string, unknown>>])[0] ?? []);
}

function parseData<T>(raw: unknown): T {
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
}

async function loadDatabases(): Promise<WsDatabase[]> {
  const rows = await dbExec("SELECT data FROM `wsDatabases` WHERE deleted = FALSE");
  return rows.map((r) => parseData<WsDatabase>(r.data));
}

async function loadRows(dbId: string): Promise<WsRow[]> {
  const rows = await dbExec("SELECT data FROM `wsRows` WHERE deleted = FALSE");
  return rows.map((r) => parseData<WsRow>(r.data)).filter((r) => r.dbId === dbId);
}

async function saveDatabase(database: WsDatabase) {
  const db = await getDb();
  if (!db) return;
  database.updatedAt = Date.now();
  await db.execute(sql`
    INSERT INTO wsDatabases (id, data, updatedAt, deleted)
    VALUES (${database.id}, ${JSON.stringify(database)}, ${database.updatedAt}, FALSE)
    ON DUPLICATE KEY UPDATE data = VALUES(data), updatedAt = VALUES(updatedAt), deleted = FALSE
  `);
}

async function saveRow(row: WsRow) {
  const db = await getDb();
  if (!db) return;
  row.updatedAt = Date.now();
  await db.execute(sql`
    INSERT INTO wsRows (id, data, updatedAt, deleted)
    VALUES (${row.id}, ${JSON.stringify(row)}, ${row.updatedAt}, FALSE)
    ON DUPLICATE KEY UPDATE data = VALUES(data), updatedAt = VALUES(updatedAt), deleted = FALSE
  `);
}

function fieldByName(database: WsDatabase, name: string): WsField | undefined {
  return database.fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
}

function optionByPattern(field: WsField, pattern: RegExp): WsSelectOption | undefined {
  return field.options?.find((o) => pattern.test(o.name));
}

async function ensureWsField(database: WsDatabase, name: string, type: string, options?: WsSelectOption[]): Promise<WsField> {
  let field = fieldByName(database, name);
  if (!field) {
    field = { id: uid(), name, type, options, width: 140 };
    database.fields.push(field);
    await saveDatabase(database);
  }
  return field;
}

function appendNotes(row: WsRow, heading: string, text: string) {
  const doc = Array.isArray(row.doc) ? [...row.doc] : [];
  doc.push({ type: "heading", props: { level: 2 }, content: [{ type: "text", text: heading, styles: {} }] });
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    doc.push({ type: "paragraph", content: [{ type: "text", text: trimmed, styles: {} }] });
  }
  row.doc = doc;
}

// ── Cost accounting (shared with the workspace router) ─────────────────────
const PRICING: Array<{ match: RegExp; in: number; out: number }> = [
  { match: /haiku/i, in: 1, out: 5 },
  { match: /sonnet/i, in: 3, out: 15 },
  { match: /opus/i, in: 5, out: 25 },
  { match: /./, in: 3, out: 15 },
];

export function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICING.find((x) => x.match.test(model))!;
  return (tokensIn / 1e6) * p.in + (tokensOut / 1e6) * p.out;
}

export async function recordCentralCost(task: string, model: string, tokensIn: number, tokensOut: number, cost: number, context: string) {
  const url = (ENV.supabaseUrl || "https://supabase.insightprofit.live").replace(/\/$/, "");
  const key = ENV.supabaseServiceKey;
  if (!key) return;
  try {
    await fetch(`${url}/rest/v1/rpc/record_cost_event`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_agent: "elite-writer-v5-workspace",
        p_tool: task,
        p_model: model,
        p_event_type: "llm_call",
        p_input_tokens: tokensIn,
        p_output_tokens: tokensOut,
        p_cost_usd: Math.round(cost * 10000) / 10000,
        p_metadata: { context: context.slice(0, 120) },
      }),
    });
  } catch (err) {
    console.warn("[proactive] record_cost_event failed:", err instanceof Error ? err.message : err);
  }
}

/** Optional Slack alerts via incoming webhook (set SLACK_WEBHOOK_URL). */
export async function slackAlert(message: string) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message.slice(0, 3900) }),
    });
  } catch { /* alerts are best-effort */ }
}

const LEDGER_COLORS = ["purple", "teal", "blue", "orange", "green", "yellow", "pink", "gray", "red"];

async function recordLedger(taskLabel: string, model: string, tokensIn: number, tokensOut: number, cost: number, context: string) {
  const databases = await loadDatabases();
  const ledger = databases.find((d) => d.name === "AI Ledger");
  if (!ledger) return;
  const taskField = fieldByName(ledger, "Task");
  let taskOpt = taskField?.options?.find((o) => o.name === taskLabel);
  if (taskField && !taskOpt) {
    taskOpt = { id: uid(), name: taskLabel, color: LEDGER_COLORS[(taskField.options?.length ?? 0) % LEDGER_COLORS.length] };
    taskField.options = [...(taskField.options ?? []), taskOpt];
    await saveDatabase(ledger);
  }
  const v = (name: string) => fieldByName(ledger, name)?.id ?? "";
  const now = Date.now();
  await saveRow({
    id: uid(),
    dbId: ledger.id,
    values: {
      [v("Entry")]: `${taskLabel} — ${context.slice(0, 60)}`,
      [v("Task")]: taskOpt?.id ?? null,
      [v("Model")]: model.replace(/^.*\//, ""),
      [v("Tokens in")]: tokensIn,
      [v("Tokens out")]: tokensOut,
      [v("Cost")]: Math.round(cost * 10000) / 10000,
      [v("Date")]: new Date().toISOString().slice(0, 10),
    },
    sortOrder: now,
    createdAt: now,
    updatedAt: now,
  });
}

async function monthSpend(): Promise<number> {
  const databases = await loadDatabases();
  const ledger = databases.find((d) => d.name === "AI Ledger");
  if (!ledger) return 0;
  const costFieldId = fieldByName(ledger, "Cost")?.id;
  if (!costFieldId) return 0;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const rows = await loadRows(ledger.id);
  return rows
    .filter((r) => r.createdAt >= monthStart.getTime())
    .reduce((sum, r) => sum + (Number(r.values[costFieldId]) || 0), 0);
}

function budgetLimit(): number {
  return Number(process.env.WORKSPACE_AGENT_BUDGET ?? 50);
}

const HOUSE_RULES = `
House rules: US English. Concrete numbers, named sources, dates. No AI-tell phrasing ("delve", "landscape", "moreover", "in conclusion", "game-changer", rule-of-three triplets). Return ONLY the requested output in EXACTLY the requested format.`;

/** Run one LLM call with persona + budget gate + full cost accounting. */
async function agentCall(taskLabel: string, personaKey: keyof typeof AGENT_PERSONAS, model: string, prompt: string, context: string, maxTokens = 4000): Promise<string | null> {
  const spent = await monthSpend();
  const budget = budgetLimit();
  if (budget > 0 && spent >= budget) {
    console.warn(`[proactive] budget reached ($${spent.toFixed(2)}/$${budget}) — skipping ${taskLabel}`);
    void slackAlert(`⛔ Elite Writer: monthly AI budget reached ($${spent.toFixed(2)}/$${budget}). Proactive agents paused until next month or budget raise.`);
    return null;
  }
  const persona = AGENT_PERSONAS[personaKey];
  const result = await invokeLLM({
    messages: [
      { role: "system", content: persona.systemPrompt + "\n" + HOUSE_RULES },
      { role: "user", content: prompt },
    ],
    model,
    maxTokens,
  });
  const text = result.choices?.[0]?.message?.content?.trim() ?? "";
  const tokensIn = result.usage?.prompt_tokens ?? 0;
  const tokensOut = result.usage?.completion_tokens ?? 0;
  const cost = estimateCost(result.model ?? model, tokensIn, tokensOut);
  await recordLedger(taskLabel, result.model ?? model, tokensIn, tokensOut, cost, context);
  void recordCentralCost(taskLabel.toLowerCase().replace(/\s+/g, "_"), result.model ?? model, tokensIn, tokensOut, cost, context);
  return text || null;
}

async function findPipeline(): Promise<WsDatabase | null> {
  const databases = await loadDatabases();
  return (
    databases.find((d) => d.name === "Article Pipeline") ??
    databases.find((d) => d.fields.some((f) => f.name === "Status" && f.type === "select" && f.options?.some((o) => /publish/i.test(o.name)))) ??
    null
  );
}

// ── Job 1: Scout files fresh ideas ──────────────────────────────────────────
/** Scout: pull USA news, score relevance, match to the outlets whose topics fit,
 *  and file news-pegged ideas (with the matched publication linked). USA-only. */
async function fetchUsNews(): Promise<Array<{ title: string; source: string; url: string }>> {
  const out: Array<{ title: string; source: string; url: string }> = [];
  // NewsAPI — US top headlines
  if (ENV.newsapiKey) {
    try {
      const r = await fetch(`https://newsapi.org/v2/top-headlines?country=us&pageSize=40&apiKey=${ENV.newsapiKey}`);
      if (r.ok) {
        const d = await r.json();
        for (const a of d.articles ?? []) out.push({ title: a.title ?? "", source: a.source?.name ?? "", url: a.url ?? "" });
      }
    } catch { /* best effort */ }
  }
  // GNews — US English
  if (ENV.gnewsKey && out.length < 30) {
    try {
      const r = await fetch(`https://gnews.io/api/v4/top-headlines?country=us&lang=en&max=25&apikey=${ENV.gnewsKey}`);
      if (r.ok) {
        const d = await r.json();
        for (const a of d.articles ?? []) out.push({ title: a.title ?? "", source: a.source?.name ?? "", url: a.url ?? "" });
      }
    } catch { /* best effort */ }
  }
  // de-dup by title
  const seen = new Set<string>();
  return out.filter((a) => a.title && !seen.has(a.title.toLowerCase()) && seen.add(a.title.toLowerCase()));
}

async function buildPublicationIndex(): Promise<string> {
  const databases = await loadDatabases();
  const pubs = databases.find((d) => d.name === "Publications");
  if (!pubs) return "";
  const f = (n: string) => pubs.fields.find((x) => x.name.toLowerCase() === n.toLowerCase());
  const nameF = pubs.fields[0], topicsF = f("Preferred Topics") ?? f("Topics"), catF = f("Category"), payF = f("Pay Max ($)");
  const rows = await loadRows(pubs.id);
  return rows.slice(0, 200).map((r) => {
    const name = String(r.values[nameF.id] ?? "").trim();
    const topics = topicsF ? String(r.values[topicsF.id] ?? "").slice(0, 120) : "";
    const cat = catF ? String((catF.options?.find((o) => o.id === r.values[catF.id])?.name) ?? "") : "";
    const pay = payF ? Number(r.values[payF.id]) || 0 : 0;
    return name ? `${name}${cat ? ` [${cat}]` : ""}${pay ? ` ($${pay})` : ""}: ${topics}` : "";
  }).filter(Boolean).join("\n");
}

async function scoutJob() {
  if (process.env.SCOUT_ENABLED === "0") return;
  const pipeline = await findPipeline();
  if (!pipeline) return;
  const statusField = fieldByName(pipeline, "Status");
  const ideaOpt = statusField ? optionByPattern(statusField, /idea/i) : undefined;
  if (!statusField || !ideaOpt) return;

  const rows = await loadRows(pipeline.id);
  const databases = await loadDatabases();
  const ledger = databases.find((d) => d.name === "AI Ledger");
  if (ledger) {
    const recent = (await loadRows(ledger.id)).some(
      (r) => r.createdAt > Date.now() - 20 * 3600e3 && JSON.stringify(r.values).includes("Scout ideas"),
    );
    if (recent) return;
  }
  const waiting = rows.filter((r) => r.values[statusField.id] === ideaOpt.id).length;
  if (waiting >= 12) return;

  const news = await fetchUsNews();
  if (news.length === 0) { console.warn("[proactive] scout: no US news fetched (check NEWSAPI_KEY/GNEWS_KEY)"); return; }
  const pubIndex = await buildPublicationIndex();
  const nicheField = pipeline.fields.find((f) => f.name === "Niche" && f.type === "multiselect");
  const niches = process.env.SCOUT_NICHES || nicheField?.options?.map((o) => o.name).join(", ") || "Finance, Tech, Health, Business";
  const minRel = Number(process.env.SCOUT_MIN_RELEVANCE ?? 6);

  const out = await agentCall(
    "Scout ideas",
    "scout",
    "anthropic/claude-sonnet-4.6",
    `From the US news headlines below, file the 3 strongest news-pegged article ideas worth $8,000+ at premium outlets.
HARD FILTERS:
- USA audience only. Discard anything not relevant to a US readership.
- Must match these beats (the author's expertise): ${niches}.
- Each idea MUST map to a specific outlet from the OUTLET INDEX whose topics fit — only file if a named editor would plausibly accept it.
- Must be genuinely news-pegged (tie to a dated event in the headlines).

OUTLET INDEX (name [category] ($max pay): topics):
${pubIndex.slice(0, 12000)}

US HEADLINES:
${news.map((a, i) => `${i + 1}. ${a.title} (${a.source})`).join("\n").slice(0, 8000)}

Return STRICT JSON only — an array of up to 3 objects:
[{"headline": "<the article headline you'd pitch>", "peg": "<the dated news event and why now>", "niche": "<one beat from the list>", "angle": "<the unique/contrarian angle>", "publication": "<exact outlet name from the index that fits best>", "relevance": <1-10 how strongly it matches the beats + that outlet>, "peg_days": <1-21 days until the peg goes stale>}]`,
    "overnight scout run (US, matched)",
    4000,
  );
  if (!out) return;

  let ideas: Array<{ headline?: string; peg?: string; niche?: string; angle?: string; publication?: string; relevance?: number; peg_days?: number }> = [];
  try { ideas = JSON.parse(out.replace(/^```(json)?|```$/g, "").trim()); }
  catch { console.warn("[proactive] scout returned non-JSON, skipping"); return; }

  ideas = ideas.filter((i) => i.headline && (Number(i.relevance) || 0) >= minRel);
  if (ideas.length === 0) { console.log("[proactive] scout: no ideas cleared the relevance filter"); return; }

  const titleField = pipeline.fields[0];
  const pegField = fieldByName(pipeline, "News Peg");
  const expiresField = await ensureWsField(pipeline, "Peg Expires", "date");
  const relField = pipeline.fields.find((f) => f.type === "relation" && /publication|outlet/i.test(f.name));
  const pubs = databases.find((d) => d.name === "Publications");
  const pubRows = pubs ? await loadRows(pubs.id) : [];

  let filed = 0;
  for (const idea of ideas.slice(0, 3)) {
    const now = Date.now();
    const values: Record<string, unknown> = { [titleField.id]: idea.headline!, [statusField.id]: ideaOpt.id };
    if (pegField && idea.peg) values[pegField.id] = idea.peg;
    values[expiresField.id] = new Date(now + Math.max(1, Math.min(21, Number(idea.peg_days) || 7)) * 864e5).toISOString().slice(0, 10);
    if (nicheField && idea.niche) {
      const opt = nicheField.options?.find((o) => o.name.toLowerCase() === idea.niche!.toLowerCase());
      if (opt) values[nicheField.id] = [opt.id];
    }
    // Link the matched publication (relation)
    if (relField && pubs && idea.publication) {
      const match = pubRows.find((r) => String(r.values[pubs.fields[0].id] ?? "").trim().toLowerCase() === idea.publication!.trim().toLowerCase());
      if (match) values[relField.id] = [match.id];
    }
    const row: WsRow = { id: uid(), dbId: pipeline.id, values, sortOrder: now, createdAt: now, updatedAt: now };
    appendNotes(row, "Filed by Scout (Thomas Fischer)", `Matched outlet: ${idea.publication ?? "—"} (relevance ${idea.relevance ?? "?"}/10)\nAngle: ${idea.angle ?? ""}\nPeg: ${idea.peg ?? ""}`);
    await saveRow(row);
    filed++;
  }
  console.log(`[proactive] Scout filed ${filed} US-matched ideas`);
  // Ideas are actioned inside the app (Article Pipeline board) — no chat noise.
}

// ── Job 2: Scorer auto-scores new ideas ─────────────────────────────────────
async function scorerJob() {
  const pipeline = await findPipeline();
  if (!pipeline) return;
  const statusField = fieldByName(pipeline, "Status");
  if (!statusField) return;
  const earlyIds = (statusField.options ?? []).filter((o) => /idea|research/i.test(o.name)).map((o) => o.id);
  const scoreField = await ensureWsField(pipeline, "AI Score", "rating");

  const expires = fieldByName(pipeline, "Peg Expires");
  const rows = await loadRows(pipeline.id);
  const todo = rows
    .filter((r) => earlyIds.includes(r.values[statusField.id] as string) && !r.values[scoreField.id])
    .sort((a, b) => {
      const av = expires ? String(a.values[expires.id] ?? "9999") : "9999";
      const bv = expires ? String(b.values[expires.id] ?? "9999") : "9999";
      return av.localeCompare(bv); // soonest-expiring pegs first
    })
    .slice(0, 3);

  for (const row of todo) {
    const summary = pipeline.fields
      .map((f) => {
        const v = row.values[f.id];
        if (v === undefined || v === null || v === "") return null;
        if (f.type === "select") return `${f.name}: ${f.options?.find((o) => o.id === v)?.name ?? ""}`;
        if (f.type === "multiselect") return `${f.name}: ${(Array.isArray(v) ? v : []).map((id) => f.options?.find((o) => o.id === id)?.name).join(", ")}`;
        if (f.type === "image") return null;
        return `${f.name}: ${String(v).slice(0, 200)}`;
      })
      .filter(Boolean)
      .join("\n");

    const title = String(row.values[pipeline.fields[0].id] ?? "idea");
    const out = await agentCall(
      "Score idea",
      "scorer",
      "anthropic/claude-haiku-4.5",
      `Score this article idea for a premium-outlet pitch. Return EXACTLY:
SCORE: <1-10 overall>
NEWSWORTHINESS: <1-10> <one short reason>
AUDIENCE MATCH: <1-10> <one short reason>
EARNING POTENTIAL: <estimated realistic fee in USD, number only>
VERDICT: <2 sentences: pursue/park/kill and the single sharpest angle>

IDEA:
${summary}`,
      title,
      2000,
    );
    if (!out) return; // budget hit — stop the whole batch

    const score = Number(out.match(/SCORE:\s*(\d+(?:\.\d+)?)/i)?.[1] ?? 0);
    row.values[scoreField.id] = Math.max(1, Math.min(5, Math.round(score / 2)));
    const fee = Number(out.match(/EARNING POTENTIAL:\s*\$?([\d,]+)/i)?.[1]?.replace(/,/g, "") ?? 0);
    const feeField = pipeline.fields.find((f) => f.type === "currency");
    if (feeField && fee > 0 && !row.values[feeField.id]) row.values[feeField.id] = fee;
    appendNotes(row, "Auto-scored by Priya Sharma", out);
    await saveRow(row);
    console.log(`[proactive] scored "${title.slice(0, 50)}" → ${score}/10`);
  }
}

// ── Job 3: Quality Guardian gates Edit/Submitted rows ───────────────────────
async function guardianJob() {
  const pipeline = await findPipeline();
  if (!pipeline) return;
  const statusField = fieldByName(pipeline, "Status");
  if (!statusField) return;
  const gateIds = (statusField.options ?? []).filter((o) => /edit|submit/i.test(o.name)).map((o) => o.id);
  if (gateIds.length === 0) return;
  const guardianField = await ensureWsField(pipeline, "Guardian", "select", [
    { id: uid(), name: "Approved", color: "green" },
    { id: uid(), name: "Blocked", color: "red" },
  ]);

  const rows = await loadRows(pipeline.id);
  const todo = rows.filter((r) => gateIds.includes(r.values[statusField.id] as string) && !r.values[guardianField.id]).slice(0, 2);

  for (const row of todo) {
    const title = String(row.values[pipeline.fields[0].id] ?? "article");
    const notesText = Array.isArray(row.doc)
      ? (row.doc as Array<{ content?: Array<{ text?: string }> }>)
          .map((b) => (Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : ""))
          .join("\n")
          .slice(0, 8000)
      : "";

    const out = await agentCall(
      "Guardian review",
      "quality",
      "anthropic/claude-sonnet-4.6",
      `Review this article package before it goes to an editor. Return EXACTLY:
VERDICT: APPROVED or BLOCKED
Then 3-6 "- " bullets: if BLOCKED, the specific blockers (missing sourcing, weak peg, unverified claims, thin sections); if APPROVED, the remaining nice-to-haves.

TITLE: ${title}

NOTES, BRIEFS AND DRAFT MATERIAL:
${notesText || "(no notes yet — judge on the fields alone, and say so)"}`,
      title,
      2500,
    );
    if (!out) return;

    const approved = /VERDICT:\s*APPROVED/i.test(out);
    const opt = guardianField.options?.find((o) => o.name === (approved ? "Approved" : "Blocked"));
    if (opt) row.values[guardianField.id] = opt.id;
    appendNotes(row, `Quality Guardian: ${approved ? "Approved" : "Blocked"} (Elena Vasquez)`, out);
    await saveRow(row);
    console.log(`[proactive] guardian ${approved ? "approved" : "BLOCKED"} "${title.slice(0, 50)}"`);
  }
}

// ── Job 4: pitch follow-up nudges ───────────────────────────────────────────
async function followupJob() {
  try {
    const stale = await dbExec(
      "SELECT id, publicationName, editorEmail, articleTitle, sentAt FROM pitches WHERE status = 'sent' AND sentAt < DATE_SUB(NOW(), INTERVAL 4 DAY) AND sentAt > DATE_SUB(NOW(), INTERVAL 30 DAY)",
    );
    if (stale.length === 0) return;
    const lines = stale.slice(0, 8).map((piece) =>
      `• ${piece.publicationName ?? "?"} — "${String(piece.articleTitle ?? "").slice(0, 60)}" (sent ${String(piece.sentAt).slice(0, 10)})`,
    );
    void slackAlert(`✉️ ${stale.length} pitch${stale.length === 1 ? "" : "es"} awaiting reply 4+ days — time for the polite follow-up:\n${lines.join("\n")}`);
  } catch (err) {
    console.warn("[proactive] followup check failed:", err instanceof Error ? err.message : err);
  }
}

// ── Scheduler ───────────────────────────────────────────────────────────────
async function safely(name: string, job: () => Promise<void>) {
  try {
    await job();
  } catch (err) {
    console.warn(`[proactive] ${name} failed:`, err instanceof Error ? err.message : err);
  }
}

export function initProactiveAgents() {
  if (process.env.WORKSPACE_PROACTIVE === "0") {
    console.log("[proactive] disabled via WORKSPACE_PROACTIVE=0");
    return;
  }
  if (!process.env.DATABASE_URL) return;

  // First pass shortly after boot, then steady cadence
  setTimeout(() => {
    void safely("scorer", scorerJob);
    void safely("guardian", guardianJob);
    void safely("scout", scoutJob);
  }, 90_000);

  setInterval(() => {
    void safely("scorer", scorerJob);
    void safely("guardian", guardianJob);
  }, 10 * 60_000);

  setInterval(() => {
    void safely("scout", scoutJob);
  }, 60 * 60_000);

  setInterval(() => {
    void safely("followup", followupJob);
  }, 12 * 3600_000);

  console.log("[proactive] agent loop armed: scout (≤1/20h), scorer + guardian (every 10m), budget $" + budgetLimit() + "/mo");
}
