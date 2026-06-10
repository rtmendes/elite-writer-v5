/**
 * Integration Bridges Router — Cross-Feature Connective Tissue
 * 
 * Wires together all Elite Writer modules into seamless end-to-end workflows:
 * 
 * Bridge 1: Strategy → Queue (auto-save generated articles into articles table)
 * Bridge 2: Humanizer → Writer (humanize article content in-place)
 * Bridge 3: GEO Enhancement → Article Pipeline (auto-enhance AEO/GEO signals)
 * Bridge 4: Publication Templates (format + structure per publication style)
 * Bridge 5: Product Context → Writer (inject product/brand data into articles)
 * Bridge 6: GIVE Data Viz → Inline Embeds (embed visualizations in articles)
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import {
  articles,
  brands,
  products,
  contentStrategies,
  brandContexts,
} from "../../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { syncArticleToPipeline } from "../lib/supabase-sync";

const GIVE_API_BASE = "https://give.insightprofit.live";

// ─── Publication Template Definitions ────────────────────────
// Maps publication slug → structural template (formatting, section order, tone rules)
const PUBLICATION_TEMPLATES: Record<string, {
  name: string;
  structure: string[];
  wordRange: [number, number];
  toneRules: string;
  formatNotes: string;
  sectionTemplate: string;
}> = {
  forbes: {
    name: "Forbes",
    structure: ["Hook (personal anecdote or bold claim)", "Context & Data", "3 Key Insights (subheaded)", "Expert Quotes", "Actionable Takeaway", "Author CTA"],
    wordRange: [800, 1500],
    toneRules: "First-person 'I' voice. Authoritative yet accessible. Expert positioning. No academic jargon.",
    formatNotes: "Thought leadership format. Clear subheadings every 200-300 words. Data + personal experience hybrid.",
    sectionTemplate: "## {heading}\n\n{content}\n\n> **Key insight:** {takeaway}\n",
  },
  bloomberg: {
    name: "Bloomberg",
    structure: ["News Lede (who/what/when/where)", "Market Context", "Data Analysis", "Expert Sources (3+)", "Industry Implications", "Forward-Looking Assessment"],
    wordRange: [2000, 4000],
    toneRules: "Authoritative, measured. Financial terminology without definition. No superlatives without data.",
    formatNotes: "Investigative/analytical journalism. 3+ named sources required. Original analysis only.",
    sectionTemplate: "## {heading}\n\n{content}\n\n---\n",
  },
  "harvard-business-review": {
    name: "Harvard Business Review",
    structure: ["Research Question / Thesis", "Literature Context", "Case Study Evidence", "Framework / Model", "Practical Application", "Limitations & Future Research", "Executive Summary Box"],
    wordRange: [1500, 3000],
    toneRules: "Scholarly but accessible. Structured argumentation. Nuanced, acknowledge counterarguments.",
    formatNotes: "Research-backed analysis with case studies. Evidence-based. Clear framework/model.",
    sectionTemplate: "## {heading}\n\n{content}\n\n**Implication for practitioners:** {takeaway}\n",
  },
  wired: {
    name: "Wired",
    structure: ["Scene-Setting Narrative", "The Problem / Tension", "Character Introduction", "Technical Deep-Dive", "Broader Implications", "Resolution / Looking Ahead"],
    wordRange: [2000, 5000],
    toneRules: "Narrative and literary. Scene-setting openings. Intellectual curiosity as default mode.",
    formatNotes: "Long-form narrative tech journalism. No listicles. Character development required.",
    sectionTemplate: "## {heading}\n\n{content}\n",
  },
  "the-atlantic": {
    name: "The Atlantic",
    structure: ["Provocative Opening / Essay Hook", "Historical Context", "Central Argument", "Counter-Argument", "Evidence & Analysis", "Synthesis & Call to Reflection"],
    wordRange: [2000, 6000],
    toneRules: "Intellectual, measured. Historical awareness. Willingness to sit with complexity. Elegant prose.",
    formatNotes: "Essay-length arguments. Historical context required. Contrarian viewpoints welcome.",
    sectionTemplate: "## {heading}\n\n{content}\n",
  },
  "fast-company": {
    name: "Fast Company",
    structure: ["Innovation Hook", "The Disruptor / Company Profile", "How It Works", "Design Thinking Angle", "Broader Lessons", "What's Next"],
    wordRange: [1000, 2000],
    toneRules: "Energetic and forward-looking. Optimistic about innovation but not naive. Design-aware.",
    formatNotes: "Innovation profiles + analysis. Company/person profiles with broader lessons.",
    sectionTemplate: "## {heading}\n\n{content}\n",
  },
  "new-york-times": {
    name: "New York Times",
    structure: ["Narrative Lede", "Nut Graf", "Background / Context", "Reporting (Sources)", "Analysis", "Kicker"],
    wordRange: [1500, 5000],
    toneRules: "Precise, authoritative, understated. 'Show, don't tell' journalism.",
    formatNotes: "Feature reporting. 5+ named sources. Original reporting required.",
    sectionTemplate: "## {heading}\n\n{content}\n",
  },
  cosmopolitan: {
    name: "Cosmopolitan",
    structure: ["Relatable Hook", "The Situation", "Expert Advice / Tips", "Real-World Examples", "The Bottom Line"],
    wordRange: [800, 1500],
    toneRules: "Fun, confident, slightly irreverent. Best friend giving advice. Inclusive language.",
    formatNotes: "Voice-driven. Trend-forward. Personal experience + reported elements. Listicle format welcome.",
    sectionTemplate: "## {heading}\n\n{content}\n\n💡 *{takeaway}*\n",
  },
  "scientific-american": {
    name: "Scientific American",
    structure: ["Research Discovery Hook", "Study Methodology", "Key Findings", "Expert Commentary", "Broader Scientific Context", "Implications & Future Research"],
    wordRange: [1500, 3000],
    toneRules: "Precise and measured. Scientific rigor without jargon overload.",
    formatNotes: "Research translation. Must cite specific studies. Expert-authored preferred.",
    sectionTemplate: "## {heading}\n\n{content}\n\n*Source: {source}*\n",
  },
  vox: {
    name: "Vox",
    structure: ["What You Need to Know", "Why This Matters", "The Background", "What Experts Say", "What Happens Next", "The Bottom Line"],
    wordRange: [1500, 3000],
    toneRules: "Accessible and explanatory. No assumed knowledge. Data-driven but conversational.",
    formatNotes: "Explainer format. Question-based subheadings. Card-stack friendly.",
    sectionTemplate: "### {heading}\n\n{content}\n",
  },
};

export const bridgesRouter = router({
  // ═══════════════════════════════════════════════════════════
  // BRIDGE 1: Strategy → Queue Pipeline
  // Saves strategy-generated articles into the articles table
  // so they flow through the standard Queue → Publications pipeline
  // ═══════════════════════════════════════════════════════════
  strategyToQueue: protectedProcedure
    .input(z.object({
      strategyId: z.number(),
      clusterIndex: z.number().optional(),
      targetPublication: z.string().optional(),
      brandVoice: z.string().optional(),
      brandContextId: z.number().optional(),
      productIds: z.array(z.number()).optional(),
      humanize: z.boolean().default(false),
      geoEnhance: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // 1. Load strategy
      const [strategy] = await db.select().from(contentStrategies)
        .where(and(eq(contentStrategies.id, input.strategyId), eq(contentStrategies.userId, ctx.user.id)));
      if (!strategy) throw new Error("Strategy not found");

      const clusters = (strategy.clusters as any[]) || [];
      const targetClusters = input.clusterIndex !== undefined
        ? [clusters[input.clusterIndex]].filter(Boolean)
        : clusters.filter(c => c.status === "planned");

      if (targetClusters.length === 0) {
        return { message: "No planned articles to generate", articles: [] };
      }

      // 2. Load brand context if specified
      let brandContext = "";
      if (input.brandContextId) {
        const [bc] = await db.select().from(brandContexts)
          .where(and(eq(brandContexts.id, input.brandContextId), eq(brandContexts.userId, ctx.user.id)));
        if (bc) {
          brandContext = `\nBrand: ${bc.name}\nVoice: ${bc.voice || "professional"}\nTone: ${bc.tone || ""}\nValues: ${(bc.values as string[] || []).join(", ")}\n`;
        }
      }

      // 3. Load product context if specified
      let productContext = "";
      if (input.productIds?.length) {
        const prods = await db.select().from(products)
          .where(and(eq(products.userId, ctx.user.id)));
        const selectedProds = prods.filter(p => input.productIds!.includes(p.id));
        if (selectedProds.length > 0) {
          productContext = `\nProducts to naturally reference where relevant:\n${selectedProds.map(p => `- ${p.name}: ${p.description || ""} (${p.type}, $${p.price})`).join("\n")}\nWeave product mentions naturally — never force. Only reference where genuinely relevant to the reader's needs.\n`;
        }
      }

      // 4. Load publication template if specified
      let templateContext = "";
      const pubTemplate = input.targetPublication ? PUBLICATION_TEMPLATES[input.targetPublication] : null;
      if (pubTemplate) {
        templateContext = `\nPublication: ${pubTemplate.name}
Structure: ${pubTemplate.structure.join(" → ")}
Word Range: ${pubTemplate.wordRange[0]}-${pubTemplate.wordRange[1]} words
Tone: ${pubTemplate.toneRules}
Format: ${pubTemplate.formatNotes}\n`;
      }

      // 5. Generate articles (limit to 3 to avoid timeout — each needs 2-4 LLM calls)
      const savedArticles: Array<{ id: number; title: string; wordCount: number; score: number }> = [];
      const errors: Array<{ title: string; error: string }> = [];

      for (const cluster of targetClusters.slice(0, 3)) {
        try {
        // Generate with full context
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an elite journalist writing for ${pubTemplate?.name || "a top-tier publication"}. 
${pubTemplate?.toneRules || "Write with authority and precision."}
${brandContext}${productContext}${templateContext}
No AI clichés. No "delve", "leverage", "game-changer", "seamlessly". US English only. Every sentence earns its place.`,
            },
            {
              role: "user",
              content: `Write a complete, publication-ready article.

Topic: "${cluster.title}"
Part of strategy: "${strategy.pillarTopic}" (keyword: "${strategy.primaryKeyword}")
Target keyword: "${cluster.keyword}"
Intent: ${cluster.intent || "informational"}

Requirements:
- ${pubTemplate?.wordRange ? `${pubTemplate.wordRange[0]}-${pubTemplate.wordRange[1]}` : "1200-2000"} words
- SEO optimized for target keyword
- GEO/AEO optimized (structured for AI citation with clear definitions, FAQ schema, entity markup)
- Include FAQ section with 3-5 questions in schema-ready format
- Data points with inline citations
- Markdown format with ## headings
${pubTemplate ? `- Follow ${pubTemplate.name} structure: ${pubTemplate.structure.join(" → ")}` : ""}

Write the full article in markdown.`,
            },
          ],
          maxTokens: 6144,
          temperature: 0.7,
        });

        let content = result.choices[0]?.message?.content || "";
        const title = cluster.title;

        // Optional: Humanize pass
        if (input.humanize && content) {
          const humanizeResult = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "You are a copy editor specializing in making AI-generated content sound naturally human. Remove patterns that AI detectors flag: overly uniform sentence length, predictable paragraph structure, lack of personal voice, excessive hedging. Add natural imperfections — varied rhythm, occasional colloquialisms, genuine voice. Return ONLY the rewritten content.",
              },
              {
                role: "user",
                content: `Humanize this article while preserving all facts, data, and structure:\n\n${content}`,
              },
            ],
            maxTokens: 6144,
            temperature: 0.8,
          });
          content = humanizeResult.choices[0]?.message?.content || content;
        }

        // Optional: GEO Enhancement pass
        if (input.geoEnhance && content) {
          const geoResult = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a GEO (Generative Engine Optimization) specialist. Enhance this article for AI search visibility without damaging readability. Return ONLY the enhanced article.

GEO Enhancement Checklist:
1. Add clear, quotable definitions for key terms (AI models cite these)
2. Structure FAQ section in schema.org format
3. Add "According to [source]" attributions (AI models prefer attributed claims)
4. Include comparison tables where relevant (AI models love structured data)
5. Add a TL;DR / Key Takeaways section at the top
6. Ensure entity consistency (use full names before abbreviations)
7. Add structured data hints (dates, numbers, proper nouns)`,
              },
              {
                role: "user",
                content: `Enhance this article for GEO/AEO while keeping it publication-ready:\n\n${content}`,
              },
            ],
            maxTokens: 6144,
            temperature: 0.5,
          });
          content = geoResult.choices[0]?.message?.content || content;
        }

        // Score the article
        const scoreResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "Editorial quality assessor. Score 1-10. Return ONLY JSON.",
            },
            {
              role: "user",
              content: `Score this article:\n${content.slice(0, 3000)}\n\nReturn JSON: {"overall":<1-10>,"strengths":["..."],"improvements":["..."]}`,
            },
          ],
          response_format: { type: "json_object" },
          maxTokens: 512,
        });

        let scoreData: any = { overall: 5 };
        try {
          scoreData = JSON.parse(scoreResult.choices[0]?.message?.content || "{}");
        } catch {}

        // Save to articles table
        const wordCount = content.trim().split(/\s+/).length;
        const [saved] = await db.insert(articles).values({
          userId: ctx.user.id,
          title,
          content,
          template: pubTemplate ? `publication:${input.targetPublication}` : null,
          brandVoice: input.brandVoice || null,
          wordCount,
          status: "scored",
          overallScore: scoreData.overall || null,
          scoreData,
          targetPublication: input.targetPublication || null,
        }).$returningId();

        savedArticles.push({
          id: saved.id,
          title,
          wordCount,
          score: scoreData.overall || 0,
        });
        } catch (clusterErr: any) {
          errors.push({ title: cluster.title, error: clusterErr.message || "Generation failed" });
          continue;
        }
      }

      // Update strategy status
      await db.update(contentStrategies).set({
        status: "executing",
      }).where(eq(contentStrategies.id, input.strategyId));

      return {
        success: true,
        articlesCreated: savedArticles.length,
        articles: savedArticles,
        errors: errors.length > 0 ? errors : undefined,
        message: `${savedArticles.length} articles saved to Queue${errors.length > 0 ? ` (${errors.length} failed)` : ""}${input.humanize ? " (humanized)" : ""}${input.geoEnhance ? " (GEO enhanced)" : ""}`,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // BRIDGE 2: Humanizer → Writer (in-place humanization)
  // Takes an article ID and humanizes its content in the DB
  // ═══════════════════════════════════════════════════════════
  humanizeArticle: protectedProcedure
    .input(z.object({
      articleId: z.number(),
      intensity: z.enum(["light", "moderate", "heavy"]).default("moderate"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [article] = await db.select().from(articles)
        .where(and(eq(articles.id, input.articleId), eq(articles.userId, ctx.user.id)));
      if (!article) throw new Error("Article not found");
      if (!article.content) throw new Error("Article has no content");

      const intensityInstructions: Record<string, string> = {
        light: "Make subtle adjustments: vary sentence rhythm, add occasional conversational phrases, remove robotic transitions. Keep 95% of the original structure.",
        moderate: "Rewrite for natural human voice: vary paragraph lengths, add personal touches, break predictable patterns, use occasional colloquialisms. Keep core arguments and data intact.",
        heavy: "Fully rewrite in an authentic human voice: add personal anecdotes or observations, use unexpected word choices, vary dramatically between short punchy sentences and longer flowing ones. Restructure where it improves flow. Preserve all facts and citations.",
      };

      // Step 1: Detect AI patterns
      const detectResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an AI detection expert. Analyze writing for AI-generated patterns. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Analyze this text for AI patterns:\n\n${article.content.slice(0, 4000)}\n\nReturn JSON:\n{\n  "aiScore": <0-100, higher = more likely AI>,\n  "patterns": ["<specific AI pattern found>"],\n  "humanElements": ["<existing human-like elements to preserve>"]\n}`,
          },
        ],
        response_format: { type: "json_object" },
        maxTokens: 512,
      });

      let detection: any = { aiScore: 50 };
      try { detection = JSON.parse(detectResult.choices[0]?.message?.content || "{}"); } catch {}

      // Step 2: Humanize
      const humanizeResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a master editor who makes AI-generated content indistinguishable from human writing.

${intensityInstructions[input.intensity]}

AI patterns detected to fix:
${(detection.patterns || []).map((p: string) => `- ${p}`).join("\n")}

Human elements to preserve:
${(detection.humanElements || []).map((h: string) => `- ${h}`).join("\n")}

Return ONLY the humanized article in markdown. Do not add commentary.`,
          },
          {
            role: "user",
            content: `Humanize this article:\n\n${article.content}`,
          },
        ],
        maxTokens: Math.min(16384, Math.max(8192, Math.ceil(article.content.length / 3))),
        temperature: input.intensity === "heavy" ? 0.9 : input.intensity === "moderate" ? 0.8 : 0.7,
      });

      const humanizedContent = humanizeResult.choices[0]?.message?.content || article.content;
      const newWordCount = humanizedContent.trim().split(/\s+/).length;

      // Step 3: Verify humanization worked
      const verifyResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "AI detection expert. Return ONLY JSON: {\"aiScore\": <0-100>}",
          },
          {
            role: "user",
            content: `Check AI score:\n\n${humanizedContent.slice(0, 3000)}`,
          },
        ],
        response_format: { type: "json_object" },
        maxTokens: 128,
      });

      let newAiScore = 50;
      try { newAiScore = JSON.parse(verifyResult.choices[0]?.message?.content || "{}").aiScore || 50; } catch {}

      // Save back to DB
      await db.update(articles).set({
        content: humanizedContent,
        wordCount: newWordCount,
      }).where(eq(articles.id, input.articleId));

      return {
        success: true,
        articleId: input.articleId,
        beforeAiScore: detection.aiScore,
        afterAiScore: newAiScore,
        improvement: (detection.aiScore || 50) - newAiScore,
        patternsFixed: detection.patterns?.length || 0,
        wordCount: newWordCount,
        intensity: input.intensity,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // BRIDGE 3: GEO Enhancement → Article Pipeline
  // Enhances an existing article with GEO/AEO signals
  // ═══════════════════════════════════════════════════════════
  geoEnhanceArticle: protectedProcedure
    .input(z.object({
      articleId: z.number(),
      targetKeywords: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [article] = await db.select().from(articles)
        .where(and(eq(articles.id, input.articleId), eq(articles.userId, ctx.user.id)));
      if (!article) throw new Error("Article not found");
      if (!article.content) throw new Error("Article has no content");

      // Step 1: Score current GEO readiness
      const scoreResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a GEO/AEO specialist. Score how well this article would perform in AI search results. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Score this article for AI search engine visibility:\n\nTitle: ${article.title}\nContent: ${article.content.slice(0, 5000)}\n${input.targetKeywords?.length ? `Target keywords: ${input.targetKeywords.join(", ")}` : ""}\n\nReturn JSON:\n{\n  "geoScore": <0-100>,\n  "aeoScore": <0-100>,\n  "seoScore": <0-100>,\n  "gaps": [\n    {"area": "<what's missing>", "impact": "high|medium|low", "fix": "<specific fix>"}\n  ],\n  "strengths": ["<what's already good for AI citation>"]\n}`,
          },
        ],
        response_format: { type: "json_object" },
        maxTokens: 1024,
      });

      let beforeScores: any = { geoScore: 0, aeoScore: 0, seoScore: 0, gaps: [] };
      try { beforeScores = JSON.parse(scoreResult.choices[0]?.message?.content || "{}"); } catch {}

      // Step 2: Apply GEO enhancements
      const enhanceResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a GEO (Generative Engine Optimization) specialist. Enhance this article for maximum AI search visibility.

Apply these enhancements IN ORDER:
1. ADD a "Key Takeaways" section at the top (3-5 bullet points)
2. ADD clear, quotable definitions for key terms (AI models cite these verbatim)
3. ADD "According to [source]" attributions — AI prefers attributed claims
4. CONVERT data into comparison tables where appropriate
5. ADD an FAQ section at the bottom with 4-6 Q&A pairs in schema-ready format
6. ENSURE entity consistency (full names before abbreviations)
7. ADD structured data hints: specific dates, exact numbers, proper nouns
8. STRENGTHEN topic authority signals: reference related subtopics

Gaps to specifically fix:
${(beforeScores.gaps || []).map((g: any) => `- [${g.impact}] ${g.area}: ${g.fix}`).join("\n")}

Return ONLY the enhanced article in markdown. Preserve the existing voice and publication tone.`,
          },
          {
            role: "user",
            content: `Enhance for GEO/AEO:\n\nTitle: ${article.title}\n${input.targetKeywords?.length ? `Keywords: ${input.targetKeywords.join(", ")}` : ""}\n\n${article.content}`,
          },
        ],
        maxTokens: 8192,
        temperature: 0.5,
      });

      const enhancedContent = enhanceResult.choices[0]?.message?.content || article.content;

      // Step 3: Re-score
      const reScoreResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "GEO specialist. Score AI search readiness. Return ONLY JSON: {\"geoScore\":<0-100>,\"aeoScore\":<0-100>,\"seoScore\":<0-100>}",
          },
          {
            role: "user",
            content: `Score:\n\n${enhancedContent.slice(0, 5000)}`,
          },
        ],
        response_format: { type: "json_object" },
        maxTokens: 256,
      });

      let afterScores: any = { geoScore: 0, aeoScore: 0, seoScore: 0 };
      try { afterScores = JSON.parse(reScoreResult.choices[0]?.message?.content || "{}"); } catch {}

      // Save enhanced content
      const newWordCount = enhancedContent.trim().split(/\s+/).length;
      await db.update(articles).set({
        content: enhancedContent,
        wordCount: newWordCount,
      }).where(eq(articles.id, input.articleId));

      return {
        success: true,
        articleId: input.articleId,
        before: { geo: beforeScores.geoScore, aeo: beforeScores.aeoScore, seo: beforeScores.seoScore },
        after: { geo: afterScores.geoScore, aeo: afterScores.aeoScore, seo: afterScores.seoScore },
        gapsFixed: beforeScores.gaps?.length || 0,
        wordCount: newWordCount,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // BRIDGE 4: Publication Templates
  // Returns structured templates for each publication
  // + applies template to article content
  // ═══════════════════════════════════════════════════════════
  getPublicationTemplates: protectedProcedure
    .query(() => {
      return {
        templates: Object.entries(PUBLICATION_TEMPLATES).map(([slug, t]) => ({
          slug,
          name: t.name,
          structure: t.structure,
          wordRange: t.wordRange,
          toneRules: t.toneRules,
          formatNotes: t.formatNotes,
        })),
      };
    }),

  applyPublicationTemplate: protectedProcedure
    .input(z.object({
      articleId: z.number(),
      publicationSlug: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [article] = await db.select().from(articles)
        .where(and(eq(articles.id, input.articleId), eq(articles.userId, ctx.user.id)));
      if (!article) throw new Error("Article not found");

      const template = PUBLICATION_TEMPLATES[input.publicationSlug];
      if (!template) throw new Error(`No template for publication: ${input.publicationSlug}`);

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a senior editor at ${template.name}. Restructure this article to match ${template.name}'s exact editorial format.

REQUIRED STRUCTURE:
${template.structure.map((s, i) => `${i + 1}. ${s}`).join("\n")}

TONE: ${template.toneRules}
FORMAT: ${template.formatNotes}
WORD RANGE: ${template.wordRange[0]}-${template.wordRange[1]} words

Restructure the content to fit this template while preserving all facts, data, and core arguments. Adjust tone to match ${template.name}'s style. Return ONLY the restructured article in markdown.`,
          },
          {
            role: "user",
            content: `Restructure for ${template.name}:\n\nTitle: ${article.title}\n\n${article.content}`,
          },
        ],
        maxTokens: 8192,
        temperature: 0.7,
      });

      const restructuredContent = result.choices[0]?.message?.content || article.content || "";
      const newWordCount = restructuredContent.trim().split(/\s+/).length;

      await db.update(articles).set({
        content: restructuredContent,
        wordCount: newWordCount,
        targetPublication: input.publicationSlug,
        template: `publication:${input.publicationSlug}`,
      }).where(eq(articles.id, input.articleId));

      return {
        success: true,
        articleId: input.articleId,
        publication: template.name,
        structure: template.structure,
        wordCount: newWordCount,
        wordRange: template.wordRange,
        inRange: newWordCount >= template.wordRange[0] && newWordCount <= template.wordRange[1],
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // BRIDGE 5: Product Context → Writer
  // Enriches article drafting with product/brand context
  // ═══════════════════════════════════════════════════════════
  enrichWithProducts: protectedProcedure
    .input(z.object({
      articleId: z.number(),
      productIds: z.array(z.number()),
      brandId: z.number().optional(),
      insertionStyle: z.enum(["subtle", "moderate", "direct"]).default("subtle"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [article] = await db.select().from(articles)
        .where(and(eq(articles.id, input.articleId), eq(articles.userId, ctx.user.id)));
      if (!article) throw new Error("Article not found");

      // Load products (filtered at query level)
      const selectedProducts = input.productIds.length > 0
        ? await db.select().from(products)
            .where(and(eq(products.userId, ctx.user.id), inArray(products.id, input.productIds)))
        : [];

      // Load brand if specified
      let brand: any = null;
      if (input.brandId) {
        const [b] = await db.select().from(brands)
          .where(and(eq(brands.id, input.brandId), eq(brands.userId, ctx.user.id)));
        brand = b;
      }

      const styleInstructions: Record<string, string> = {
        subtle: "Weave product mentions as natural examples or recommendations within the existing narrative. Never break the editorial flow. The reader should not feel sold to. Use phrases like 'tools like [Product]' or 'solutions such as [Product]'.",
        moderate: "Include a dedicated section or callout box for each relevant product. Frame as expert recommendations. Use 'Recommended Resource:' or 'Editor's Pick:' labels.",
        direct: "Include clear product mentions with value propositions. Add a 'Recommended Solutions' section. Include pricing where relevant. Still maintain editorial credibility.",
      };

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a content strategist who seamlessly integrates product mentions into editorial content.

${styleInstructions[input.insertionStyle]}

${brand ? `Brand context: ${brand.name} — ${brand.description || ""} (niche: ${brand.niche || "general"})` : ""}

Products to integrate:
${selectedProducts.map(p => `- ${p.name} (${p.type}): ${p.description || "No description"} — $${p.price}`).join("\n")}

Rules:
- Maintain the article's editorial integrity and publication tone
- Only mention products where genuinely relevant to the content
- Never fabricate product features or benefits
- Preserve all existing content, data, and citations
- Return ONLY the enhanced article in markdown`,
          },
          {
            role: "user",
            content: `Enhance this article with product context:\n\nTitle: ${article.title}\nTarget Publication: ${article.targetPublication || "general"}\n\n${article.content}`,
          },
        ],
        maxTokens: 8192,
        temperature: 0.6,
      });

      const enrichedContent = result.choices[0]?.message?.content || article.content || "";
      const newWordCount = enrichedContent.trim().split(/\s+/).length;

      await db.update(articles).set({
        content: enrichedContent,
        wordCount: newWordCount,
        productId: input.productIds.join(","),
        brandId: input.brandId?.toString() || article.brandId,
      }).where(eq(articles.id, input.articleId));

      return {
        success: true,
        articleId: input.articleId,
        productsIntegrated: selectedProducts.map(p => p.name),
        insertionStyle: input.insertionStyle,
        wordCount: newWordCount,
        brand: brand?.name || null,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // BRIDGE 6: GIVE Data Viz → Inline Embeds
  // Generates data visualizations from article content and
  // returns embed codes for inline insertion
  // ═══════════════════════════════════════════════════════════
  generateInlineViz: protectedProcedure
    .input(z.object({
      articleId: z.number(),
      autoDetect: z.boolean().default(true),
      customPrompts: z.array(z.object({
        sectionHeading: z.string(),
        vizPrompt: z.string(),
        data: z.any().optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [article] = await db.select().from(articles)
        .where(and(eq(articles.id, input.articleId), eq(articles.userId, ctx.user.id)));
      if (!article) throw new Error("Article not found");

      let vizOpportunities: Array<{ section: string; prompt: string; data?: any }> = [];

      if (input.customPrompts?.length) {
        vizOpportunities = input.customPrompts.map(p => ({
          section: p.sectionHeading,
          prompt: p.vizPrompt,
          data: p.data,
        }));
      } else if (input.autoDetect) {
        // Auto-detect visualization opportunities in the article
        const detectResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a data visualization strategist. Identify the best opportunities for inline data visualizations in this article. Return ONLY valid JSON.",
            },
            {
              role: "user",
              content: `Find data viz opportunities in this article:\n\nTitle: ${article.title}\nContent: ${article.content?.slice(0, 6000)}\n\nReturn JSON:\n{\n  "opportunities": [\n    {\n      "section": "<heading or section where viz should go>",\n      "prompt": "<specific GIVE prompt to generate the visualization>",\n      "type": "<chart|dashboard|comparison|timeline|flow>",\n      "dataFromArticle": "<any specific data points from the article to visualize>"\n    }\n  ]\n}`,
            },
          ],
          response_format: { type: "json_object" },
          maxTokens: 1024,
        });

        let detected: any = { opportunities: [] };
        try { detected = JSON.parse(detectResult.choices[0]?.message?.content || "{}"); } catch {}

        vizOpportunities = (detected.opportunities || []).slice(0, 3).map((o: any) => ({
          section: o.section,
          prompt: `${o.prompt}. Data: ${o.dataFromArticle || ""}. Style: clean, minimal, publication-grade. Colors: muted blues and grays.`,
        }));
      }

      if (vizOpportunities.length === 0) {
        return { success: true, visualizations: [], message: "No visualization opportunities found" };
      }

      // Generate each visualization via GIVE API
      const results: Array<{
        section: string;
        embedUrl: string | null;
        iframeCode: string | null;
        markdown: string;
        error?: string;
      }> = [];

      for (const viz of vizOpportunities) {
        try {
          // Generate viz
          const vizRes = await fetch(`${GIVE_API_BASE}/api/visualize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: viz.prompt,
              data: viz.data || {},
              parameters: { style: "publication", theme: "light" },
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (!vizRes.ok) {
            results.push({ section: viz.section, embedUrl: null, iframeCode: null, markdown: "", error: `GIVE API error: ${vizRes.status}` });
            continue;
          }

          const vizData = await vizRes.json() as any;

          if (!vizData.success || !vizData.code) {
            results.push({ section: viz.section, embedUrl: null, iframeCode: null, markdown: "", error: "Visualization generation failed" });
            continue;
          }

          // Generate embed URL
          const embedRes = await fetch(`${GIVE_API_BASE}/api/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: vizData.code, data: viz.data }),
            signal: AbortSignal.timeout(10000),
          });

          if (embedRes.ok) {
            const embedData = await embedRes.json() as any;
            const markdown = `\n\n<div class="data-viz" data-section="${viz.section}">\n\n${embedData.iframeCode || `<iframe src="${embedData.embedUrl}" width="100%" height="400" frameborder="0" loading="lazy"></iframe>`}\n\n*Interactive visualization: ${viz.prompt.slice(0, 100)}*\n\n</div>\n\n`;

            results.push({
              section: viz.section,
              embedUrl: embedData.embedUrl || null,
              iframeCode: embedData.iframeCode || null,
              markdown,
            });
          } else {
            results.push({ section: viz.section, embedUrl: null, iframeCode: null, markdown: "", error: "Embed generation failed" });
          }
        } catch (err: any) {
          results.push({ section: viz.section, embedUrl: null, iframeCode: null, markdown: "", error: err.message });
        }
      }

      // Insert viz markdown into article content at appropriate locations
      const successfulViz = results.filter(r => r.markdown && !r.error);
      if (successfulViz.length > 0 && article.content) {
        let updatedContent = article.content;

        for (const viz of successfulViz) {
          // Try to insert after the matching section heading
          const headingPattern = new RegExp(`(## .*${viz.section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*\\n)`, "i");
          const match = updatedContent.match(headingPattern);

          if (match && match.index !== undefined) {
            // Insert after the heading's first paragraph
            const afterHeading = updatedContent.substring(match.index + match[0].length);
            const firstParaEnd = afterHeading.indexOf("\n\n");
            if (firstParaEnd > 0) {
              const insertPoint = match.index + match[0].length + firstParaEnd;
              updatedContent = updatedContent.substring(0, insertPoint) + viz.markdown + updatedContent.substring(insertPoint);
            } else {
              updatedContent = updatedContent.substring(0, match.index + match[0].length) + viz.markdown + afterHeading;
            }
          } else {
            // Append at end if section heading not found
            updatedContent += viz.markdown;
          }
        }

        await db.update(articles).set({
          content: updatedContent,
          wordCount: updatedContent.trim().split(/\s+/).length,
        }).where(eq(articles.id, input.articleId));
      }

      return {
        success: true,
        articleId: input.articleId,
        visualizations: results,
        inserted: successfulViz.length,
        errors: results.filter(r => r.error).length,
      };
    }),

  // ═══════════════════════════════════════════════════════════
  // BRIDGE: Full Pipeline (feeds → article with all enhancements)
  // One-click: research → draft → humanize → GEO → product → template
  // ═══════════════════════════════════════════════════════════
  fullPipeline: protectedProcedure
    .input(z.object({
      topic: z.string().min(3),
      targetPublication: z.string().optional(),
      brandVoice: z.string().optional(),
      brandContextId: z.number().optional(),
      productIds: z.array(z.number()).optional(),
      humanize: z.boolean().default(true),
      geoEnhance: z.boolean().default(true),
      generateViz: z.boolean().default(false),
      model: z.string().default("claude-sonnet"),
      wordCount: z.number().default(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const steps: Array<{ step: string; status: string; detail?: string }> = [];

      // ─── Step 1: Load all context ───────────────────────
      let brandContext = "";
      if (input.brandContextId) {
        const [bc] = await db.select().from(brandContexts)
          .where(and(eq(brandContexts.id, input.brandContextId), eq(brandContexts.userId, ctx.user.id)));
        if (bc) {
          brandContext = `Brand: ${bc.name}\nVoice: ${bc.voice || "professional"}\nTone: ${bc.tone || ""}`;
        }
      }

      let productContext = "";
      if (input.productIds?.length) {
        const allProducts = await db.select().from(products)
          .where(eq(products.userId, ctx.user.id));
        const selectedProducts = allProducts.filter(p => input.productIds!.includes(p.id));
        productContext = selectedProducts.map(p => `${p.name} (${p.type}): ${p.description || ""}`).join("\n");
      }

      const pubTemplate = input.targetPublication ? PUBLICATION_TEMPLATES[input.targetPublication] : null;

      steps.push({ step: "context", status: "complete", detail: `Brand: ${brandContext ? "loaded" : "none"}, Products: ${input.productIds?.length || 0}, Template: ${pubTemplate?.name || "none"}` });

      // ─── Step 2: Research (Academic APIs + LLM) ──────────
      // 2a: Query real academic databases in parallel with LLM research
      const [academicResults, researchResult] = await Promise.all([
        // Real academic search — OpenAlex + CrossRef + Semantic Scholar
        (async () => {
          try {
            const { academicSearch, formatForLLM } = await import("../lib/academic-search");
            const results = await academicSearch(input.topic, { maxPerSource: 5 });
            return formatForLLM(results, 8);
          } catch { return ""; }
        })(),
        // LLM-generated research context
        invokeLLM({
          messages: [
            { role: "system", content: "Senior research analyst. Return ONLY valid JSON." },
            {
              role: "user",
              content: `Research for publication-grade article:\n\nTopic: ${input.topic}\n${input.targetPublication ? `Target: ${pubTemplate?.name}` : ""}\n\nReturn JSON:\n{"keyFacts":["..."],"statistics":[{"stat":"...","source":"...","year":"..."}],"expertQuotes":[{"name":"...","title":"...","quote":"..."}],"uniqueAngle":"...","suggestedSources":["..."]}`,
            },
          ],
          response_format: { type: "json_object" },
          maxTokens: 3072,
        }),
      ]);

      let research: any = { keyFacts: [], statistics: [] };
      try { research = JSON.parse(researchResult.choices[0]?.message?.content || "{}"); } catch {}
      // Inject academic sources into research context
      if (academicResults) {
        research.academicSources = academicResults;
      }
      steps.push({ step: "research", status: "complete", detail: academicResults ? "with academic sources" : "LLM only" });

      // ─── Step 3: Draft with full context ────────────────
      const systemPrompt = `You are a senior journalist writing for ${pubTemplate?.name || "a top-tier publication"}.
${pubTemplate ? `Structure: ${pubTemplate.structure.join(" → ")}\nTone: ${pubTemplate.toneRules}\nFormat: ${pubTemplate.formatNotes}` : ""}
${brandContext ? `\n${brandContext}` : ""}
${productContext ? `\nProducts to naturally reference:\n${productContext}` : ""}
No AI clichés. US English. Every sentence earns its place.`;

      const draftResult = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Write a complete article.\n\nTopic: ${input.topic}\n\nResearch:\n${JSON.stringify({ keyFacts: research.keyFacts, statistics: research.statistics, expertQuotes: research.expertQuotes, uniqueAngle: research.uniqueAngle }).slice(0, 2500)}\n\n${research.academicSources ? `Academic Sources (cite these real papers where relevant):\n${research.academicSources}\n\n` : ""}Target: ${input.wordCount} words. SEO+GEO optimized. Include FAQ section. Markdown with ## headings. Reference real academic papers where appropriate.`,
          },
        ],
        maxTokens: Math.min(input.wordCount * 2, 8192),
        temperature: 0.75,
      });

      let content = draftResult.choices[0]?.message?.content || "";
      steps.push({ step: "draft", status: "complete", detail: `${content.trim().split(/\s+/).length} words` });

      // ─── Step 4: Humanize ───────────────────────────────
      if (input.humanize && content) {
        const humanResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "Master editor. Make AI content sound naturally human. Vary rhythm, add personal voice, break predictable patterns. Preserve all facts and structure. Return ONLY the rewritten article.",
            },
            { role: "user", content: `Humanize:\n\n${content}` },
          ],
          maxTokens: 8192,
          temperature: 0.8,
        });
        content = humanResult.choices[0]?.message?.content || content;
        steps.push({ step: "humanize", status: "complete" });
      }

      // ─── Step 5: GEO Enhancement ───────────────────────
      if (input.geoEnhance && content) {
        const geoResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "GEO specialist. Add: Key Takeaways section, quotable definitions, attributed claims, FAQ section, structured data hints. Preserve voice. Return ONLY the enhanced article.",
            },
            { role: "user", content: `GEO enhance:\n\n${content}` },
          ],
          maxTokens: 8192,
          temperature: 0.5,
        });
        content = geoResult.choices[0]?.message?.content || content;
        steps.push({ step: "geoEnhance", status: "complete" });
      }

      // ─── Step 6: Proofread ──────────────────────────────
      const proofResult = await invokeLLM({
        messages: [
          { role: "system", content: "Copy editor. Fix AI slop, British spellings, filler. Return corrected article only." },
          { role: "user", content: `Proofread:\n\n${content}` },
        ],
        maxTokens: 8192,
        temperature: 0.3,
      });
      content = proofResult.choices[0]?.message?.content || content;
      steps.push({ step: "proofread", status: "complete" });

      // ─── Step 7: Score ──────────────────────────────────
      const scoreResult = await invokeLLM({
        messages: [
          { role: "system", content: "Score 1-10. Return ONLY JSON." },
          { role: "user", content: `Score:\n${content.slice(0, 3000)}\n\nReturn: {"overall":<1-10>,"dimensions":{"hook":<1-10>,"structure":<1-10>,"evidence":<1-10>,"voice":<1-10>,"originality":<1-10>,"seo":<1-10>,"geo":<1-10>},"strengths":["..."],"improvements":["..."]}` },
        ],
        response_format: { type: "json_object" },
        maxTokens: 512,
      });

      let scoreData: any = { overall: 5 };
      try { scoreData = JSON.parse(scoreResult.choices[0]?.message?.content || "{}"); } catch {}
      steps.push({ step: "score", status: "complete", detail: `Score: ${scoreData.overall}/10` });

      // ─── Step 8: Save to articles table ─────────────────
      const wordCount = content.trim().split(/\s+/).length;
      const [saved] = await db.insert(articles).values({
        userId: ctx.user.id,
        title: input.topic,
        content,
        template: pubTemplate ? `publication:${input.targetPublication}` : null,
        brandVoice: input.brandVoice || null,
        wordCount,
        status: "scored",
        overallScore: scoreData.overall || null,
        scoreData,
        targetPublication: input.targetPublication || null,
        productId: input.productIds?.join(",") || null,
      }).$returningId();

      steps.push({ step: "save", status: "complete", detail: `Article #${saved.id}` });
      syncArticleToPipeline({
        articleId: saved.id, title: input.topic, status: "scored",
        brandId: input.brandContextId != null ? String(input.brandContextId) : null, score: scoreData.overall, wordCount,
        targetPublication: input.targetPublication,
      });

      return {
        success: true,
        articleId: saved.id,
        title: input.topic,
        wordCount,
        score: scoreData.overall,
        scoreData,
        steps,
        pipeline: {
          researched: true,
          drafted: true,
          humanized: input.humanize,
          geoEnhanced: input.geoEnhance,
          proofread: true,
          scored: true,
          saved: true,
        },
        content,
      };
    }),
});
