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
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { AGENT_PERSONAS } from "./agents";
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
  tablesEnsured = true;
}

// ── Agent task definitions ──────────────────────────────────────────────────
const TASKS = ["score_idea", "research_brief", "match_publications", "create_offer", "humanize", "tighten", "expand", "headlines", "continue"] as const;
type AgentTask = (typeof TASKS)[number];

// Cheapest capable model per task (OpenRouter slugs; invokeLLM routes them).
const TASK_MODELS: Record<AgentTask, { model: string; maxTokens: number; persona?: keyof typeof AGENT_PERSONAS }> = {
  score_idea: { model: "anthropic/claude-haiku-4.5", maxTokens: 2000, persona: "scorer" },
  match_publications: { model: "anthropic/claude-haiku-4.5", maxTokens: 3000, persona: "analyst" },
  research_brief: { model: "anthropic/claude-sonnet-4.6", maxTokens: 8000, persona: "deepresearch" },
  create_offer: { model: "anthropic/claude-opus-4.8", maxTokens: 8000, persona: "editor" },
  humanize: { model: "anthropic/claude-opus-4.8", maxTokens: 32000, persona: "rewriter" },
  tighten: { model: "anthropic/claude-opus-4.8", maxTokens: 32000, persona: "editor" },
  expand: { model: "anthropic/claude-opus-4.8", maxTokens: 32000, persona: "drafter" },
  headlines: { model: "anthropic/claude-opus-4.8", maxTokens: 4000, persona: "outliner" },
  continue: { model: "anthropic/claude-opus-4.8", maxTokens: 32000, persona: "continuator" },
};


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

async function fetchPublicationsList(): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";
    const rows = await db.execute(sql.raw(
      "SELECT name, category, payRange, tier, topics FROM publications WHERE acceptsFreelance = 1 ORDER BY tier ASC LIMIT 250",
    ));
    const list = (rows as unknown as [Array<Record<string, unknown>>])[0] ?? [];
    return list
      .map((p) => {
        let topics = "";
        try {
          const t = typeof p.topics === "string" ? JSON.parse(p.topics) : p.topics;
          if (Array.isArray(t)) topics = t.slice(0, 5).join(", ");
        } catch { /* topics is optional context */ }
        return `${p.name ?? ""} | ${p.category ?? ""} | ${p.payRange ?? ""} | tier ${p.tier ?? "?"} | ${topics}`;
      })
      .join("\n");
  } catch (err) {
    console.warn("[workspace] publications query failed:", err instanceof Error ? err.message : err);
    return "";
  }
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
      const system = (persona ? persona.systemPrompt + "\n" : "") + HOUSE_RULES;

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
          { role: "system", content: persona.systemPrompt + HOUSE_RULES },
          { role: "user", content: `Extract every verifiable factual claim from this draft material (statistics, dates, named facts, attributions). Return STRICT JSON only: an array of strings, max 12 claims, each a single self-contained sentence.\n\nMATERIAL:\n${input.text}` },
        ],
        model: "anthropic/claude-haiku-4.5",
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
          { role: "system", content: persona.systemPrompt + HOUSE_RULES },
          { role: "user", content: `Given these claims and the live verification research below, return STRICT JSON only:
[{"claim": "...", "status": "Verified" | "TK" | "Disputed", "source": "<url or source name, empty if none>", "note": "<one short sentence>"}]
Status rules: Verified = confirmed with a source; Disputed = contradicted; TK = could not confirm (needs reporting).

CLAIMS:
${claims.map((c, i) => `${i + 1}. ${c}`).join("\n")}

LIVE VERIFICATION RESEARCH:
${live || "(no live research available — mark all claims TK)"}` },
        ],
        model: "anthropic/claude-sonnet-4.6",
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
        { label: "B", model: "anthropic/claude-opus-4.8", instruction: "Lead with a human scene or concrete moment. Narrative register, then widen to the stakes." },
      ];
      const drafts = await Promise.all(
        angles.map(async (a) => {
          const r = await invokeLLM({
            messages: [
              { role: "system", content: drafter.systemPrompt + HOUSE_RULES },
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
          { role: "system", content: scorer.systemPrompt + HOUSE_RULES },
          { role: "user", content: `Two drafts of the same article opening. Judge blind on hook strength, authority, voice, and momentum. Return EXACTLY:
WINNER: A or B
WHY: <3 short bullets starting with "- ">
STEAL: <one line from the losing draft worth keeping, quoted>

DRAFT A:
${drafts[0].text}

DRAFT B:
${drafts[1].text}` },
        ],
        model: "anthropic/claude-haiku-4.5",
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
});

