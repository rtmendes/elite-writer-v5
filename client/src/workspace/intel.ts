// ── Workspace intelligence actions ─────────────────────────────────────────
// Score ideas, build research briefs (live Perplexity sources, server-side),
// match against the real publications database, draft offers. Personas and
// outlet data are injected server-side; results write back into the row's
// fields and notes doc so every agent output is sortable and chartable.
import { runTask } from "./agent";
import { createRow, db, makeView, uid, updateDatabase, updateRow } from "./db";
import { enqueue } from "./sync";
import { autoFillFeeFromPublication } from "./finance";
import { PUBLICATIONS } from "./publications-data";
import type { Database, Field, Row, SelectOption } from "./types";

const opt = (name: string, color: string): SelectOption => ({ id: uid(), name, color });

// ── Idempotent seeding of the intelligence databases ───────────────────────
// Single-flight: React StrictMode double-mounts the boot effect, which would
// otherwise seed each database twice before the kv flag is written.
let intelPromise: Promise<void> | null = null;
export function ensureIntelligence(): Promise<void> {
  if (!intelPromise) intelPromise = doEnsureIntelligence();
  return intelPromise;
}
async function doEnsureIntelligence() {
  await ensurePublications();
  if (await db.kv.get("seed:ledger")) {
    await ensureClaimLedger();
    return;
  }
  const exists = (await db.databases.toArray()).some((d) => d.name === "AI Ledger");
  if (!exists) {
    const now = Date.now();
    const taskOptions = ["Score idea", "Match publications", "Research brief", "Create offer", "Humanize", "Tighten", "Expand", "Headlines", "Continue draft"]
      .map((n, i) => ({ id: uid(), name: n, color: ["purple", "teal", "blue", "orange", "green", "yellow", "pink", "gray", "red"][i] }));
    const fields: Field[] = [
      { id: uid(), name: "Entry", type: "text", width: 300 },
      { id: uid(), name: "Task", type: "select", options: taskOptions, width: 160 },
      { id: uid(), name: "Model", type: "text", width: 130 },
      { id: uid(), name: "Tokens in", type: "number", width: 110 },
      { id: uid(), name: "Tokens out", type: "number", width: 110 },
      { id: uid(), name: "Cost", type: "currency", width: 100 },
      { id: uid(), name: "Date", type: "date", width: 120 },
    ];
    const database: Database = {
      id: uid(),
      name: "AI Ledger",
      icon: "🧾",
      description: "Every workspace AI call: task, model, tokens, cost. Chart it with /chart on any page.",
      fields,
      views: [makeView("table", "All Calls")],
      createdAt: now,
      updatedAt: now,
    };
    await db.databases.add(database);
    void enqueue("databases", database.id, "upsert");
  }
  await db.kv.put({ key: "seed:ledger", value: true });
  await ensureClaimLedger();
}

// ── Publications: rich, fully-editable outlet intelligence ─────────────────
// Fields mirror the legacy database (category, traffic, pay, preferred topics,
// best editors, submission info, application form, pitch difficulty, status,
// notes). You can edit any cell, add fields, and add rows like any database.
// The v2 migration UPGRADES an existing thin Publications table in place:
// it adds missing fields, backfills empty cells, and inserts new outlets —
// never overwriting anything you've already edited.
const PUB_FIELD_DEFS: Array<{ key: string; name: string; type: Field["type"]; width: number }> = [
  { key: "name", name: "Publication", type: "text", width: 220 },
  { key: "logo", name: "Logo", type: "image", width: 90 },
  { key: "category", name: "Category", type: "select", width: 150 },
  { key: "website", name: "Website", type: "url", width: 180 },
  { key: "traffic", name: "Monthly Traffic", type: "text", width: 150 },
  { key: "pay", name: "Pay Range", type: "text", width: 170 },
  { key: "payMax", name: "Pay Max ($)", type: "currency", width: 120 },
  { key: "topics", name: "Preferred Topics", type: "longtext", width: 300 },
  { key: "editors", name: "Best Editors to Pitch", type: "longtext", width: 300 },
  { key: "writingStyle", name: "Writing Style", type: "longtext", width: 320 },
  { key: "editorStyle", name: "Editor's Style", type: "longtext", width: 320 },
  { key: "editorLikes", name: "What Editor Likes", type: "longtext", width: 320 },
  { key: "targetAudience", name: "Target Audience", type: "longtext", width: 280 },
  { key: "payArticle", name: "Pay Rate (Article)", type: "text", width: 150 },
  { key: "projection", name: "Projection $", type: "currency", width: 120 },
  { key: "wordCount", name: "Word Count", type: "number", width: 110 },
  { key: "editorName", name: "Editor Name", type: "text", width: 180 },
  { key: "editorEmail", name: "Editor Email", type: "text", width: 200 },
  { key: "writingInstruction", name: "Writing Instruction", type: "longtext", width: 320 },
  { key: "styleGuide", name: "Style Guide", type: "longtext", width: 240 },
  { key: "suggestedTypes", name: "Suggested Article Types", type: "longtext", width: 260 },
  { key: "doNotWrite", name: "Do NOT Write", type: "longtext", width: 240 },
  { key: "columnIdea", name: "Column Idea", type: "longtext", width: 260 },
  { key: "classification", name: "Classification", type: "text", width: 150 },
  { key: "tier", name: "Tier", type: "text", width: 200 },
  { key: "submission", name: "Submission Info", type: "longtext", width: 300 },
  { key: "applicationForm", name: "Application Form", type: "url", width: 200 },
  { key: "difficulty", name: "Pitch Difficulty", type: "rating", width: 130 },
  { key: "status", name: "Status", type: "select", width: 150 },
  { key: "notes", name: "Notes", type: "longtext", width: 260 },
];

function buildPubFields(): { fields: Field[]; byKey: Map<string, Field> } {
  const byKey = new Map<string, Field>();
  const fields = PUB_FIELD_DEFS.map((def) => {
    const f: Field = { id: uid(), name: def.name, type: def.type, width: def.width };
    if (def.key === "category") {
      const cats = [...new Set(PUBLICATIONS.map((p) => p.category).filter(Boolean))] as string[];
      const colors = ["blue", "green", "purple", "orange", "teal", "pink", "red", "yellow", "gray"];
      f.options = cats.slice(0, 30).map((c, i) => opt(c, colors[i % colors.length]));
    }
    if (def.key === "status") {
      f.options = [opt("Not pitched", "gray"), opt("Researching", "purple"), opt("Pitched", "blue"), opt("Accepted", "green"), opt("Rejected", "red")];
    }
    byKey.set(def.key, f);
    return f;
  });
  return { fields, byKey };
}

function pubRowValues(p: (typeof PUBLICATIONS)[number], byKey: Map<string, Field>): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const def of PUB_FIELD_DEFS) {
    const field = byKey.get(def.key)!;
    const raw = (p as unknown as Record<string, unknown>)[def.key];
    if (def.key === "category" && raw) {
      v[field.id] = field.options?.find((o) => o.name === raw)?.id ?? null;
    } else if (def.key === "status") {
      v[field.id] = field.options?.[0].id ?? null; // Not pitched
    } else if (raw !== undefined && raw !== null && raw !== "") {
      v[field.id] = raw;
    }
  }
  return v;
}

async function ensurePublications() {
  const existing = (await db.databases.toArray()).find((d) => d.name === "Publications");

  // Fresh install: build the full rich database
  if (!existing) {
    if (await db.kv.get("seed:publications:v4")) return;
    const now = Date.now();
    const { fields, byKey } = buildPubFields();
    const database: Database = {
      id: uid(),
      name: "Publications",
      icon: "🏛️",
      description: `${PUBLICATIONS.length} outlets that pay — category, traffic, pay range, preferred topics, best editors to pitch, submission info. Fully editable: change any cell, add fields, add outlets.`,
      fields,
      views: [
        { ...makeView("table", "All Outlets"), sorts: [{ fieldId: byKey.get("payMax")!.id, dir: "desc" }] },
        { ...makeView("kanban", "By Status"), groupBy: byKey.get("status")!.id },
        { ...makeView("gallery", "Cards"), thumbnailField: byKey.get("logo")!.id },
      ],
      createdAt: now,
      updatedAt: now,
    };
    await db.databases.add(database);
    void enqueue("databases", database.id, "upsert");
    let order = now;
    for (const p of PUBLICATIONS) {
      const row: Row = { id: uid(), dbId: database.id, values: pubRowValues(p, byKey), sortOrder: order++, createdAt: now, updatedAt: now };
      await db.rows.add(row);
      void enqueue("rows", row.id, "upsert");
    }
    await db.kv.put({ key: "seed:publications:v4", value: true });
    return;
  }

  // Upgrade path: a thin Publications table already exists (the 4-field seed).
  // Add missing fields, backfill empty cells, add new outlets — non-destructive.
  if (await db.kv.get("seed:publications:v4")) return;
  const fresh = (await db.databases.get(existing.id))!;
  const fieldByName = new Map(fresh.fields.map((f) => [f.name.toLowerCase(), f]));
  const addedFields: Field[] = [];
  const keyToField = new Map<string, Field>();
  for (const def of PUB_FIELD_DEFS) {
    let field = fieldByName.get(def.name.toLowerCase());
    if (!field) {
      const fb = buildPubFields().byKey.get(def.key)!;
      field = { ...fb, id: uid() };
      addedFields.push(field);
    }
    keyToField.set(def.key, field);
  }
  if (addedFields.length > 0) {
    await updateDatabase(fresh.id, { fields: [...fresh.fields, ...addedFields] });
  }

  const rows = await db.rows.where("dbId").equals(fresh.id).toArray();
  const titleFieldId = fresh.fields[0].id;
  const byNameRow = new Map(rows.map((r) => [String(r.values[titleFieldId] ?? "").trim().toLowerCase(), r]));
  let order = Date.now();
  for (const p of PUBLICATIONS) {
    const match = byNameRow.get(p.name.toLowerCase());
    const richValues = pubRowValues(p, keyToField);
    if (match) {
      // backfill empty cells only — preserve any edits
      const merged = { ...match.values };
      let changed = false;
      for (const [fid, val] of Object.entries(richValues)) {
        if (merged[fid] === undefined || merged[fid] === null || merged[fid] === "") {
          merged[fid] = val;
          changed = true;
        }
      }
      if (changed) await updateRow(match.id, { values: merged });
    } else {
      await createRow(fresh.id, richValues);
      order++;
    }
  }
  await db.kv.put({ key: "seed:publications:v4", value: true });
}

async function ensureClaimLedger() {
  if (await db.kv.get("seed:claims")) return;
  const exists = (await db.databases.toArray()).some((d) => d.name === "Claim Ledger");
  if (!exists) {
    const now = Date.now();
    const fields: Field[] = [
      { id: uid(), name: "Claim", type: "longtext", width: 340 },
      { id: uid(), name: "Article", type: "text", width: 220 },
      { id: uid(), name: "Status", type: "select", width: 130, options: [
        { id: uid(), name: "Verified", color: "green" },
        { id: uid(), name: "TK", color: "yellow" },
        { id: uid(), name: "Disputed", color: "red" },
      ] },
      { id: uid(), name: "Source", type: "url", width: 240 },
      { id: uid(), name: "Note", type: "text", width: 260 },
      { id: uid(), name: "Date", type: "date", width: 120 },
    ];
    const database: Database = {
      id: uid(),
      name: "Claim Ledger",
      icon: "✅",
      description: "Every factual claim, its verification status, and its source. Filter Status=TK for the reporting to-do list.",
      fields,
      views: [makeView("table", "All Claims"), { ...makeView("kanban", "By Status"), groupBy: fields[2].id }],
      createdAt: now,
      updatedAt: now,
    };
    await db.databases.add(database);
    void enqueue("databases", database.id, "upsert");
  }
  await db.kv.put({ key: "seed:claims", value: true });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function rowSummary(database: Database, row: Row): string {
  return database.fields
    .map((f) => {
      const v = row.values[f.id];
      if (v === undefined || v === null || v === "") return null;
      if (f.type === "select") return `${f.name}: ${f.options?.find((o) => o.id === v)?.name ?? ""}`;
      if (f.type === "multiselect")
        return `${f.name}: ${(Array.isArray(v) ? v : []).map((id) => f.options?.find((o) => o.id === id)?.name).join(", ")}`;
      if (f.type === "image") return null;
      return `${f.name}: ${String(v).slice(0, 200)}`;
    })
    .filter(Boolean)
    .join("\n");
}

async function ensureField(database: Database, name: string, type: Field["type"]): Promise<Field> {
  const fresh = (await db.databases.get(database.id))!;
  let field = fresh.fields.find((f) => f.name === name);
  if (!field) {
    field = { id: uid(), name, type, width: 120 };
    await updateDatabase(fresh.id, { fields: [...fresh.fields, field] });
  }
  return field;
}

/** Append plain text to a row's notes doc as BlockNote blocks. */
async function appendToNotes(row: Row, heading: string, text: string) {
  const fresh = (await db.rows.get(row.id))!;
  const doc = Array.isArray(fresh.doc) ? [...fresh.doc] : [];
  doc.push({ type: "heading", props: { level: 2 }, content: [{ type: "text", text: heading, styles: {} }] });
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("## ")) {
      doc.push({ type: "heading", props: { level: 3 }, content: [{ type: "text", text: trimmed.slice(3), styles: {} }] });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      doc.push({ type: "bulletListItem", content: [{ type: "text", text: trimmed.slice(2), styles: {} }] });
    } else {
      doc.push({ type: "paragraph", content: [{ type: "text", text: trimmed, styles: {} }] });
    }
  }
  await updateRow(row.id, { doc });
}

// ── Actions ────────────────────────────────────────────────────────────────
export async function scoreIdea(database: Database, row: Row): Promise<string> {
  const summary = rowSummary(database, row);
  const out = await runTask(
    "score_idea",
    `Score this article idea for a premium-outlet pitch. Return EXACTLY this format:
SCORE: <1-10 overall>
NEWSWORTHINESS: <1-10> <one short reason>
AUDIENCE MATCH: <1-10> <one short reason>
EARNING POTENTIAL: <estimated realistic fee in USD, number only>
VERDICT: <2 sentences: pursue/park/kill and the single sharpest angle>

IDEA:
${summary}`,
    String(row.values[database.fields[0].id] ?? "idea"),
  );

  const score = Number(out.match(/SCORE:\s*(\d+(?:\.\d+)?)/i)?.[1] ?? 0);
  const fee = Number(out.match(/EARNING POTENTIAL:\s*\$?([\d,]+)/i)?.[1]?.replace(/,/g, "") ?? 0);
  const scoreField = await ensureField(database, "AI Score", "rating");
  const patch: Record<string, unknown> = { [scoreField.id]: Math.max(1, Math.min(5, Math.round(score / 2))) };
  const feeField = (await db.databases.get(database.id))!.fields.find((f) => f.type === "currency");
  if (feeField && fee > 0 && !row.values[feeField.id]) patch[feeField.id] = fee;
  const fresh = (await db.rows.get(row.id))!;
  await updateRow(row.id, { values: { ...fresh.values, ...patch } });
  await appendToNotes(row, "Idea score", out);
  return out;
}

export async function researchBrief(database: Database, row: Row): Promise<string> {
  const summary = rowSummary(database, row);
  const out = await runTask(
    "research_brief",
    `Build a research brief that gets this article to publishable, $10k-caliber depth. Ground every section in the live research context appended below (cite its sources). Return in this structure (plain text, use "- " bullets):
## Working thesis
## News peg and timing
## 5 data points to verify (name the likely primary source for each)
## 4 expert voices to contact (role/title, why them)
## Counterarguments to pre-empt
## Reporting plan (ordered steps)

IDEA:
${summary}`,
    String(row.values[database.fields[0].id] ?? "brief"),
  );
  await appendToNotes(row, "Research brief", out);
  return out;
}

export async function matchPublications(database: Database, row: Row): Promise<string> {
  const summary = rowSummary(database, row);
  // The server appends the live outlet database (174+ publications) to this prompt.
  const out = await runTask(
    "match_publications",
    `Match this article idea to the 3 best-fit outlets from the outlet database appended below. Return EXACTLY:
BEST: <outlet name>
For each of the 3 matches:
## <rank>. <outlet name> — <expected fee>
- Why it fits their audience
- The angle to pitch them specifically

IDEA:
${summary}`,
    String(row.values[database.fields[0].id] ?? "match"),
  );

  const best = out.match(/BEST:\s*(.+)/i)?.[1]?.trim();
  if (best) {
    const pubField = (await db.databases.get(database.id))!.fields.find((f) => f.name.toLowerCase().includes("publication") && f.type === "text");
    if (pubField) {
      const fresh = (await db.rows.get(row.id))!;
      if (!fresh.values[pubField.id]) await updateRow(row.id, { values: { ...fresh.values, [pubField.id]: best } });
    }
  }
  await appendToNotes(row, "Publication matches", out);
  await autoFillFeeFromPublication(database, row); // pull pay rate → Fee
  return out;
}

export async function createOffer(database: Database, row: Row): Promise<string> {
  const fresh = (await db.rows.get(row.id))!;
  const summary = rowSummary(database, fresh);
  const notes = Array.isArray(fresh.doc)
    ? (fresh.doc as Array<{ content?: Array<{ text?: string }> }>)
        .map((b) => (Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : ""))
        .join("\n")
        .slice(0, 6000)
    : "";
  const out = await runTask(
    "create_offer",
    `Write the pitch/offer package for this article. Return in this structure:
## Subject line (for the pitch email)
## Pitch email (under 180 words, to the target editor, news peg up front, why me, why now)
## Deliverables offered (word count, data viz, sidebar, images — as "- " bullets)
## Fee ask and fallback position

IDEA AND FIELDS:
${summary}

EXISTING NOTES AND BRIEFS:
${notes}`,
    String(fresh.values[database.fields[0].id] ?? "offer"),
  );
  await appendToNotes(fresh, "Pitch offer", out);
  return out;
}

// ── Fact verification (the integrity layer) ────────────────────────────────
export async function verifyFacts(database: Database, row: Row): Promise<string> {
  const fresh = (await db.rows.get(row.id))!;
  const title = String(fresh.values[database.fields[0].id] ?? "article");
  const notesText = Array.isArray(fresh.doc)
    ? (fresh.doc as Array<{ content?: Array<{ text?: string }> }>)
        .map((b) => (Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : ""))
        .join("\n")
    : "";
  if (notesText.trim().length < 20) throw new Error("Not enough draft material in the notes to verify — write or generate something first.");

  const { wsTrpc } = await import("./trpcClient");
  const result = await wsTrpc.workspace.verifyFacts.mutate({ text: notesText.slice(0, 38000), context: title });

  // Record into the Claim Ledger database
  const claimDb = (await db.databases.toArray()).find((d) => d.name === "Claim Ledger");
  if (claimDb && result.claims.length > 0) {
    const f = (name: string) => claimDb.fields.find((x) => x.name === name);
    const statusField = f("Status");
    for (const c of result.claims) {
      const opt = statusField?.options?.find((o) => o.name === c.status) ?? statusField?.options?.find((o) => o.name === "TK");
      const { createRow } = await import("./db");
      await createRow(claimDb.id, {
        [f("Claim")?.id ?? ""]: c.claim,
        [f("Article")?.id ?? ""]: title,
        [statusField?.id ?? ""]: opt?.id ?? null,
        [f("Source")?.id ?? ""]: c.source || "",
        [f("Note")?.id ?? ""]: c.note || "",
        [f("Date")?.id ?? ""]: new Date().toISOString().slice(0, 10),
      });
    }
  }

  const lines = result.claims.map((c) => `- [${c.status}] ${c.claim}${c.source ? ` — ${c.source}` : ""}`).join("\n");
  await appendToNotes(fresh, "Claim verification (Raj Patel)", `${result.summary}\n${lines}`);

  return result.summary;
}

// ── Tournament drafting ─────────────────────────────────────────────────────
export async function tournamentDraft(database: Database, row: Row): Promise<string> {
  const fresh = (await db.rows.get(row.id))!;
  const title = String(fresh.values[database.fields[0].id] ?? "article");
  const summary = rowSummary(database, fresh);
  const notesText = Array.isArray(fresh.doc)
    ? (fresh.doc as Array<{ content?: Array<{ text?: string }> }>)
        .map((b) => (Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : ""))
        .join("\n")
        .slice(0, 12000)
    : "";

  const { wsTrpc } = await import("./trpcClient");
  const result = await wsTrpc.workspace.tournamentDraft.mutate({
    brief: `${summary}\n\nRESEARCH AND NOTES:\n${notesText}`,
    context: title,
  });

  await appendToNotes(fresh, `Tournament draft — winner ${result.winnerLabel} (Sofia Andersson × 2, judged by Priya Sharma)`,
    `${result.judge}\n\n${result.winner}`);
  return `Draft ${result.winnerLabel} won. Opening added to notes ($${result.cost.toFixed(3)}).`;
}

// ── Article assembly line ───────────────────────────────────────────────────
// Status field is the live pipeline. Each stage has an agent action; the
// workflow can pause at Outline (interactive AI suggestions) or auto-proceed.
export const WORKFLOW_STAGES = ["Idea", "Research", "Outline", "Draft", "Edit", "Submit"] as const;

function notesText(row: Row): string {
  return Array.isArray(row.doc)
    ? (row.doc as Array<{ content?: Array<{ text?: string }> }>)
        .map((b) => (Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : ""))
        .join("\n")
    : "";
}

function sectionText(row: Row, heading: RegExp): string {
  const blocks = Array.isArray(row.doc) ? (row.doc as Array<{ type?: string; content?: Array<{ text?: string }> }>) : [];
  const tx = (b: { content?: Array<{ text?: string }> }) => (Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : "");
  let start = -1;
  blocks.forEach((b, i) => { if (b.type === "heading" && heading.test(tx(b))) start = i; });
  if (start === -1) return "";
  let out = "";
  for (let i = start + 1; i < blocks.length; i++) {
    if (blocks[i].type === "heading") break;
    out += tx(blocks[i]) + "\n";
  }
  return out.trim();
}

function targetPublication(database: Database, row: Row): string {
  const f = database.fields.find((x) => x.name.toLowerCase().includes("publication") && x.type === "text");
  return f ? String(row.values[f.id] ?? "") : "";
}

/** Markdown → BlockNote blocks (## heading, - bullet, paragraph). */
function mdToBlocks(md: string): unknown[] {
  const blocks: unknown[] = [];
  for (const line of md.split(/\n+/)) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("## ")) blocks.push({ type: "heading", props: { level: 2 }, content: [{ type: "text", text: t.slice(3), styles: {} }] });
    else if (t.startsWith("# ")) blocks.push({ type: "heading", props: { level: 1 }, content: [{ type: "text", text: t.slice(2), styles: {} }] });
    else if (t.startsWith("- ") || t.startsWith("• ")) blocks.push({ type: "bulletListItem", content: [{ type: "text", text: t.slice(2), styles: {} }] });
    else blocks.push({ type: "paragraph", content: [{ type: "text", text: t, styles: {} }] });
  }
  return blocks;
}

async function setStatus(database: Database, row: Row, stageName: string) {
  const statusField = database.fields.find((f) => f.name.toLowerCase() === "status" && f.type === "select");
  if (!statusField) return;
  const opt = statusField.options?.find((o) => o.name.toLowerCase().includes(stageName.toLowerCase()));
  if (opt) {
    const fresh = (await db.rows.get(row.id))!;
    await updateRow(row.id, { values: { ...fresh.values, [statusField.id]: opt.id } });
  }
}


/** Look up the target publication's style + editor preferences from the
 *  Publications database, so drafts match its voice WITHOUT re-researching. */
async function publicationStyleBrief(pubName: string): Promise<string> {
  if (!pubName) return "";
  const pubsDb = (await db.databases.toArray()).find((d) => d.name === "Publications");
  if (!pubsDb) return "";
  const nameField = pubsDb.fields[0];
  const rows = await db.rows.where("dbId").equals(pubsDb.id).toArray();
  const match = rows.find((r) => String(r.values[nameField.id] ?? "").trim().toLowerCase() === pubName.trim().toLowerCase());
  if (!match) return "";
  const get = (fname: string) => {
    const f = pubsDb.fields.find((x) => x.name.toLowerCase() === fname.toLowerCase());
    return f ? String(match.values[f.id] ?? "").trim() : "";
  };
  const parts: string[] = [];
  const ws = get("Writing Style"); if (ws) parts.push(`WRITING STYLE: ${ws}`);
  const es = get("Editor's Style"); if (es) parts.push(`EDITOR'S STYLE: ${es}`);
  const el = get("What Editor Likes"); if (el) parts.push(`WHAT THIS EDITOR LIKES: ${el}`);
  const ta = get("Target Audience"); if (ta) parts.push(`TARGET AUDIENCE: ${ta}`);
  const wi = get("Writing Instruction"); if (wi) parts.push(`WRITING INSTRUCTION: ${wi}`);
  const sg = get("Style Guide"); if (sg) parts.push(`STYLE GUIDE: ${sg}`);
  const sat = get("Suggested Article Types"); if (sat) parts.push(`PREFERRED ARTICLE TYPES: ${sat}`);
  const dnw = get("Do NOT Write"); if (dnw) parts.push(`DO NOT WRITE: ${dnw}`);
  return parts.length ? `\n\nMATCH THIS PUBLICATION'S HOUSE STYLE (do not re-research — use this):\n${parts.join("\n")}` : "";
}

export async function buildOutline(database: Database, row: Row): Promise<string> {
  const fresh = (await db.rows.get(row.id))!;
  const styleBrief = await publicationStyleBrief(targetPublication(database, fresh));
  const brief = rowSummary(database, fresh) + "\n\nRESEARCH:\n" + notesText(fresh).slice(0, 8000) + styleBrief;
  const { wsTrpc } = await import("./trpcClient");
  const res = await wsTrpc.workspace.buildOutline.mutate({ brief: brief.slice(0, 38000), publication: targetPublication(database, fresh), context: String(fresh.values[database.fields[0].id] ?? "") });
  await appendToNotes(fresh, "Outline", res.text);
  await setStatus(database, fresh, "outline");
  return res.text;
}

export async function getOutlineSuggestions(_database: Database, row: Row): Promise<Array<{ area: string; suggestion: string }>> {
  const fresh = (await db.rows.get(row.id))!;
  const outline = sectionText(fresh, /outline/i) || notesText(fresh).slice(0, 8000);
  if (!outline) throw new Error("Build the outline first.");
  const { wsTrpc } = await import("./trpcClient");
  const res = await wsTrpc.workspace.outlineSuggestions.mutate({ outline, context: String(fresh.values[_database.fields[0].id] ?? "") });
  return res.suggestions;
}

export async function writeFullArticle(database: Database, row: Row, accepted: string[] = []): Promise<string> {
  const fresh = (await db.rows.get(row.id))!;
  const outline = sectionText(fresh, /outline/i);
  if (!outline) throw new Error("Build and approve an outline first.");
  const styleBrief = await publicationStyleBrief(targetPublication(database, fresh));
  const research = (sectionText(fresh, /research brief/i) || notesText(fresh).slice(0, 8000)) + styleBrief;
  const { wsTrpc } = await import("./trpcClient");
  const res = await wsTrpc.workspace.writeFullDraft.mutate({
    outline, research: research.slice(0, 38000), publication: targetPublication(database, fresh), accepted, context: String(fresh.values[database.fields[0].id] ?? ""),
  });
  // The full draft becomes the article body at the TOP of the editor; keep prior notes below a divider.
  const priorDoc = Array.isArray(fresh.doc) ? fresh.doc : [];
  const draftBlocks = [
    { type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Draft", styles: {} }] },
    ...mdToBlocks(res.text),
    { type: "paragraph", content: [{ type: "text", text: "— research & workflow notes below —", styles: { italic: true } }] },
  ];
  await updateRow(row.id, { doc: [...draftBlocks, ...priorDoc] });
  await setStatus(database, fresh, "edit");
  return `Full draft written ($${res.cost.toFixed(3)}) — now in the editor. Status → Edit. Your turn to refine.`;
}
