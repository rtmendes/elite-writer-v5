/**
 * Agentic Editor Router — AI-powered autonomous article creation and enhancement
 * 
 * Features:
 * 1. Multi-model routing via OpenRouter (Claude, GPT-4, Gemini, Llama)
 * 2. Autonomous research → draft → enhance pipeline
 * 3. Section-by-section intelligent rewriting
 * 4. Real-time streaming for long-form generation
 * 5. Context-aware suggestions with publication matching
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM, streamLLM, type InvokeResult } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { articles } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── OpenRouter Multi-Model Helper ───────────────────────

const OPENROUTER_MODELS = {
  "claude-sonnet": "anthropic/claude-sonnet-4-20250514",
  "claude-opus": "anthropic/claude-opus-4-20250514",
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gemini-flash": "google/gemini-2.0-flash-exp:free",
  "gemini-pro": "google/gemini-2.5-pro-preview-05-06",
  "llama-70b": "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek-r1": "deepseek/deepseek-r1",
  "qwen-72b": "qwen/qwen-2.5-72b-instruct:free",
} as const;

type ModelAlias = keyof typeof OPENROUTER_MODELS;

async function invokeWithModel(
  modelAlias: string,
  messages: Array<{ role: string; content: string }>,
  opts: { maxTokens?: number; temperature?: number; jsonMode?: boolean } = {}
): Promise<InvokeResult> {
  const modelId = OPENROUTER_MODELS[modelAlias as ModelAlias] || modelAlias;
  
  return invokeLLM({
    model: modelId,
    messages: messages.map(m => ({ role: m.role as any, content: m.content })),
    maxTokens: opts.maxTokens || 4096,
    temperature: opts.temperature ?? 0.7,
    response_format: opts.jsonMode ? { type: "json_object" } : undefined,
  });
}

function extractText(result: InvokeResult): string {
  return result.choices[0]?.message?.content || "";
}

function parseJSON(result: InvokeResult): any {
  const text = extractText(result);
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown code blocks
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1]); } catch {}
    }
    return null;
  }
}

export const agenticRouter = router({
  // ─── Available Models ─────────────────────────────────────
  models: protectedProcedure.query(() => {
    const available: Array<{ id: string; name: string; provider: string; available: boolean }> = [];
    
    if (ENV.anthropicApiKey) {
      available.push({ id: "claude-sonnet", name: "Claude Sonnet 4", provider: "Anthropic", available: true });
    }
    if (ENV.openaiApiKey) {
      available.push({ id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", available: true });
      available.push({ id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", available: true });
    }
    if (ENV.openrouterApiKey) {
      available.push({ id: "gemini-flash", name: "Gemini 2.0 Flash", provider: "Google (via OpenRouter)", available: true });
      available.push({ id: "gemini-pro", name: "Gemini 2.5 Pro", provider: "Google (via OpenRouter)", available: true });
      available.push({ id: "llama-70b", name: "Llama 3.3 70B", provider: "Meta (via OpenRouter)", available: true });
      available.push({ id: "deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek (via OpenRouter)", available: true });
      if (!ENV.anthropicApiKey) {
        available.push({ id: "claude-sonnet", name: "Claude Sonnet 4", provider: "Anthropic (via OpenRouter)", available: true });
      }
    }
    if (ENV.geminiApiKey) {
      available.push({ id: "gemini-native", name: "Gemini (Native)", provider: "Google", available: true });
    }
    
    return { models: available, hasOpenRouter: !!ENV.openrouterApiKey };
  }),

  // ─── Autonomous Research → Draft Pipeline ─────────────────
  autonomousDraft: protectedProcedure
    .input(z.object({
      topic: z.string().min(3),
      targetPublication: z.string().optional(),
      brandVoice: z.string().optional(),
      template: z.string().optional(),
      wordCount: z.number().min(300).max(10000).default(2000),
      model: z.string().default("claude-sonnet"),
      depth: z.enum(["quick", "standard", "deep"]).default("standard"),
    }))
    .mutation(async ({ ctx, input }) => {
      const steps: Array<{ step: string; status: string; data?: any }> = [];

      // Step 1: Research the topic
      const researchPrompt = `You are an elite research analyst. Conduct comprehensive research on this topic and return actionable intelligence for a journalist.

Topic: ${input.topic}
${input.targetPublication ? `Target Publication: ${input.targetPublication}` : ""}
Depth: ${input.depth}

Return JSON:
{
  "keyFacts": ["<fact with source>", ...],
  "statistics": [{"stat": "<statistic>", "source": "<source>", "year": "<year>"}],
  "expertQuotes": [{"name": "<expert>", "title": "<title>", "quote": "<actual or attributed quote>"}],
  "trendAnalysis": "<paragraph analyzing current trends>",
  "competitorAngles": ["<what other publications have written>"],
  "uniqueAngle": "<a fresh, unexplored angle for this piece>",
  "suggestedSources": ["<source to interview or cite>"]
}`;

      const researchResult = await invokeWithModel(
        input.depth === "deep" ? "claude-sonnet" : (input.model || "gemini-flash"),
        [
          { role: "system", content: "You are a senior research analyst at a Bloomberg-caliber newsroom. Return ONLY valid JSON." },
          { role: "user", content: researchPrompt },
        ],
        { maxTokens: input.depth === "deep" ? 4096 : 2048, jsonMode: true }
      );

      const research = parseJSON(researchResult) || { keyFacts: [], statistics: [], uniqueAngle: input.topic };
      steps.push({ step: "research", status: "complete", data: research });

      // Step 2: Create detailed outline
      const outlinePrompt = `Based on this research, create a detailed article outline.

Topic: ${input.topic}
Research Findings:
- Key Facts: ${(research.keyFacts || []).slice(0, 5).join("; ")}
- Statistics: ${(research.statistics || []).map((s: any) => s.stat).slice(0, 5).join("; ")}
- Unique Angle: ${research.uniqueAngle || input.topic}
${input.targetPublication ? `Target Publication: ${input.targetPublication}` : ""}
${input.template ? `Template Style: ${input.template}` : ""}
Target Word Count: ${input.wordCount}

Return JSON:
{
  "headline": "<compelling headline>",
  "subheadline": "<supporting subheadline>",
  "sections": [
    {"heading": "<section heading>", "keyPoints": ["<point>"], "wordTarget": <number>, "purpose": "<section purpose>"}
  ],
  "hookStrategy": "<how to open the article>",
  "closingStrategy": "<how to end with impact>",
  "seoKeywords": ["<keyword>"]
}`;

      const outlineResult = await invokeWithModel(input.model, [
        { role: "system", content: "You are an elite editorial strategist. Return ONLY valid JSON." },
        { role: "user", content: outlinePrompt },
      ], { maxTokens: 2048, jsonMode: true });

      const outline = parseJSON(outlineResult) || { headline: input.topic, sections: [] };
      steps.push({ step: "outline", status: "complete", data: outline });

      // Step 3: Write the full article
      const draftPrompt = `Write a complete, publication-ready article based on this outline and research.

Headline: ${outline.headline || input.topic}
${outline.subheadline ? `Subheadline: ${outline.subheadline}` : ""}

OUTLINE:
${(outline.sections || []).map((s: any, i: number) => `${i + 1}. ${s.heading} (${s.wordTarget || 300} words) - ${s.purpose || ""}\n   Key points: ${(s.keyPoints || []).join(", ")}`).join("\n")}

RESEARCH TO INCORPORATE:
Statistics: ${(research.statistics || []).map((s: any) => `${s.stat} (${s.source}, ${s.year})`).join("; ")}
Expert Voices: ${(research.expertQuotes || []).map((q: any) => `${q.name}, ${q.title}: "${q.quote}"`).join("; ")}
Key Facts: ${(research.keyFacts || []).slice(0, 8).join("; ")}

${input.brandVoice ? `BRAND VOICE: ${input.brandVoice}` : ""}
${input.targetPublication ? `TARGET PUBLICATION: ${input.targetPublication} — match their editorial style and standards.` : ""}

Hook Strategy: ${outline.hookStrategy || "Start with a compelling data point or scene"}
Closing Strategy: ${outline.closingStrategy || "End with actionable insight"}
Target: ${input.wordCount} words
SEO Keywords to weave in: ${(outline.seoKeywords || []).join(", ")}

REQUIREMENTS:
- Write in markdown format with ## headings
- Include specific data points with inline citations
- Use vivid, concrete language — no vague generalities
- Every paragraph must earn its place
- Weave expert quotes naturally into the narrative
- End sections with bridge sentences that pull readers forward
- Include a compelling meta description at the end as a comment`;

      const draftResult = await invokeWithModel(input.model, [
        {
          role: "system",
          content: `You are an elite journalist who writes for ${input.targetPublication || "tier-1 publications like Bloomberg, The Atlantic, and Harvard Business Review"}. Your writing is crisp, authoritative, and data-rich. You never pad with filler. Every sentence advances the narrative.${input.brandVoice ? ` Brand voice: ${input.brandVoice}` : ""}`,
        },
        { role: "user", content: draftPrompt },
      ], { maxTokens: Math.min(8192, Math.ceil(input.wordCount * 2)), temperature: 0.8 });

      const draftText = extractText(draftResult);
      steps.push({ step: "draft", status: "complete" });

      // Save to DB
      const db = await getDb();
      let articleId: number | undefined;
      if (db) {
        const [res] = await db.insert(articles).values({
          userId: ctx.user.id,
          title: outline.headline || input.topic,
          content: draftText,
          template: input.template,
          brandVoice: input.brandVoice,
          wordCount: draftText.split(/\s+/).length,
          targetPublication: input.targetPublication,
          status: "draft",
        }).$returningId();
        articleId = res.id;
      }

      return {
        success: true,
        articleId,
        headline: outline.headline || input.topic,
        content: draftText,
        wordCount: draftText.split(/\s+/).length,
        research,
        outline,
        steps,
        usage: {
          researchTokens: researchResult.usage?.total_tokens || 0,
          outlineTokens: outlineResult.usage?.total_tokens || 0,
          draftTokens: draftResult.usage?.total_tokens || 0,
          totalTokens: (researchResult.usage?.total_tokens || 0) +
                       (outlineResult.usage?.total_tokens || 0) +
                       (draftResult.usage?.total_tokens || 0),
        },
      };
    }),

  // ─── Enhance Specific Section ─────────────────────────────
  enhanceSection: protectedProcedure
    .input(z.object({
      content: z.string(),
      instruction: z.string(),
      fullArticleContext: z.string().optional(),
      model: z.string().default("claude-sonnet"),
      targetPublication: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeWithModel(input.model, [
        {
          role: "system",
          content: `You are an elite editor at ${input.targetPublication || "a tier-1 publication"}. Enhance the given section based on the instruction. Return the improved section in markdown. Maintain the same format and heading structure. Be aggressive about improving quality — every word must earn its place.`,
        },
        {
          role: "user",
          content: `INSTRUCTION: ${input.instruction}

SECTION TO ENHANCE:
${input.content}

${input.fullArticleContext ? `FULL ARTICLE CONTEXT (for coherence):\n${input.fullArticleContext.slice(0, 3000)}` : ""}

Return the enhanced section. If you add data points, cite sources. If you restructure, explain why in a brief editorial note at the end wrapped in <!-- --> comments.`,
        },
      ], { maxTokens: 4096, temperature: 0.7 });

      return {
        success: true,
        enhancedContent: extractText(result),
        usage: result.usage,
      };
    }),

  // ─── Multi-Model Comparison ───────────────────────────────
  compare: protectedProcedure
    .input(z.object({
      prompt: z.string(),
      systemPrompt: z.string().optional(),
      models: z.array(z.string()).min(2).max(4),
    }))
    .mutation(async ({ input }) => {
      const results = await Promise.allSettled(
        input.models.map(async (model) => {
          const result = await invokeWithModel(model, [
            { role: "system", content: input.systemPrompt || "You are a helpful AI assistant." },
            { role: "user", content: input.prompt },
          ], { maxTokens: 2048 });
          return { model, text: extractText(result), tokens: result.usage?.total_tokens || 0 };
        })
      );

      return {
        success: true,
        comparisons: results.map((r, i) => ({
          model: input.models[i],
          ...(r.status === "fulfilled" ? r.value : { text: `Error: ${(r as any).reason?.message}`, tokens: 0 }),
        })),
      };
    }),

  // ─── Intelligent Rewrite ──────────────────────────────────
  rewrite: protectedProcedure
    .input(z.object({
      content: z.string(),
      style: z.enum([
        "simplify", "academic", "journalistic", "storytelling",
        "data-driven", "persuasive", "conversational", "executive",
      ]),
      model: z.string().default("claude-sonnet"),
      targetPublication: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const stylePrompts: Record<string, string> = {
        simplify: "Simplify this for a general audience. Use short sentences, common words, and clear explanations. Remove jargon.",
        academic: "Rewrite in an academic style with formal language, passive constructions where appropriate, citations style, and thorough analysis.",
        journalistic: "Rewrite in crisp journalistic style — inverted pyramid, strong lede, concrete details, active voice, attribution.",
        storytelling: "Rewrite as a compelling narrative with scene-setting, characters, tension, and resolution. Show don't tell.",
        "data-driven": "Rewrite emphasizing data and evidence. Lead with numbers, add statistical context, compare metrics, cite sources precisely.",
        persuasive: "Rewrite to persuade. Use rhetorical techniques, emotional appeals backed by logic, strong calls to action.",
        conversational: "Rewrite in a warm, conversational tone. Use contractions, rhetorical questions, and relatable examples.",
        executive: "Rewrite as an executive brief. Lead with conclusion, use bullet points for key insights, minimize narrative, maximize signal.",
      };

      const result = await invokeWithModel(input.model, [
        {
          role: "system",
          content: `You are a world-class editor. ${stylePrompts[input.style]}${input.targetPublication ? ` Match the editorial standards of ${input.targetPublication}.` : ""} Return only the rewritten content in markdown format.`,
        },
        { role: "user", content: `Rewrite this content:\n\n${input.content}` },
      ], { maxTokens: 4096, temperature: 0.7 });

      return {
        success: true,
        rewrittenContent: extractText(result),
        style: input.style,
        usage: result.usage,
      };
    }),

  // ─── AI-Powered Fact Check ────────────────────────────────
  factCheck: protectedProcedure
    .input(z.object({
      content: z.string(),
      model: z.string().default("claude-sonnet"),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeWithModel(input.model, [
        {
          role: "system",
          content: "You are a senior fact-checker at a major publication. Analyze the content for factual claims, statistics, and attributions. Flag anything that needs verification. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `Fact-check this article content:

${input.content.slice(0, 8000)}

Return JSON:
{
  "overallConfidence": <0-100>,
  "claims": [
    {
      "claim": "<the specific claim>",
      "status": "verified|unverified|questionable|incorrect",
      "confidence": <0-100>,
      "note": "<explanation or correction>",
      "suggestedSource": "<where to verify>"
    }
  ],
  "missingAttributions": ["<statement needing a source>"],
  "suggestions": ["<improvement suggestion>"]
}`,
        },
      ], { maxTokens: 4096, jsonMode: true });

      return {
        success: true,
        data: parseJSON(result) || { overallConfidence: 0, claims: [] },
        usage: result.usage,
      };
    }),

  // ─── SEO Optimization ─────────────────────────────────────
  optimizeSEO: protectedProcedure
    .input(z.object({
      title: z.string(),
      content: z.string(),
      targetKeywords: z.array(z.string()).optional(),
      model: z.string().default("gpt-4o-mini"),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeWithModel(input.model, [
        {
          role: "system",
          content: "You are an SEO expert for editorial content. Optimize without sacrificing journalistic quality. Return ONLY valid JSON.",
        },
        {
          role: "user",
          content: `Analyze and optimize this article for SEO:

Title: ${input.title}
${input.targetKeywords?.length ? `Target Keywords: ${input.targetKeywords.join(", ")}` : ""}

Content (first 4000 chars):
${input.content.slice(0, 4000)}

Return JSON:
{
  "currentScore": <0-100>,
  "optimizedTitle": "<SEO-optimized title>",
  "metaDescription": "<155 char meta description>",
  "suggestedKeywords": ["<keyword>"],
  "headingOptimizations": [{"original": "<heading>", "optimized": "<better heading>"}],
  "contentSuggestions": ["<specific SEO improvement>"],
  "internalLinkOpportunities": ["<topic to link to>"],
  "schemaMarkup": "<suggested schema type>"
}`,
        },
      ], { maxTokens: 2048, jsonMode: true });

      return {
        success: true,
        data: parseJSON(result) || { currentScore: 0 },
        usage: result.usage,
      };
    }),

  // ─── Continue Writing (AI Autocomplete) ───────────────────
  continueWriting: protectedProcedure
    .input(z.object({
      content: z.string(),
      instruction: z.string().optional(),
      model: z.string().default("claude-sonnet"),
      wordCount: z.number().default(300),
      brandVoice: z.string().optional(),
      targetPublication: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeWithModel(input.model, [
        {
          role: "system",
          content: `You are a skilled writer continuing an article in progress. Match the tone, style, and voice of the existing content perfectly. Write approximately ${input.wordCount} words. ${input.brandVoice ? `Brand voice: ${input.brandVoice}.` : ""} ${input.targetPublication ? `Target publication: ${input.targetPublication}.` : ""} Return only the continuation — do not repeat existing content.`,
        },
        {
          role: "user",
          content: `${input.instruction ? `INSTRUCTION: ${input.instruction}\n\n` : ""}Continue this article naturally:\n\n${input.content.slice(-3000)}`,
        },
      ], { maxTokens: Math.min(4096, input.wordCount * 3), temperature: 0.8 });

      return {
        success: true,
        continuation: extractText(result),
        usage: result.usage,
      };
    }),
});
