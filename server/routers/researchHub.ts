/**
 * Research Hub Router — native rebuild of Paperguide's agentic research suite.
 *
 * Phase 1 core:
 *   • agenticSearch — multi-source gather (scholarly + web/news + KB + video)
 *                     → free-first cited LLM synthesis, inline [n] citations.
 *   • deepResearch  — sub-question plan → per-question gather → cited report,
 *                     written into the Knowledge Base.
 *   • chatWithDoc   — grounded Q&A over a pasted/extracted document.
 *   • references.*  — Reference Library CRUD + DOI/BibTeX/RIS/JSON import,
 *                     plus "save to KB" to bridge a citation into the ecosystem.
 *
 * House rules honored here:
 *   - All synthesis runs through invokeLLM (defaults to TIER.free OpenRouter);
 *     budget gate + fallback ladder + usage ledger apply automatically.
 *   - Every call injects the operator-editable expert SOP via skillBlockFor().
 *   - Gather sources degrade gracefully: a missing API key drops that source
 *     instead of failing the whole search.
 *   - No new external integration — reuses brave / youtube / openrouter keys
 *     already covered by /api health booleans (research.status).
 */
import { z } from "zod";
import { and, desc, eq, like, or } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM, TIER } from "../_core/llm";
import { skillBlockFor } from "../_core/skills";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import {
  kbItems,
  researchReferences,
  type InsertKbItem,
  type InsertResearchReference,
} from "../../drizzle/schema";
import { academicSearch } from "../lib/academic-search";
import { getPublicationIntel, type PublicationIntel } from "../../shared/publication-intelligence";

const KB_CATEGORY = "Research";

/** Build a publication-steering brief from canonical editorial intelligence. */
function publicationResearchBrief(intel: PublicationIntel | null): string {
  if (!intel) return "";
  const parts: string[] = [`TARGET PUBLICATION: ${intel.name}`];
  if (intel.targetAudience) parts.push(`Audience to serve: ${intel.targetAudience}`);
  if (intel.keywordFilter?.length) parts.push(`Angle the research toward these themes: ${intel.keywordFilter.join(", ")}`);
  if (intel.newsSources?.length) parts.push(`Prioritize evidence from sources like: ${intel.newsSources.join(", ")}`);
  if (intel.scoringAlgorithm) parts.push(`What this outlet rewards: ${intel.scoringAlgorithm}`);
  return `\n\n${parts.join("\n")}`;
}

// A normalized citation candidate from any gather source.
type Source = {
  title: string;
  url: string;
  snippet: string;
  source: string;          // openalex | crossref | brave | brave-news | youtube | kb | …
  type: "article" | "webpage" | "video" | "report";
  authors?: string[];
  year?: number | null;
  doi?: string | null;
  citationCount?: number | null;
};

// ─── Gather helpers (free / key-guarded — never throw on a missing key) ───

async function gatherScholarly(query: string, perSource: number): Promise<Source[]> {
  try {
    const results = await academicSearch(query, { maxPerSource: perSource });
    return results.map((r) => ({
      title: r.title,
      url: r.openAccessUrl || r.url || (r.doi ? `https://doi.org/${r.doi}` : ""),
      snippet: (r.abstract || "").slice(0, 600),
      source: r.source,
      type: "article" as const,
      authors: r.authors,
      year: r.year,
      doi: r.doi,
      citationCount: r.citationCount,
    }));
  } catch (e) {
    console.warn(`[researchHub] scholarly gather failed: ${(e as Error).message}`);
    return [];
  }
}

async function gatherWeb(query: string, count: number): Promise<Source[]> {
  if (!ENV.braveApiKey) return [];
  try {
    const params = new URLSearchParams({
      q: query,
      count: String(count),
      freshness: "pm",
      text_decorations: "false",
      result_filter: "web",
    });
    const resp = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      headers: { Accept: "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": ENV.braveApiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as any;
    const web: Source[] = (data.web?.results || []).map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.description || "",
      source: "brave",
      type: "webpage" as const,
      year: null,
    }));
    const news: Source[] = (data.news?.results || []).slice(0, 4).map((n: any) => ({
      title: n.title || "",
      url: n.url || "",
      snippet: n.description || "",
      source: "brave-news",
      type: "webpage" as const,
      year: null,
    }));
    return [...web, ...news];
  } catch (e) {
    console.warn(`[researchHub] web gather failed: ${(e as Error).message}`);
    return [];
  }
}

async function gatherVideo(query: string, maxResults: number): Promise<Source[]> {
  if (!ENV.youtubeApiKey) return [];
  try {
    const params = new URLSearchParams({
      part: "snippet", q: query, maxResults: String(maxResults), type: "video", key: ENV.youtubeApiKey,
    });
    const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as any;
    return (data.items || []).map((it: any) => ({
      title: it.snippet?.title || "",
      url: `https://www.youtube.com/watch?v=${it.id?.videoId}`,
      snippet: it.snippet?.description || "",
      source: "youtube",
      type: "video" as const,
      authors: it.snippet?.channelTitle ? [it.snippet.channelTitle] : [],
      year: it.snippet?.publishedAt ? new Date(it.snippet.publishedAt).getFullYear() : null,
    }));
  } catch (e) {
    console.warn(`[researchHub] video gather failed: ${(e as Error).message}`);
    return [];
  }
}

async function gatherKb(userId: number, query: string): Promise<Source[]> {
  const db = await getDb();
  if (!db) return [];
  const terms = query.split(/\s+/).filter((t) => t.length > 3).slice(0, 4);
  if (!terms.length) terms.push(query);
  try {
    const rows = await db
      .select()
      .from(kbItems)
      .where(
        and(
          eq(kbItems.userId, userId),
          or(...terms.flatMap((t) => [like(kbItems.title, `%${t}%`), like(kbItems.content, `%${t}%`)])),
        ),
      )
      .limit(8);
    return rows.map((r) => ({
      title: r.title,
      url: r.sourceUrl || "",
      snippet: (r.content || "").slice(0, 600),
      source: "kb",
      type: "report" as const,
      year: r.createdAt ? new Date(r.createdAt).getFullYear() : null,
    }));
  } catch (e) {
    console.warn(`[researchHub] kb gather failed: ${(e as Error).message}`);
    return [];
  }
}

type Scope = "all" | "scholarly" | "web" | "kb" | "video";

async function gatherForScope(scope: Scope, query: string, userId: number, perSource: number): Promise<Source[]> {
  const jobs: Promise<Source[]>[] = [];
  if (scope === "all" || scope === "scholarly") jobs.push(gatherScholarly(query, perSource));
  if (scope === "all" || scope === "web") jobs.push(gatherWeb(query, perSource + 4));
  if (scope === "all" || scope === "kb") jobs.push(gatherKb(userId, query));
  if (scope === "all" || scope === "video") jobs.push(gatherVideo(query, 3));
  const settled = await Promise.all(jobs);
  // Dedupe by url (keep first; scholarly ranked first by Promise order)
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const s of settled.flat()) {
    const key = (s.url || s.title).toLowerCase();
    if (!s.title || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// Numbered source block fed to the model, plus the parallel array for the UI.
function numberSources(sources: Source[]): string {
  return sources
    .map((s, i) => {
      const meta = [s.authors?.length ? s.authors.slice(0, 3).join(", ") : "", s.year ? String(s.year) : "", s.source]
        .filter(Boolean)
        .join(" · ");
      return `[${i + 1}] ${s.title}${meta ? ` (${meta})` : ""}\n${s.url}\n${s.snippet}`.trim();
    })
    .join("\n\n");
}

const SYNTH_RULES =
  "Write in clear US English with no AI-tell phrasing (avoid 'delve', 'in today's fast-paced world', 'it's important to note'). " +
  "Ground every claim in the numbered sources and cite inline like [1], [3]. " +
  "Never invent facts or sources. If the evidence is thin, say so plainly.";

function content(res: { choices: Array<{ message: { content: string } }> }): string {
  return res.choices[0]?.message?.content ?? "";
}

export const researchHubRouter = router({
  // ── Agentic cited search ──────────────────────────────────────────────
  agenticSearch: protectedProcedure
    .input(
      z.object({
        query: z.string().min(2),
        scope: z.enum(["all", "scholarly", "web", "kb", "video"]).default("all"),
        perSource: z.number().min(2).max(12).default(6),
        saveToKb: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sources = await gatherForScope(input.scope, input.query, ctx.user.id, input.perSource);
      if (!sources.length) {
        return { success: true, query: input.query, scope: input.scope, sources: [] as Source[], answer: "", savedId: null as number | null, model: null as string | null, note: "No sources found for this query and scope." as string | null };
      }
      const sop = await skillBlockFor("researcher");
      const res = await invokeLLM({
        model: TIER.free,
        temperature: 0.4,
        maxTokens: 1800,
        messages: [
          { role: "system", content: `You are a meticulous research analyst.${sop}\n\n${SYNTH_RULES}` },
          {
            role: "user",
            content: `Question: ${input.query}\n\nNumbered sources:\n\n${numberSources(sources)}\n\nWrite a direct, well-structured answer (markdown). Open with a 1–2 sentence direct answer, then supporting detail with inline [n] citations. End with a short "Key takeaways" bullet list.`,
          },
        ],
      });
      const answer = content(res);

      let savedId: number | null = null;
      if (input.saveToKb) {
        const db = await getDb();
        if (db) {
          const body = `${answer}\n\n## Sources\n${sources.map((s, i) => `${i + 1}. [${s.title}](${s.url}) — ${s.source}`).join("\n")}`;
          const vals: InsertKbItem = {
            userId: ctx.user.id,
            title: input.query.slice(0, 490),
            content: body,
            category: KB_CATEGORY,
            subcategory: "AI Search",
            tags: ["research", input.scope],
            source: "Research Hub",
            tokenCount: Math.ceil(body.length / 4),
          };
          const [r] = await db.insert(kbItems).values(vals).$returningId();
          savedId = r.id;
        }
      }

      return { success: true, query: input.query, scope: input.scope, sources, answer, savedId, model: (res.model ?? null) as string | null, note: null as string | null };
    }),

  // ── Deep research report (plan → gather per sub-question → cited report) ──
  deepResearch: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(3),
        depth: z.enum(["standard", "deep"]).default("standard"),
        scope: z.enum(["all", "scholarly", "web", "kb", "video"]).default("all"),
        saveToKb: z.boolean().default(true),
        targetPublication: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sop = await skillBlockFor("deepresearch");
      const wantQuestions = input.depth === "deep" ? 6 : 4;
      // Publication-aware steering: angle sub-questions + synthesis toward the
      // target outlet's audience, preferred themes and source types.
      const pubBrief = publicationResearchBrief(
        input.targetPublication ? getPublicationIntel(input.targetPublication) : null,
      );

      // 1. Plan sub-questions (cheap free call, JSON out).
      const plan = await invokeLLM({
        model: TIER.free,
        temperature: 0.5,
        maxTokens: 600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `You decompose a research topic into focused sub-questions.${sop}` },
          {
            role: "user",
            content: `Topic: "${input.topic}"${pubBrief}\n\nReturn JSON: {"subquestions": string[]} with exactly ${wantQuestions} specific, non-overlapping sub-questions that together fully cover the topic${pubBrief ? " for the target publication's audience and preferred angles" : ""}.`,
          },
        ],
      });
      let subquestions: string[] = [];
      try {
        const parsed = JSON.parse(content(plan));
        subquestions = Array.isArray(parsed.subquestions) ? parsed.subquestions.slice(0, wantQuestions) : [];
      } catch {
        subquestions = [];
      }
      if (!subquestions.length) subquestions = [input.topic];

      // 2. Gather evidence per sub-question (sequential to be polite to free tiers).
      const allSources: Source[] = [];
      const perQuestion: { question: string; sources: Source[] }[] = [];
      for (const q of subquestions) {
        const s = await gatherForScope(input.scope, q, ctx.user.id, input.depth === "deep" ? 5 : 4);
        perQuestion.push({ question: q, sources: s });
        allSources.push(...s);
      }
      // Global dedupe + renumber once for stable citations across the report.
      const seen = new Set<string>();
      const sources: Source[] = [];
      for (const s of allSources) {
        const key = (s.url || s.title).toLowerCase();
        if (!s.title || seen.has(key)) continue;
        seen.add(key);
        sources.push(s);
      }

      if (!sources.length) {
        return { success: true, topic: input.topic, subquestions, perQuestion, sources: [] as Source[], report: "", savedId: null as number | null, model: null as string | null, note: "No sources found." as string | null };
      }

      // 3. Synthesize the cited report.
      const report = content(
        await invokeLLM({
          model: TIER.free,
          temperature: 0.45,
          maxTokens: input.depth === "deep" ? 4096 : 2800,
          messages: [
            { role: "system", content: `You are a senior research writer producing a rigorous, balanced report.${sop}\n\n${SYNTH_RULES}` },
            {
              role: "user",
              content:
                `Topic: ${input.topic}${pubBrief}\n\nSub-questions to address:\n${subquestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n` +
                `Numbered sources (cite inline as [n]):\n\n${numberSources(sources)}\n\n` +
                `Write a markdown report: a "## Executive Summary" (3–5 sentences), one "## " section per sub-question with cited analysis, a "## Open Questions" section, and a final "## References" numbered list matching the citation numbers (title — source — url).`,
            },
          ],
        }),
      );

      // 4. Persist into the Knowledge Base.
      let savedId: number | null = null;
      if (input.saveToKb) {
        const db = await getDb();
        if (db) {
          const vals: InsertKbItem = {
            userId: ctx.user.id,
            title: input.topic.slice(0, 490),
            content: report,
            category: KB_CATEGORY,
            subcategory: "Deep Research Report",
            tags: ["research", "deep-research", input.scope],
            source: "Research Hub",
            tokenCount: Math.ceil(report.length / 4),
          };
          const [r] = await db.insert(kbItems).values(vals).$returningId();
          savedId = r.id;
        }
      }

      return { success: true, topic: input.topic, subquestions, perQuestion, sources, report, savedId, model: (plan.model ?? null) as string | null, note: null as string | null };
    }),

  // ── Chat with a document (grounded Q&A over pasted/extracted text) ──────
  chatWithDoc: protectedProcedure
    .input(
      z.object({
        documentText: z.string().min(1),
        question: z.string().min(1),
        title: z.string().optional(),
        history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).default([]),
      }),
    )
    .mutation(async ({ input }) => {
      const sop = await skillBlockFor("analyst");
      const doc = input.documentText.slice(0, 24000); // keep within free context
      const res = await invokeLLM({
        model: TIER.free,
        temperature: 0.2,
        maxTokens: 1200,
        messages: [
          {
            role: "system",
            content:
              `You answer strictly from the supplied document${input.title ? ` ("${input.title}")` : ""}. ` +
              `Quote the supporting passage(s) in your answer. If the document does not contain the answer, say so plainly — never guess.${sop}\n\n${SYNTH_RULES}`,
          },
          { role: "system", content: `DOCUMENT:\n${doc}` },
          ...input.history.map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: input.question },
        ],
      });
      return { success: true, answer: content(res), model: res.model };
    }),

  // ── Reference Library ──────────────────────────────────────────────────
  references: router({
    list: protectedProcedure
      .input(z.object({ q: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return { references: [] as any[] };
        const rows = await db
          .select()
          .from(researchReferences)
          .where(eq(researchReferences.userId, ctx.user.id))
          .orderBy(desc(researchReferences.createdAt));
        const q = (input?.q || "").toLowerCase();
        const refs = q
          ? rows.filter((r) => `${r.title} ${(r.authors as string[] | null)?.join(" ") || ""} ${r.doi || ""}`.toLowerCase().includes(q))
          : rows;
        return { references: refs };
      }),

    create: protectedProcedure
      .input(
        z.object({
          type: z.enum(["article", "webpage", "video", "book", "report"]).default("article"),
          title: z.string().min(1),
          authors: z.array(z.string()).default([]),
          year: z.number().nullable().optional(),
          doi: z.string().optional(),
          url: z.string().optional(),
          abstract: z.string().optional(),
          source: z.string().optional(),
          citationCount: z.number().optional(),
          tags: z.array(z.string()).default([]),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const vals: InsertResearchReference = {
          userId: ctx.user.id,
          type: input.type,
          title: input.title.slice(0, 690),
          authors: input.authors,
          year: input.year ?? null,
          doi: input.doi ?? null,
          url: input.url ?? null,
          abstract: input.abstract ?? null,
          source: input.source ?? "manual",
          citationCount: input.citationCount ?? 0,
          tags: input.tags,
          notes: input.notes ?? null,
        };
        const [r] = await db.insert(researchReferences).values(vals).$returningId();
        return { success: true, id: r.id };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          tags: z.array(z.string()).optional(),
          notes: z.string().optional(),
          year: z.number().nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const patch: Record<string, unknown> = {};
        if (input.title !== undefined) patch.title = input.title.slice(0, 690);
        if (input.tags !== undefined) patch.tags = input.tags;
        if (input.notes !== undefined) patch.notes = input.notes;
        if (input.year !== undefined) patch.year = input.year;
        await db
          .update(researchReferences)
          .set(patch)
          .where(and(eq(researchReferences.id, input.id), eq(researchReferences.userId, ctx.user.id)));
        return { success: true };
      }),

    remove: protectedProcedure
      .input(z.object({ ids: z.array(z.number()).min(1) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        for (const id of input.ids) {
          await db
            .delete(researchReferences)
            .where(and(eq(researchReferences.id, id), eq(researchReferences.userId, ctx.user.id)));
        }
        return { success: true, removed: input.ids.length };
      }),

    // Bulk import: DOI list, BibTeX, RIS, or JSON array.
    import: protectedProcedure
      .input(z.object({ format: z.enum(["doi", "bibtex", "ris", "json"]), text: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const parsed = await parseReferences(input.format, input.text);
        if (!parsed.length) return { success: true, imported: 0, note: "Nothing parsed from input." };
        const vals: InsertResearchReference[] = parsed.map((p) => ({
          userId: ctx.user.id,
          type: p.type ?? "article",
          title: (p.title || "Untitled").slice(0, 690),
          authors: p.authors ?? [],
          year: p.year ?? null,
          doi: p.doi ?? null,
          url: p.url ?? null,
          abstract: p.abstract ?? null,
          source: p.source ?? input.format,
          citationCount: p.citationCount ?? 0,
          tags: p.tags ?? [],
          notes: null,
        }));
        await db.insert(researchReferences).values(vals);
        return { success: true, imported: vals.length };
      }),

    // Save a stored reference into the Knowledge Base ecosystem.
    saveToKb: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database unavailable");
        const [ref] = await db
          .select()
          .from(researchReferences)
          .where(and(eq(researchReferences.id, input.id), eq(researchReferences.userId, ctx.user.id)));
        if (!ref) throw new Error("Reference not found");
        const authors = (ref.authors as string[] | null)?.join(", ") || "";
        const body = `**${ref.title}**\n\n${authors ? `Authors: ${authors}\n` : ""}${ref.year ? `Year: ${ref.year}\n` : ""}${ref.doi ? `DOI: ${ref.doi}\n` : ""}${ref.url ? `URL: ${ref.url}\n` : ""}\n${ref.abstract || ""}`;
        const vals: InsertKbItem = {
          userId: ctx.user.id,
          title: ref.title.slice(0, 490),
          content: body,
          category: KB_CATEGORY,
          subcategory: "Reference",
          tags: ((ref.tags as string[] | null) || []).concat("reference"),
          source: ref.source || "Reference Library",
          sourceUrl: ref.url || null,
          tokenCount: Math.ceil(body.length / 4),
        };
        const [r] = await db.insert(kbItems).values(vals).$returningId();
        return { success: true, kbId: r.id };
      }),
  }),
});

// ─── Import parsers (real, dependency-free) ───────────────────────────────

type ParsedRef = {
  title?: string;
  authors?: string[];
  year?: number | null;
  doi?: string | null;
  url?: string | null;
  abstract?: string | null;
  source?: string;
  type?: "article" | "webpage" | "video" | "book" | "report";
  citationCount?: number;
  tags?: string[];
};

async function parseReferences(format: "doi" | "bibtex" | "ris" | "json", text: string): Promise<ParsedRef[]> {
  if (format === "json") {
    try {
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      return arr.map((d: any) => ({
        title: d.title, authors: d.authors || [], year: d.year ?? null, doi: d.doi ?? null,
        url: d.url ?? null, abstract: d.abstract ?? null, source: d.source || "json",
        type: d.type || "article", citationCount: d.citationCount ?? 0, tags: d.tags || [],
      }));
    } catch {
      return [];
    }
  }
  if (format === "doi") {
    const dois = text.split(/[\s,;\n]+/).map((d) => d.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")).filter(Boolean);
    const out: ParsedRef[] = [];
    for (const doi of dois.slice(0, 50)) {
      try {
        const resp = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
          headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) { out.push({ title: doi, doi, source: "crossref", type: "article" }); continue; }
        const m = ((await resp.json()) as any).message || {};
        out.push({
          title: (m.title?.[0]) || doi,
          authors: (m.author || []).map((a: any) => [a.given, a.family].filter(Boolean).join(" ")).filter(Boolean),
          year: m.issued?.["date-parts"]?.[0]?.[0] ?? null,
          doi, url: m.URL || `https://doi.org/${doi}`,
          abstract: (m.abstract || "").replace(/<[^>]+>/g, ""), citationCount: m["is-referenced-by-count"] ?? 0,
          source: "crossref", type: "article",
        });
      } catch {
        out.push({ title: doi, doi, source: "crossref", type: "article" });
      }
    }
    return out;
  }
  if (format === "bibtex") {
    const entries = text.split(/@\w+\s*\{/).slice(1);
    return entries.map((e) => {
      const field = (name: string) => {
        const m = e.match(new RegExp(`${name}\\s*=\\s*[{"]([^}"]*)`, "i"));
        return m?.[1]?.trim();
      };
      const yr = field("year");
      return {
        title: field("title") || "Untitled",
        authors: (field("author") || "").split(/\s+and\s+/).map((a) => a.trim()).filter(Boolean),
        year: yr ? parseInt(yr, 10) : null,
        doi: field("doi") || null, url: field("url") || null,
        abstract: field("abstract") || null, source: "bibtex", type: "article" as const,
      };
    });
  }
  // RIS
  const records = text.split(/(?:^|\n)ER\s+-/).map((r) => r.trim()).filter(Boolean);
  return records.map((rec) => {
    const tag = (t: string) => {
      const m = rec.match(new RegExp(`^${t}\\s+-\\s+(.*)$`, "m"));
      return m?.[1]?.trim();
    };
    const authors = [...rec.matchAll(/^AU\s+-\s+(.*)$/gm)].map((m) => m[1].trim());
    const yr = tag("PY") || tag("Y1");
    return {
      title: tag("TI") || tag("T1") || "Untitled",
      authors,
      year: yr ? parseInt(yr, 10) : null,
      doi: tag("DO") || null, url: tag("UR") || null, abstract: tag("AB") || null,
      source: "ris", type: "article" as const,
    };
  });
}
