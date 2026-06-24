/**
 * Workspace Router — Notion/Airtable-style workspace module.
 *
 * 1. Sync: pull/push for wsPages/wsDatabases/wsRows (LWW by updatedAt, tombstone deletes).
 *    The client keeps a Dexie cache and an outbox; this is its server counterpart.
 * 2. runAgent: every workspace AI action runs server-side through invokeLLM
 *    (OpenRouter-first routing, server env keys), reusing the editorial agent
 *    personas, enriching research with live Perplexity, matching against the
 *    real publications table, and recording cost into the central
 *    record_cost_event system on Supabase.
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { ENV } from "../_core/env";
import { invokeLLM, TIER } from "../_core/llm";
import { skillBlockFor } from "../_core/skills";
import { uploadDataUrl } from "../_core/storage";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { AGENT_PERSONAS } from "./agents";
import { PUBLICATION_INTEL, getPublicationIntel, intelKeywords } from "../../shared/publication-intelligence";
import { estimateCost, recordCentralCost } from "../_core/proactiveAgents";

const SYNC_TABLES = { pages: "wsPages", databases: "wsDatabases", rows: "wsRows" } as const;
type SyncTable = keyof typeof SYNC_TABLES;

let tablesEnsured = false;
async function ensureTables() {
  if (tablesEnsured) return;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const table of Object.values(SYNC_TABLES)) {
    await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`${table}\` (
      id VARCHAR(32) PRIMARY KEY,
      data JSON NOT NULL,
      updatedAt BIGINT NOT NULL DEFAULT 0,
      deleted BOOLEAN NOT NULL DEFAULT FALSE,
      INDEX idx_${table}_updated (updatedAt)
    )`));
  }
  // Scale fix: promote rows.dbId to an indexed generated column so per-database
  // queries filter in SQL (O(log n)) instead of scanning + filtering in JS.
  // Idempotent — ignore "duplicate column/key" once applied.
  try {
    await db.execute(sql.raw(
      "ALTER TABLE `wsRows` ADD COLUMN `dbId` VARCHAR(40) " +
      "GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(`data`, '$.dbId'))) STORED, " +
      "ADD INDEX `idx_wsRows_dbId` (`dbId`)",
    ));
  } catch { /* already migrated */ }
  tablesEnsured = true;
}

// ── Agent task definitions ──────────────────────────────────────────────────
const TASKS = ["score_idea", "research_brief", "match_publications", "create_offer", "humanize", "tighten", "expand", "headlines", "continue", "proofread"] as const;
type AgentTask = (typeof TASKS)[number];

// Cheapest capable model per task (OpenRouter slugs; invokeLLM routes them).
// House policy: ALL tasks ride FREE models — quality comes from the expert
// SOPs ("Agent Skills & SOPs" database) injected into every system prompt.
// Long-form prose rides freeBig (550B, 1M ctx); invokeLLM's free-fallback
// ladder degrades to haiku cents only if the whole free pool is busy.
const TASK_MODELS: Record<AgentTask, { model: string; maxTokens: number; persona?: keyof typeof AGENT_PERSONAS }> = {
  score_idea: { model: TIER.free, maxTokens: 2000, persona: "scorer" },
  match_publications: { model: TIER.free, maxTokens: 3000, persona: "analyst" },
  research_brief: { model: TIER.freeBig, maxTokens: 8000, persona: "deepresearch" },
  create_offer: { model: TIER.freeBig, maxTokens: 8000, persona: "editor" },
  humanize: { model: TIER.freeBig, maxTokens: 32000, persona: "rewriter" },
  tighten: { model: TIER.freeBig, maxTokens: 32000, persona: "editor" },
  expand: { model: TIER.freeBig, maxTokens: 32000, persona: "drafter" },
  headlines: { model: TIER.free, maxTokens: 4000, persona: "outliner" },
  continue: { model: TIER.freeBig, maxTokens: 32000, persona: "continuator" },
  proofread: { model: TIER.free, maxTokens: 6000, persona: "proofreader" },
};




// Distilled from the "Large Publications Master Guide" — the house methodology.

// Real winning-pitch structure, distilled from the master guide's accepted examples.
const WINNING_PITCHES = `
WINNING PITCH EXEMPLARS (match this shape — these got accepted at major outlets):

Subject: Pitch: 300-pound traveler essay
Body: "Hello {editor}, I'm responding to your {outlet} {section} call for pitches. My pitches are below. I'm the author of four books and a freelance writer published in CNET, Fortune, Forbes, Business Insider, SUCCESS, Parents, Travel & Leisure, and sixty other outlets. Cheers, {name}"
Then 1-2 article ideas, each:
  "{specific scroll-stopping headline}
  {2-4 sentences: the personal/news hook, what the piece covers, the concrete takeaways and sources}."
Then 3-5 relevant clips with outlet names.

Column pitch shape (Tier 5): open with rapport → one-paragraph bio + bestselling/credibility → 3-4 writing samples (headline + outlet) → COLUMN IDEA = a "swim lane" (who you help + transformation) + a stat + why it drives page views + the article types it will run → 3 concrete article ideas with premises.

Always: identifiable success peg, named sources, concrete numbers, and a soft tie back to the author's expertise/offer.`;

const PLAYBOOK = `
PITCHING & WRITING PLAYBOOK (follow this method):
- PUBLICATION FIRST: match the target outlet's headline structure, article types, and tone exactly. Never generic; write for THEM.
- SUCCESS PEG (required on every idea): answer "why is this relevant right now?" with at least one of — a concrete success metric, a news peg, a trending-topic tie-in, a relatable everyday story, or a big-name tie-in.
- HEADLINES: lead with a concrete, scroll-stopping, identifiable metric or hook the average reader relates to (e.g. "I run an 8-figure biscuit business that started as a side gig"). The number/specific is the hook, not the abstract topic.
- PITCH SUBJECT LINE: exactly "Pitch: <a few words from the idea>" — lowercase, 10 words max, NO period, never "I can help / this can help".
- PITCH BODY: 1-2 line intro → brief credibility (where you've been published) → 2-3 article pitch ideas, each = a headline + a 2-4 sentence premise (the story, what it covers, sources you'd use) → a few relevant clips.
- TIERS: Tier 1-3 (open applications, editor calls, direct pitches) win on the IDEA alone — no expert proof needed. Tier 4-5 (assigned articles, columns) require social proof + expertise + a column hook.
- COLUMN HOOK: a clear "swim lane" (who you help + the transformation), why the column drives page views, and a slate of article ideas (how-to, reported features, news rewrites, success stories).
- FOLLOW-UP: four follow-ups, seven business days apart; the third adds two fresh pitch ideas.
- FUNNEL: every article builds the author as a recurring columnist authority and ties softly to a backend offer.`;

const AUTHORITY_FUNNEL = `
This article is a $10,000-caliber feature for a premium outlet AND a node in the author's
authority funnel. Every piece must:
- Open a genuinely fresh angle — a non-obvious observation, contrarian read, or under-reported pattern.
- Carry hard specifics: named sources, dated events, concrete numbers, primary data.
- Deliver actionable value the reader can use immediately.
- Build the author as a columnist authority (a recurring expert voice that outlet would want again).
- Weave ONE soft, non-salesy tie-in to a backend offer (framework, tool, consult, or resource) the
  way top columnists do — value-first, never an ad. If the offer is unknown, insert [OFFER TIE-IN: ...].
- Match the target publication's register and the editor's known preferences when provided.`;

const HOUSE_RULES = `
House rules (always apply):
- US English only. Concrete numbers, named sources, dates.
- NEVER use AI-tell phrases: "delve", "landscape", "tapestry", "in today's fast-paced world", "it's important to note", "moreover", "furthermore", "in conclusion", "game-changer", "unlock", "leverage" (as a verb), "navigate the complexities", or rule-of-three triplet sentences.
- Return ONLY the requested output. No preamble, no markdown fences. Follow the requested format EXACTLY.`;

async function fetchPerplexityContext(query: string): Promise<string> {
  if (!ENV.perplexityApiKey) return "";
  try {
    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.perplexityApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        max_tokens: 2000,
        messages: [
          { role: "system", content: "You are a research assistant. Provide current, well-sourced facts: specific data points, dates, named sources, expert names, and citations. Dense and factual." },
          { role: "user", content: query },
        ],
      }),
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const citations: string[] = data?.citations ?? [];
    return text + (citations.length ? `\n\nSOURCES:\n${citations.map((c, i) => `[${i + 1}] ${c}`).join("\n")}` : "");
  } catch {
    return "";
  }
}

/** Outcome learning: per-outlet pitch history (accepted/rejected/no_response). */
async function fetchPitchHistory(): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";
    const rows = await db.execute(sql.raw(
      "SELECT publicationName, status, COUNT(*) as n FROM pitches WHERE publicationName IS NOT NULL GROUP BY publicationName, status",
    ));
    const list = (rows as unknown as [Array<Record<string, unknown>>])[0] ?? [];
    if (list.length === 0) return "";
    const byPub = new Map<string, Record<string, number>>();
    for (const r of list) {
      const name = String(r.publicationName);
      const entry = byPub.get(name) ?? {};
      entry[String(r.status)] = Number(r.n) || 0;
      byPub.set(name, entry);
    }
    const lines: string[] = [];
    byPub.forEach((counts, name) => {
      lines.push(`${name}: accepted ${counts.accepted ?? 0}, rejected ${counts.rejected ?? 0}, no response ${counts.no_response ?? 0}, sent ${counts.sent ?? 0}`);
    });
    return lines.join("\n");
  } catch {
    return "";
  }
}

// Append each outlet's editorial intelligence (preferred keywords + audience)
// so the matching/drafting agent keys on what the outlet actually wants.
function intelSuffix(name: unknown): string {
  const intel = getPublicationIntel(typeof name === "string" ? name : "");
  if (!intel) return "";
  const kw = intelKeywords(intel).slice(0, 10).join(", ");
  const aud = intel.targetAudience ? ` | audience: ${intel.targetAudience}` : "";
  return `${kw ? ` | prefers: ${kw}` : ""}${aud}`;
}

async function fetchPublicationsList(): Promise<string> {
  try {
    const db = await getDb();
    if (db) {
      const rows = await db.execute(sql.raw(
        "SELECT name, category, payRange, tier, topics FROM publications WHERE acceptsFreelance = 1 ORDER BY tier ASC LIMIT 250",
      ));
      const list = (rows as unknown as [Array<Record<string, unknown>>])[0] ?? [];
      if (list.length) {
        return list
          .map((p) => {
            let topics = "";
            try {
              const t = typeof p.topics === "string" ? JSON.parse(p.topics) : p.topics;
              if (Array.isArray(t)) topics = t.slice(0, 5).join(", ");
            } catch { /* topics is optional context */ }
            return `${p.name ?? ""} | ${p.category ?? ""} | ${p.payRange ?? ""} | tier ${p.tier ?? "?"} | ${topics}${intelSuffix(p.name)}`;
          })
          .join("\n");
      }
    }
  } catch (err) {
    console.warn("[workspace] publications query failed:", err instanceof Error ? err.message : err);
  }
  // Fallback: the canonical editorial-intelligence catalog (works without a DB).
  return PUBLICATION_INTEL
    .map(p => `${p.name} | ${p.businessTopics?.slice(0, 3).join(", ") ?? ""} |  | tier ? |  ${intelSuffix(p.name)}`)
    .join("\n");
}

const syncRecord = z.object({
  id: z.string().min(1).max(32),
  data: z.unknown(),
  updated_at: z.number(),
  deleted: z.boolean(),
});

export const workspaceRouter = router({
  // ── Sync ──────────────────────────────────────────────────────────────────
  pull: protectedProcedure
    .input(z.object({ table: z.enum(["pages", "databases", "rows"]), since: z.number().default(0) }))
    .query(async ({ input }) => {
      await ensureTables();
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const table = SYNC_TABLES[input.table as SyncTable];
      const result = await db.execute(sql.raw(
        `SELECT id, data, updatedAt, deleted FROM \`${table}\` WHERE updatedAt > ${Math.floor(input.since)} ORDER BY updatedAt ASC LIMIT 2000`,
      ));
      const rows = (result as unknown as [Array<{ id: string; data: unknown; updatedAt: number; deleted: number }>])[0] ?? [];
      return rows.map((r) => ({
        id: r.id,
        data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
        updated_at: Number(r.updatedAt),
        deleted: Boolean(r.deleted),
      }));
    }),

  push: protectedProcedure
    .input(z.object({ table: z.enum(["pages", "databases", "rows"]), records: z.array(syncRecord).max(200) }))
    .mutation(async ({ input }) => {
      await ensureTables();
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const table = SYNC_TABLES[input.table as SyncTable];
      for (const rec of input.records) {
        await db.execute(sql`
          INSERT INTO ${sql.raw(`\`${table}\``)} (id, data, updatedAt, deleted)
          VALUES (${rec.id}, ${JSON.stringify(rec.data ?? {})}, ${rec.updated_at}, ${rec.deleted})
          ON DUPLICATE KEY UPDATE
            data = IF(VALUES(updatedAt) >= updatedAt, VALUES(data), data),
            deleted = IF(VALUES(updatedAt) >= updatedAt, VALUES(deleted), deleted),
            updatedAt = IF(VALUES(updatedAt) >= updatedAt, VALUES(updatedAt), updatedAt)
        `);
      }
      return { ok: true, count: input.records.length };
    }),

  // ── Agent ─────────────────────────────────────────────────────────────────
  runAgent: protectedProcedure
    .input(z.object({
      task: z.enum(TASKS),
      prompt: z.string().min(1).max(60000),
      context: z.string().max(200).default(""),
      model: z.string().optional(), // per-task override from client settings
    }))
    .mutation(async ({ input }) => {
      const route = TASK_MODELS[input.task as AgentTask];
      const persona = route.persona ? AGENT_PERSONAS[route.persona] : undefined;
      const usePlaybook = ["create_offer", "headlines", "score_idea", "match_publications"].includes(input.task);
      const system = (persona ? persona.systemPrompt + "\n" : "") + HOUSE_RULES + (usePlaybook ? PLAYBOOK : "") + (input.task === "create_offer" ? WINNING_PITCHES : "") + (route.persona ? await skillBlockFor(route.persona) : "");

      let prompt = input.prompt;

      // Live research enrichment with real sources via Perplexity
      if (input.task === "research_brief") {
        const live = await fetchPerplexityContext(
          `Current facts, statistics, recent developments and expert voices for this article idea:\n${input.prompt.slice(0, 1500)}`,
        );
        if (live) prompt += `\n\nLIVE RESEARCH CONTEXT (from Perplexity, cite these where relevant):\n${live}`;
      }

      // Real outlet database for matching
      if (input.task === "match_publications") {
        const pubs = await fetchPublicationsList();
        if (pubs) prompt += `\n\nOUTLET DATABASE (name | niche | pay | audience):\n${pubs}`;
      }

      // Outcome learning: ground scoring + matching in real pitch results
      if (input.task === "match_publications" || input.task === "score_idea") {
        const history = await fetchPitchHistory();
        if (history) prompt += `\n\nPITCH TRACK RECORD (weigh this heavily — these outlets' actual responses to past pitches):\n${history}`;
      }

      const result = await invokeLLM({
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        model: input.model ?? route.model,
        maxTokens: route.maxTokens,
      });

      const text = result.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) throw new Error("Empty response from model");

      const tokensIn = result.usage?.prompt_tokens ?? 0;
      const tokensOut = result.usage?.completion_tokens ?? 0;
      const cost = estimateCost(result.model ?? route.model, tokensIn, tokensOut);
      void recordCentralCost(input.task, result.model ?? route.model, tokensIn, tokensOut, cost, input.context);

      return { text, model: result.model ?? route.model, tokensIn, tokensOut, cost: Math.round(cost * 10000) / 10000 };
    }),

  // ── Fact-integrity layer ──────────────────────────────────────────────────
  // Extract every factual claim from draft material, verify the batch against
  // live web sources (Perplexity), return a structured claim ledger.
  verifyFacts: protectedProcedure
    .input(z.object({ text: z.string().min(20).max(40000), context: z.string().max(200).default("") }))
    .mutation(async ({ input }) => {
      const persona = AGENT_PERSONAS.factchecker;
      const extract = await invokeLLM({
        messages: [
          { role: "system", content: persona.systemPrompt + HOUSE_RULES + (await skillBlockFor("factchecker")) },
          { role: "user", content: `Extract every verifiable factual claim from this draft material (statistics, dates, named facts, attributions). Return STRICT JSON only: an array of strings, max 12 claims, each a single self-contained sentence.\n\nMATERIAL:\n${input.text}` },
        ],
        model: TIER.free,
        maxTokens: 2000,
      });
      let claims: string[] = [];
      try {
        claims = JSON.parse((extract.choices?.[0]?.message?.content ?? "[]").replace(/^```(json)?|```$/g, "").trim());
      } catch {
        throw new Error("Claim extraction failed — try again");
      }
      if (!Array.isArray(claims) || claims.length === 0) {
        return { claims: [], summary: "No verifiable claims found in this material." };
      }
      claims = claims.slice(0, 12).map(String);

      const live = await fetchPerplexityContext(
        `Verify each of these claims. For each, state TRUE, FALSE, or UNVERIFIABLE with the best source:\n${claims.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
      );

      const judge = await invokeLLM({
        messages: [
          { role: "system", content: persona.systemPrompt + HOUSE_RULES + (await skillBlockFor("factchecker")) },
          { role: "user", content: `Given these claims and the live verification research below, return STRICT JSON only:
[{"claim": "...", "status": "Verified" | "TK" | "Disputed", "source": "<url or source name, empty if none>", "note": "<one short sentence>"}]
Status rules: Verified = confirmed with a source; Disputed = contradicted; TK = could not confirm (needs reporting).

CLAIMS:
${claims.map((c, i) => `${i + 1}. ${c}`).join("\n")}

LIVE VERIFICATION RESEARCH:
${live || "(no live research available — mark all claims TK)"}` },
        ],
        model: TIER.freeBig,
        maxTokens: 4000,
      });

      let results: Array<{ claim: string; status: string; source: string; note: string }> = [];
      try {
        results = JSON.parse((judge.choices?.[0]?.message?.content ?? "[]").replace(/^```(json)?|```$/g, "").trim());
      } catch {
        throw new Error("Verification parsing failed — try again");
      }

      const tIn = (extract.usage?.prompt_tokens ?? 0) + (judge.usage?.prompt_tokens ?? 0);
      const tOut = (extract.usage?.completion_tokens ?? 0) + (judge.usage?.completion_tokens ?? 0);
      const cost = estimateCost("anthropic/claude-sonnet-4.6", tIn, tOut);
      void recordCentralCost("verify_facts", "haiku+sonnet", tIn, tOut, cost, input.context);

      const verified = results.filter((r) => r.status === "Verified").length;
      const tk = results.filter((r) => r.status === "TK").length;
      const disputed = results.filter((r) => r.status === "Disputed").length;
      return {
        claims: results,
        tokensIn: tIn,
        tokensOut: tOut,
        cost: Math.round(cost * 10000) / 10000,
        summary: `${results.length} claims checked: ${verified} verified, ${tk} need reporting (TK), ${disputed} disputed.`,
      };
    }),

  // ── Tournament drafting ───────────────────────────────────────────────────
  // Two agents draft the same piece from different angles; the scorer judges
  // blind and the winner is returned with the judge's reasoning.
  tournamentDraft: protectedProcedure
    .input(z.object({ brief: z.string().min(20).max(40000), context: z.string().max(200).default("") }))
    .mutation(async ({ input }) => {
      const drafter = AGENT_PERSONAS.drafter;
      const angles = [
        { label: "A", model: "anthropic/claude-sonnet-4.6", instruction: "Lead with the strongest data point. Authoritative, analytical register." },
        { label: "B", model: TIER.freeBig, instruction: "Lead with a human scene or concrete moment. Narrative register, then widen to the stakes." },
      ];
      const drafts = await Promise.all(
        angles.map(async (a) => {
          const r = await invokeLLM({
            messages: [
              { role: "system", content: drafter.systemPrompt + HOUSE_RULES + (await skillBlockFor("drafter")) },
              { role: "user", content: `Write the opening 4-6 paragraphs of this article. ${a.instruction} Insert [TK: ...] where reporting is needed — never invent facts.\n\nBRIEF AND MATERIAL:\n${input.brief}` },
            ],
            model: a.model,
            maxTokens: 6000,
          });
          return { ...a, text: r.choices?.[0]?.message?.content?.trim() ?? "", usage: r.usage };
        }),
      );

      const scorer = AGENT_PERSONAS.scorer;
      const judgeRes = await invokeLLM({
        messages: [
          { role: "system", content: scorer.systemPrompt + HOUSE_RULES + (await skillBlockFor("scorer")) },
          { role: "user", content: `Two drafts of the same article opening. Judge blind on hook strength, authority, voice, and momentum. Return EXACTLY:
WINNER: A or B
WHY: <3 short bullets starting with "- ">
STEAL: <one line from the losing draft worth keeping, quoted>

DRAFT A:
${drafts[0].text}

DRAFT B:
${drafts[1].text}` },
        ],
        model: TIER.free,
        maxTokens: 1500,
      });
      const judgeText = judgeRes.choices?.[0]?.message?.content?.trim() ?? "";
      const winnerLabel = /WINNER:\s*B/i.test(judgeText) ? "B" : "A";
      const winner = drafts.find((d) => d.label === winnerLabel)!;
      const loser = drafts.find((d) => d.label !== winnerLabel)!;

      const tIn = drafts.reduce((sum, d) => sum + (d.usage?.prompt_tokens ?? 0), 0) + (judgeRes.usage?.prompt_tokens ?? 0);
      const tOut = drafts.reduce((sum, d) => sum + (d.usage?.completion_tokens ?? 0), 0) + (judgeRes.usage?.completion_tokens ?? 0);
      const cost = estimateCost("anthropic/claude-opus-4.8", tIn, tOut);
      void recordCentralCost("tournament_draft", "sonnet+opus+haiku", tIn, tOut, cost, input.context);

      return {
        winner: winner.text,
        winnerLabel,
        judge: judgeText,
        loserText: loser.text,
        tokensIn: tIn,
        tokensOut: tOut,
        cost: Math.round(cost * 10000) / 10000,
      };
    }),

  // ── Pitch CRM: send via Gmail-connected account + log for the flywheel ────
  recordPitch: protectedProcedure
    .input(z.object({
      publicationName: z.string().min(1).max(200),
      editorEmail: z.string().max(320).default(""),
      subject: z.string().min(1).max(500),
      body: z.string().min(1),
      articleTitle: z.string().max(500).default(""),
      sent: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.execute(sql`
        INSERT INTO pitches (userId, publicationId, publicationName, editorEmail, subject, body, articleTitle, status, sentAt)
        VALUES (${ctx.user.id}, ${input.publicationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 90)},
                ${input.publicationName}, ${input.editorEmail}, ${input.subject}, ${input.body},
                ${input.articleTitle}, ${input.sent ? "sent" : "draft"}, ${input.sent ? new Date() : null})
      `);
      return { ok: true };
    }),
  // ── Outline: structured, with the unique-angle + funnel tie-in baked in ────
  buildOutline: protectedProcedure
    .input(z.object({ brief: z.string().min(10).max(40000), publication: z.string().max(200).default(""), context: z.string().max(200).default("") }))
    .mutation(async ({ input }) => {
      const persona = AGENT_PERSONAS.outliner;
      const result = await invokeLLM({
        messages: [
          { role: "system", content: persona.systemPrompt + AUTHORITY_FUNNEL + PLAYBOOK + HOUSE_RULES + (await skillBlockFor("outliner")) },
          { role: "user", content: `Build the outline for this article${input.publication ? ` targeted at ${input.publication}` : ""}. Return EXACTLY:
THESIS: <one sharp sentence>
UNIQUE ANGLE: <the non-obvious observation/contrarian read in one sentence>
SECTIONS:
## 1. <section title>
- Point: <the claim/observation>
- Evidence needed: <data point or source to verify, named>
- Actionable value: <what the reader can do>
(repeat for 5-7 sections)
OFFER TIE-IN: <where and how a backend offer is woven in, naturally>

BRIEF AND RESEARCH:
${input.brief}` },
        ],
        model: TIER.freeBig,
        maxTokens: 6000,
      });
      const text = result.choices?.[0]?.message?.content?.trim() ?? "";
      const tIn = result.usage?.prompt_tokens ?? 0, tOut = result.usage?.completion_tokens ?? 0;
      const cost = estimateCost(result.model ?? "sonnet", tIn, tOut);
      void recordCentralCost("build_outline", result.model ?? "sonnet", tIn, tOut, cost, input.context);
      return { text, tokensIn: tIn, tokensOut: tOut, cost: Math.round(cost * 10000) / 10000 };
    }),

  // ── Interactive outline critique: improvement suggestions to accept/skip ──
  outlineSuggestions: protectedProcedure
    .input(z.object({ outline: z.string().min(10).max(40000), context: z.string().max(200).default("") }))
    .mutation(async ({ input }) => {
      const persona = AGENT_PERSONAS.analyst;
      const result = await invokeLLM({
        messages: [
          { role: "system", content: persona.systemPrompt + AUTHORITY_FUNNEL + PLAYBOOK + HOUSE_RULES + (await skillBlockFor("analyst")) },
          { role: "user", content: `Critique this outline for a premium publication. Return STRICT JSON only — an array of 3-5 objects, each a concrete upgrade:
[{"area": "<angle|data|actionable|offer|structure>", "suggestion": "<one sharp, specific improvement>"}]
Push for more original observations, harder data, stronger reader payoff, and a smarter offer tie-in.

OUTLINE:
${input.outline}` },
        ],
        model: TIER.free,
        maxTokens: 2500,
      });
      let suggestions: Array<{ area: string; suggestion: string }> = [];
      try { suggestions = JSON.parse((result.choices?.[0]?.message?.content ?? "[]").replace(/^```(json)?|```$/g, "").trim()); } catch { suggestions = []; }
      const tIn = result.usage?.prompt_tokens ?? 0, tOut = result.usage?.completion_tokens ?? 0;
      const cost = estimateCost(result.model ?? "sonnet", tIn, tOut);
      void recordCentralCost("outline_suggestions", result.model ?? "sonnet", tIn, tOut, cost, input.context);
      return { suggestions, cost: Math.round(cost * 10000) / 10000 };
    }),

  // ── Write the FULL article from an approved outline + research ─────────────
  writeFullDraft: protectedProcedure
    .input(z.object({ outline: z.string().min(10).max(40000), research: z.string().max(40000).default(""), publication: z.string().max(200).default(""), accepted: z.array(z.string()).default([]), context: z.string().max(200).default("") }))
    .mutation(async ({ input }) => {
      const persona = AGENT_PERSONAS.drafter;
      const accepted = input.accepted.length ? `\n\nFOLD IN THESE APPROVED IMPROVEMENTS:\n- ${input.accepted.join("\n- ")}` : "";
      const result = await invokeLLM({
        messages: [
          { role: "system", content: persona.systemPrompt + AUTHORITY_FUNNEL + PLAYBOOK + HOUSE_RULES + (await skillBlockFor("drafter")) },
          { role: "user", content: `Write the COMPLETE article from this outline${input.publication ? ` for ${input.publication}` : ""} — every section, fully developed, 1500-2200 words. Markdown: ## for section headings, real paragraphs. Where a statistic or source is needed but unverified, insert [TK: what to verify]. Weave the offer tie-in naturally per the outline. Strong columnist-authority voice.${accepted}

OUTLINE:
${input.outline}

RESEARCH:
${input.research || "(use the outline; mark anything needing reporting as [TK: ...])"}` },
        ],
        model: TIER.freeBig,
        maxTokens: 16000,
      });
      const text = result.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) throw new Error("Empty draft from model");
      const tIn = result.usage?.prompt_tokens ?? 0, tOut = result.usage?.completion_tokens ?? 0;
      const cost = estimateCost(result.model ?? "opus", tIn, tOut);
      void recordCentralCost("write_full_draft", result.model ?? "opus", tIn, tOut, cost, input.context);
      return { text, tokensIn: tIn, tokensOut: tOut, cost: Math.round(cost * 10000) / 10000 };
    }),
  // ── AI cover image — near-free OpenRouter Gemini, in the publication's style ─
  generateCoverImage: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(400), styleHint: z.string().max(2000).default(""), context: z.string().max(200).default("") }))
    .mutation(async ({ input }) => {
      if (!ENV.openrouterApiKey) throw new Error("OPENROUTER_API_KEY not configured");
      // Art Director (David Osei) composes the image prompt from the title + the
      // publication/brand visual cues — real art direction, not a template.
      let prompt = `Hyperrealistic editorial hero photograph for a premium magazine feature titled "${input.title}". ${input.styleHint ? `Match this visual identity and mood: ${input.styleHint}.` : "Sophisticated, Condé Nast-caliber editorial aesthetic."} Wide 16:9 cinematic composition, natural light, shallow depth of field, film-grain realism. No text, no words, no logos, no watermarks. Leave the upper third calm for a headline overlay.`;
      try {
        const ad = AGENT_PERSONAS.artdirector;
        const refined = await invokeLLM({
          messages: [
            { role: "system", content: ad.systemPrompt + (await skillBlockFor("artdirector")) + "\nReturn ONLY the final image-generation prompt — one vivid paragraph, no preamble. Always end with: 16:9, no text, no logos, upper third calm for a headline overlay." },
            { role: "user", content: `Art-direct the hero image for: "${input.title}".${input.styleHint ? `\nVisual identity to honor: ${input.styleHint}` : ""}` },
          ],
          model: TIER.free,
          maxTokens: 600,
        });
        const text = refined.choices?.[0]?.message?.content?.trim();
        if (text && text.length > 40) prompt = text;
      } catch { /* fall back to the template prompt */ }
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.openrouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": ENV.appUrl || "https://elitewriter.insightprofit.live",
          "X-Title": "Elite Writer V5",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          modalities: ["image", "text"],
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!resp.ok) throw new Error(`Image gen failed: ${resp.status} ${(await resp.text()).slice(0, 160)}`);
      const data = await resp.json();
      const url: string = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? "";
      if (!url.includes("base64,")) throw new Error("No image returned");
      const cost = 0.003; // OpenRouter Gemini flash image ~ pennies
      void recordCentralCost("cover_image", "google/gemini-2.5-flash-image", 0, 0, cost, input.context);
      // Offload to R2 so the DB stores a URL, not megabytes of base64. Falls
      // back to the data URL if R2 isn't configured or the upload fails.
      let stored = url;
      try {
        const uploaded = await uploadDataUrl(url, "covers");
        if (uploaded) stored = uploaded;
      } catch (err) {
        console.warn("[cover] R2 upload failed, keeping data URL:", err instanceof Error ? err.message : err);
      }
      return { dataUrl: stored, cost, storage: stored === url ? "inline" : "r2" };
    }),
  // ── Transfer a Google Doc into the workspace as a page ────────────────────
  importGoogleDoc: protectedProcedure
    .input(z.object({ docUrlOrId: z.string().min(10).max(400) }))
    .mutation(async ({ ctx, input }) => {
      const { getGoogleAccessToken } = await import("./google");
      const token = await getGoogleAccessToken(ctx.user.id);
      const idMatch = input.docUrlOrId.match(/[-\w]{25,}/);
      if (!idMatch) throw new Error("Couldn't find a document ID in that URL.");
      const docId = idMatch[0];
      const resp = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        if (resp.status === 403 || resp.status === 401) {
          throw new Error("Google denied access — reconnect Google in Settings (the new Docs permission needs a fresh authorization), and make sure this account can open the doc.");
        }
        throw new Error(`Google Docs fetch failed: ${resp.status}`);
      }
      const doc = await resp.json();
      const title: string = doc.title ?? "Imported document";

      // Flatten Docs JSON → blocks (headings + paragraphs + list items)
      const blocks: unknown[] = [];
      for (const el of doc.body?.content ?? []) {
        const para = el.paragraph;
        if (!para) continue;
        const text = (para.elements ?? [])
          .map((e: { textRun?: { content?: string } }) => e.textRun?.content ?? "")
          .join("")
          .replace(/\n$/, "")
          .trim();
        if (!text) continue;
        const style: string = para.paragraphStyle?.namedStyleType ?? "";
        if (style.startsWith("HEADING_")) {
          const level = Math.min(3, Math.max(1, Number(style.replace("HEADING_", "")) || 2));
          blocks.push({ type: "heading", props: { level }, content: [{ type: "text", text, styles: {} }] });
        } else if (para.bullet) {
          blocks.push({ type: "bulletListItem", content: [{ type: "text", text, styles: {} }] });
        } else {
          blocks.push({ type: "paragraph", content: [{ type: "text", text, styles: {} }] });
        }
      }
      if (blocks.length === 0) throw new Error("The document appears to be empty (or uses only unsupported elements).");

      // Create the workspace page directly in MySQL (syncs to all clients)
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const pageId = Math.random().toString(36).slice(2, 14);
      const now = Date.now();
      const page = { id: pageId, parentId: null, title, icon: "📄", doc: blocks, sortOrder: now, createdAt: now, updatedAt: now };
      await db.execute(sql`
        INSERT INTO wsPages (id, data, updatedAt, deleted)
        VALUES (${pageId}, ${JSON.stringify(page)}, ${now}, FALSE)
        ON DUPLICATE KEY UPDATE data = VALUES(data), updatedAt = VALUES(updatedAt), deleted = FALSE
      `);
      return { pageId, title, blocks: blocks.length };
    }),
});