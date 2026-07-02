/**
 * Article Queue Router — Pre-Written Pipeline Backend
 * 
 * Generates publication-ready articles in batch:
 * 1. Discover trending topics via news feeds + intelligence
 * 2. Deep research each topic
 * 3. AI draft full articles
 * 4. Auto-score and quality-check
 * 5. Queue for journalist review
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { articles, researchNotes } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { syncArticleToPipeline } from "../lib/supabase-sync";
import { getSopPromptBlock } from "./templateSops";

// ─── OpenRouter Models (shared with agentic) ────────────

const MODELS: Record<string, string> = {
  "claude-sonnet": "anthropic/claude-sonnet-4",
  "claude-opus": "anthropic/claude-opus-4",
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gemini-pro": "google/gemini-2.5-pro",
  "gemini-flash": "google/gemini-2.5-flash",
  "deepseek-r1": "deepseek/deepseek-r1",
  "llama-70b": "meta-llama/llama-3.3-70b-instruct",
  "qwen-72b": "qwen/qwen-2.5-72b-instruct",
};

async function callModel(model: string, messages: Array<{ role: string; content: string }>, opts: { maxTokens?: number; temp?: number; json?: boolean } = {}) {
  const modelId = MODELS[model] || model;
  const result = await invokeLLM({
    model: modelId,
    messages: messages.map(m => ({ role: m.role as any, content: m.content })),
    maxTokens: opts.maxTokens || 4096,
    temperature: opts.temp ?? 0.7,
    response_format: opts.json ? { type: "json_object" } : undefined,
  });
  return result.choices[0]?.message?.content || "";
}

function tryParseJSON(text: string): any {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) { try { return JSON.parse(match[1]); } catch {} }
  return null;
}

// ─── Queue Router ────────────────────────────────────────

export const queueRouter = router({

  // ─── Get Queue Stats ──────────────────────────────────
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
      if (!db) throw new Error("Database not available");
    const allArticles = await db.select().from(articles)
      .where(eq(articles.userId, ctx.user.id));

    return {
      total: allArticles.length,
      draft: allArticles.filter(a => a.status === "draft").length,
      review: allArticles.filter(a => a.status === "review").length,
      scored: allArticles.filter(a => a.status === "scored").length,
      pitched: allArticles.filter(a => a.status === "pitched").length,
      published: allArticles.filter(a => a.status === "published").length,
      avgScore: allArticles.filter(a => a.overallScore).length > 0
        ? Math.round(allArticles.filter(a => a.overallScore).reduce((s, a) => s + (a.overallScore || 0), 0) / allArticles.filter(a => a.overallScore).length * 10) / 10
        : 0,
    };
  }),

  // ─── Discover Trending Topics ─────────────────────────
  discoverTopics: protectedProcedure
    .input(z.object({
      niche: z.string().default("business technology finance"),
      count: z.number().min(1).max(20).default(5),
      model: z.string().default("gemini-flash"),
    }))
    .mutation(async ({ input }) => {
      const text = await callModel(input.model, [
        { role: "system", content: "You are an elite editorial strategist at a Bloomberg-tier newsroom. Identify trending topics with high article potential. Return ONLY valid JSON." },
        { role: "user", content: `Identify ${input.count} trending topics in ${input.niche} that would make excellent articles right now.

For each topic, assess:
- News peg (what makes it timely)
- Audience interest (who cares and why)
- Data availability (can we back it up with stats?)
- Competition level (what's already published)
- Unique angle opportunity

Return JSON:
{
  "topics": [
    {
      "title": "<article headline>",
      "topic": "<core topic>",
      "newsPeg": "<why now>",
      "audience": "<target reader>",
      "uniqueAngle": "<fresh perspective>",
      "suggestedTemplate": "investigative|analysis|explainer|opinion|profile|data-driven",
      "estimatedWords": 1500,
      "priority": "high|medium",
      "suggestedPublication": "<best fit publication>"
    }
  ]
}` },
      ], { maxTokens: 2048, json: true });

      const result = tryParseJSON(text);
      return { topics: result?.topics || [], raw: text };
    }),

  // ─── Generate Single Article (Full Pipeline) ──────────
  generateArticle: protectedProcedure
    .input(z.object({
      title: z.string().min(3),
      topic: z.string().optional(),
      targetPublication: z.string().optional(),
      template: z.string().optional(),
      templateId: z.string().optional(),
      brandVoice: z.string().optional(),
      model: z.string().default("gemini-flash"),
      wordCount: z.number().default(2000),
      saveToDb: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const steps: string[] = [];

      // Step 1: Research
      steps.push("researching");
      const researchText = await callModel(
        input.model === "claude-sonnet" ? "gemini-flash" : "gemini-flash",
        [
          { role: "system", content: "You are a senior research analyst. Return ONLY valid JSON with thorough research." },
          { role: "user", content: `Research this topic thoroughly for a publication-grade article:

Topic: ${input.title}
${input.targetPublication ? `Target: ${input.targetPublication}` : ""}

Return JSON:
{
  "keyFacts": ["<fact with source>"],
  "statistics": [{"stat": "<data point>", "source": "<source>", "year": "<year>"}],
  "expertQuotes": [{"name": "<expert>", "title": "<title>", "quote": "<quote>"}],
  "trendAnalysis": "<paragraph>",
  "uniqueAngle": "<fresh angle>",
  "suggestedSources": ["<source>"]
}` },
        ],
        { maxTokens: 3072, json: true }
      );

      const research = tryParseJSON(researchText) || { keyFacts: [], statistics: [], uniqueAngle: input.title };
      steps.push("research_done");

      // Step 2: Outline
      steps.push("outlining");
      const outlineText = await callModel(input.model, [
        { role: "system", content: "You are an elite editorial strategist. Return ONLY valid JSON." },
        { role: "user", content: `Create a detailed article outline.

Topic: ${input.title}
Research: ${JSON.stringify(research).slice(0, 2000)}
${input.targetPublication ? `Publication: ${input.targetPublication}` : ""}
${input.template ? `Template: ${input.template}` : ""}
Word count: ${input.wordCount}

Return JSON:
{
  "headline": "<compelling headline>",
  "subheadline": "<supporting line>",
  "sections": [{"heading": "<heading>", "keyPoints": ["<point>"], "wordTarget": <n>}],
  "hookStrategy": "<how to open>",
  "closingStrategy": "<how to close>",
  "seoKeywords": ["<keyword>"]
}` },
      ], { maxTokens: 2048, json: true });

      const outline = tryParseJSON(outlineText) || { headline: input.title, sections: [] };
      steps.push("outline_done");

      // Step 3: Write full article
      steps.push("drafting");
      const sopBlock = await getSopPromptBlock(input.templateId);
      const FORMAT_RULES = `
MANDATORY FORMAT RULES:
1. Output clean markdown only — no HTML.
2. Headline as # H1. Major sections as ## H2. Sub-sections as ### H3.
3. Every prose paragraph ≤ 150 words. Start a new paragraph after 150 words.
4. Use bullet or numbered lists for enumeration.
5. Pull-quotes: > "Key sentence."
6. Callout/methodology boxes: > **Methodology:** ...
7. Image/chart placeholders: [IMAGE: description] or [CHART: description] at the SOP's visual slots.
8. No AI slop: no "delve", "leverage", "game-changer", "seamlessly", "in today's rapidly evolving".
9. US English only. End with ## Conclusion.`;
      const draftContent = await callModel(input.model, [
        { role: "system", content: [
          `You are a senior journalist writing for ${input.targetPublication || "a top-tier publication"}.`,
          `Write publication-ready prose with data-driven insights and authoritative tone.`,
          sopBlock,
          FORMAT_RULES,
        ].filter(Boolean).join("\n") },
        { role: "user", content: `Write a complete, fully-structured article.

Headline: ${outline.headline || input.title}
${outline.subheadline ? `Subheadline: ${outline.subheadline}` : ""}

OUTLINE:
${(outline.sections || []).map((s: any, i: number) => `${i + 1}. ${s.heading} (~${s.wordTarget || 300} words)\n   Points: ${(s.keyPoints || []).join(", ")}`).join("\n")}

RESEARCH:
Stats: ${(research.statistics || []).map((s: any) => `${s.stat} (${s.source}, ${s.year})`).join("; ")}
Experts: ${(research.expertQuotes || []).map((q: any) => `${q.name}, ${q.title}: "${q.quote}"`).join("; ")}
Facts: ${(research.keyFacts || []).slice(0, 8).join("; ")}

${input.brandVoice ? `VOICE: ${input.brandVoice}` : ""}
Hook: ${outline.hookStrategy || "Start with a compelling data point"}
Close: ${outline.closingStrategy || "End with actionable insight"}
Target: ${input.wordCount} words
SEO: ${(outline.seoKeywords || []).join(", ")}

Follow all format rules and the SOP section order. Output publication-ready markdown.` },
      ], { maxTokens: Math.min(input.wordCount * 2, 16384), temp: 0.75 });

      steps.push("draft_done");

      // Step 4: Quick AI proofread pass
      steps.push("proofing");
      const proofedContent = await callModel("gemini-flash", [
        { role: "system", content: "You are a copy editor. Fix any AI slop phrases, British spellings, filler words, and grammar issues. Return the corrected article only, no commentary. Preserve all markdown formatting." },
        { role: "user", content: `Proofread and clean this article. Remove AI clichés (delve, leverage, game-changer, seamlessly, in today's rapidly evolving, etc). Ensure US English. Tighten prose. Return ONLY the corrected article:\n\n${draftContent}` },
      ], { maxTokens: Math.min(input.wordCount * 2, 16384), temp: 0.3 });

      steps.push("proof_done");

      // Step 5: Auto-score
      steps.push("scoring");
      const scoreText = await callModel("gemini-flash", [
        { role: "system", content: "You are an editorial quality assessor. Score this article. Return ONLY valid JSON." },
        { role: "user", content: `Score this article on a 1-10 scale across these dimensions:

Article:
${proofedContent.slice(0, 3000)}

Return JSON:
{
  "overall": <1-10>,
  "dimensions": {
    "hook": <1-10>,
    "structure": <1-10>,
    "evidence": <1-10>,
    "voice": <1-10>,
    "originality": <1-10>,
    "readability": <1-10>,
    "seo": <1-10>,
    "conclusion": <1-10>
  },
  "strengths": ["<strength>"],
  "improvements": ["<area to improve>"]
}` },
      ], { maxTokens: 1024, json: true });

      const scoreData = tryParseJSON(scoreText) || { overall: 5, dimensions: {} };
      steps.push("score_done");

      // Step 6: Save to database
      let articleId: number | null = null;
      if (input.saveToDb) {
        const wordCount = proofedContent.trim().split(/\s+/).length;
        const [result] = await db.insert(articles).values({
          userId: ctx.user.id,
          title: outline.headline || input.title,
          content: proofedContent,
          template: input.template || null,
          brandVoice: input.brandVoice || null,
          wordCount,
          status: "scored",
          overallScore: scoreData.overall || null,
          scoreData: scoreData,
          targetPublication: input.targetPublication || null,
        }).returning({ id: articles.id });
        articleId = result.id;
        syncArticleToPipeline({
          articleId: result.id, title: outline.headline || input.title, status: "scored",
          score: scoreData.overall, wordCount, targetPublication: input.targetPublication,
        });

        // Save research notes
        await db.insert(researchNotes).values({
          userId: ctx.user.id,
          title: `Research: ${outline.headline || input.title}`,
          content: JSON.stringify(research),
          sources: research.suggestedSources || [],
          dataPoints: research.statistics || [],
        });
      }

      return {
        success: true,
        articleId,
        headline: outline.headline || input.title,
        wordCount: proofedContent.trim().split(/\s+/).length,
        score: scoreData.overall,
        scoreData,
        research,
        outline,
        steps,
        content: proofedContent,
      };
    }),

  // ─── Batch Generate Articles ──────────────────────────
  batchGenerate: protectedProcedure
    .input(z.object({
      topics: z.array(z.object({
        title: z.string(),
        targetPublication: z.string().optional(),
        template: z.string().optional(),
      })),
      model: z.string().default("claude-sonnet"),
      wordCount: z.number().default(2000),
      brandVoice: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const results: Array<{ title: string; success: boolean; articleId?: number; score?: number; error?: string }> = [];

      // Process sequentially to avoid rate limits
      for (const topic of input.topics) {
        try {
          // Use the same pipeline but call inline
          const db = await getDb();
      if (!db) throw new Error("Database not available");

          // Research (fast model)
          const researchText = await callModel("gemini-flash", [
            { role: "system", content: "Senior research analyst. Return ONLY valid JSON." },
            { role: "user", content: `Research for article: ${topic.title}\n${topic.targetPublication ? `Target: ${topic.targetPublication}` : ""}\nReturn JSON: {"keyFacts":["..."],"statistics":[{"stat":"...","source":"...","year":"..."}],"expertQuotes":[{"name":"...","title":"...","quote":"..."}],"uniqueAngle":"..."}` },
          ], { maxTokens: 2048, json: true });
          const research = tryParseJSON(researchText) || { keyFacts: [], statistics: [] };

          // Draft (selected model)
          const draft = await callModel(input.model, [
            { role: "system", content: `Senior journalist for ${topic.targetPublication || "a top-tier publication"}. No AI clichés. US English. Concrete data. Publication-ready.` },
            { role: "user", content: `Write a ${input.wordCount}-word article on: ${topic.title}\n\nResearch:\n${JSON.stringify(research).slice(0, 2000)}\n\n${input.brandVoice ? `Voice: ${input.brandVoice}` : ""}\n${topic.template ? `Template: ${topic.template}` : ""}\n\nWrite in markdown with ## headings. Include data citations. No filler.` },
          ], { maxTokens: Math.min(input.wordCount * 2, 12000), temp: 0.75 });

          // Proofread
          const proofed = await callModel("gemini-flash", [
            { role: "system", content: "Copy editor. Fix AI slop, British spellings, filler. Return corrected article only." },
            { role: "user", content: `Proofread:\n\n${draft}` },
          ], { maxTokens: Math.min(input.wordCount * 2, 12000), temp: 0.3 });

          // Score
          const scoreText = await callModel("gemini-flash", [
            { role: "system", content: "Score 1-10. Return ONLY JSON." },
            { role: "user", content: `Score: ${proofed.slice(0, 2000)}\nReturn: {"overall":<1-10>,"strengths":["..."],"improvements":["..."]}` },
          ], { maxTokens: 512, json: true });
          const scoreData = tryParseJSON(scoreText) || { overall: 5 };

          // Save
          const wordCount = proofed.trim().split(/\s+/).length;
          const [result] = await db.insert(articles).values({
            userId: ctx.user.id,
            title: topic.title,
            content: proofed,
            template: topic.template || null,
            brandVoice: input.brandVoice || null,
            wordCount,
            status: "scored",
            overallScore: scoreData.overall || null,
            scoreData,
            targetPublication: topic.targetPublication || null,
          }).returning({ id: articles.id });

          syncArticleToPipeline({
            articleId: result.id, title: topic.title, status: "scored",
            score: scoreData.overall, wordCount, targetPublication: topic.targetPublication,
          });
          results.push({ title: topic.title, success: true, articleId: result.id, score: scoreData.overall });
        } catch (err: any) {
          results.push({ title: topic.title, success: false, error: err.message || "Unknown error" });
        }
      }

      return { results, totalGenerated: results.filter(r => r.success).length, totalFailed: results.filter(r => !r.success).length };
    }),

  // ─── Update Article Status ────────────────────────────
  updateStatus: protectedProcedure
    .input(z.object({
      articleId: z.number(),
      status: z.enum(["draft", "review", "scored", "pitched", "published"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(articles).set({ status: input.status })
        .where(and(eq(articles.id, input.articleId), eq(articles.userId, ctx.user.id)));
      syncArticleToPipeline({ articleId: input.articleId, title: "", status: input.status });
      return { success: true };
    }),

  // ─── Delete Article ───────────────────────────────────
  deleteArticle: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(articles)
        .where(and(eq(articles.id, input.articleId), eq(articles.userId, ctx.user.id)));
      return { success: true };
    }),
});
