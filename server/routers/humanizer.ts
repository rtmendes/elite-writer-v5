/**
 * AI Humanizer & Content Quality Suite Router — Blazly-inspired
 * 
 * Features:
 * 1. AI Detection Score — analyze text for AI patterns
 * 2. Humanize — rewrite to reduce AI detection score
 * 3. Plagiarism Check — identify similar content
 * 4. On-Page SEO Score — analyze content for SEO best practices
 * 5. One-Click Refinement — humanize, rewrite, enhance SEO
 * 6. GEO/AEO Content Writer — generate AI-optimized content
 * 7. Content Quality Dashboard — combined scores
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";

export const humanizerRouter = router({
  // ─── AI Detection Score ───────────────────────────────────
  detectAI: protectedProcedure
    .input(z.object({
      text: z.string().min(50, "Need at least 50 characters to analyze"),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an AI content detection expert. Analyze the text for AI-generated patterns.

Look for:
- Repetitive sentence structures
- Overly formal transitions ("Furthermore", "Moreover", "In conclusion")
- Lack of personal anecdotes or specific experiences
- Generic examples without specificity
- Perfect grammar throughout (too perfect)
- Predictable paragraph structures
- Missing colloquialisms or informal language
- Uniform sentence length
- Lack of opinion or emotional expression

Return JSON:
{
  "ai_score": 0-100 (0 = fully human, 100 = definitely AI),
  "confidence": 0-100,
  "patterns_detected": [
    { "pattern": "description", "severity": "high|medium|low", "examples": ["example from text"] }
  ],
  "human_signals": ["signal1", "signal2"],
  "verdict": "likely_human|mixed|likely_ai|definitely_ai",
  "suggestions": ["suggestion to make more human-like"]
}`,
          },
          {
            role: "user",
            content: `Analyze this text for AI patterns:\n\n${input.text}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const text = result.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(text);
      } catch {
        return { ai_score: 50, confidence: 0, patterns_detected: [], verdict: "unknown" };
      }
    }),

  // ─── Humanize Content ─────────────────────────────────────
  humanize: protectedProcedure
    .input(z.object({
      text: z.string().min(50),
      preserveTone: z.boolean().default(true),
      targetAudience: z.string().optional(),
      intensity: z.enum(["light", "moderate", "heavy"]).default("moderate"),
    }))
    .mutation(async ({ input }) => {
      const intensityInstructions = {
        light: "Make subtle changes — fix obvious AI patterns while preserving most of the original structure.",
        moderate: "Rewrite to sound natural — vary sentence structure, add personality, remove formulaic transitions.",
        heavy: "Completely reimagine in a human voice — add personal touches, opinions, colloquialisms, and natural flow.",
      };

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a human writing coach. Rewrite AI-generated content to sound authentically human.

INTENSITY: ${input.intensity}
${intensityInstructions[input.intensity]}

Rules:
- Vary sentence length dramatically (mix short punchy with longer flowing)
- Replace generic transitions with specific connectors or remove them
- Add rhetorical questions, parenthetical asides, personal opinions
- Use contractions naturally (don't → don't, etc.)
- Include specific examples, data points, or anecdotes where possible
- Break perfect paragraph structures (some short, some long)
- Add voice markers (humor, skepticism, enthusiasm where appropriate)
- ${input.preserveTone ? "PRESERVE the original tone and key messaging" : "Feel free to shift tone for authenticity"}
${input.targetAudience ? `- Write for: ${input.targetAudience}` : ""}

Return JSON:
{
  "humanized_text": "the rewritten text",
  "changes_made": ["change1", "change2"],
  "estimated_ai_score_before": 0-100,
  "estimated_ai_score_after": 0-100,
  "word_count_original": N,
  "word_count_humanized": N
}`,
          },
          {
            role: "user",
            content: input.text,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.9, // Higher temperature for more natural variation
      });

      const text = result.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(text);
      } catch {
        return { humanized_text: input.text, changes_made: [], error: "Failed to humanize" };
      }
    }),

  // ─── Plagiarism Check ─────────────────────────────────────
  plagiarismCheck: protectedProcedure
    .input(z.object({
      text: z.string().min(50),
    }))
    .mutation(async ({ input }) => {
      // Use Brave Search to find similar content
      let searchResults: any[] = [];
      if (ENV.braveApiKey) {
        try {
          // Take first ~100 chars as search query
          const query = input.text.slice(0, 150).replace(/[^\w\s]/g, " ").trim();
          const resp = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q="${encodeURIComponent(query)}"&count=10`,
            {
              headers: { "X-Subscription-Token": ENV.braveApiKey, Accept: "application/json" },
              signal: AbortSignal.timeout(10000),
            }
          );
          if (resp.ok) {
            const data = await resp.json() as any;
            searchResults = (data.web?.results || []).map((r: any) => ({
              title: r.title,
              url: r.url,
              description: r.description,
            }));
          }
        } catch { /* continue without search */ }
      }

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Analyze text for potential plagiarism or highly similar content.

${searchResults.length > 0 ? `Similar content found online:\n${searchResults.map(r => `- ${r.title}: ${r.description}`).join("\n")}` : "No web search results available."}

Return JSON:
{
  "plagiarism_score": 0-100 (0 = fully original, 100 = copied),
  "similar_sources": [
    { "url": "...", "title": "...", "similarity": 0-100, "matching_phrases": ["..."] }
  ],
  "original_percentage": 0-100,
  "flagged_sections": [
    { "text": "flagged portion", "reason": "too similar to source X" }
  ],
  "verdict": "original|mostly_original|partially_plagiarized|heavily_plagiarized",
  "suggestions": ["suggestion to make more original"]
}`,
          },
          {
            role: "user",
            content: input.text,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const text = result.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(text);
      } catch {
        return { plagiarism_score: 0, verdict: "unknown", original_percentage: 100 };
      }
    }),

  // ─── On-Page SEO Score ────────────────────────────────────
  seoScore: protectedProcedure
    .input(z.object({
      text: z.string().min(50),
      targetKeyword: z.string().optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Analyze content for on-page SEO optimization.

${input.targetKeyword ? `Target keyword: "${input.targetKeyword}"` : "No target keyword specified — analyze generally."}
${input.metaTitle ? `Meta title: "${input.metaTitle}"` : ""}
${input.metaDescription ? `Meta description: "${input.metaDescription}"` : ""}

Return JSON:
{
  "seo_score": 0-100,
  "keyword_density": 0-10 (percentage),
  "keyword_placement": {
    "in_title": true/false,
    "in_first_paragraph": true/false,
    "in_headings": true/false,
    "in_meta_description": true/false
  },
  "content_length": { "word_count": N, "verdict": "too_short|good|excellent" },
  "readability": { "score": 0-100, "grade_level": "6th|8th|10th|12th|college" },
  "heading_structure": { "has_h1": true/false, "subheadings_count": N, "verdict": "good|needs_improvement" },
  "internal_linking_opportunities": ["opportunity1"],
  "missing_elements": ["element1", "element2"],
  "improvements": [
    { "action": "...", "impact": "high|medium|low", "current": "...", "recommended": "..." }
  ]
}`,
          },
          {
            role: "user",
            content: input.text,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const text = result.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(text);
      } catch {
        return { seo_score: 0, error: "Failed to analyze SEO" };
      }
    }),

  // ─── One-Click Plagiarism Rewrite ─────────────────────────
  rewriteOriginal: protectedProcedure
    .input(z.object({
      text: z.string().min(50),
      preserveMeaning: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Rewrite the text to be 100% original while ${input.preserveMeaning ? "preserving the core meaning and key points" : "creating fresh content on the same topic"}.

Rules:
- Use completely different sentence structures
- Replace phrases with synonyms and alternatives
- Restructure paragraphs and information flow
- Add new transitions and connecting ideas
- Keep factual accuracy
- Maintain similar length

Return JSON:
{
  "rewritten_text": "the fully original version",
  "changes_summary": "brief description of major changes",
  "originality_estimate": 0-100
}`,
          },
          {
            role: "user",
            content: input.text,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.85,
      });

      const text = result.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(text);
      } catch {
        return { rewritten_text: input.text, error: "Failed to rewrite" };
      }
    }),

  // ─── One-Click SEO Enhance ────────────────────────────────
  enhanceSEO: protectedProcedure
    .input(z.object({
      text: z.string().min(50),
      targetKeyword: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Enhance the text for SEO optimization targeting "${input.targetKeyword}".

Apply these optimizations:
- Naturally integrate the target keyword (2-3% density)
- Add the keyword in the first paragraph
- Create clear H2/H3 heading structure
- Add internal linking anchor text suggestions
- Improve meta-relevant content (first 160 chars)
- Add schema-friendly structured content
- Enhance for featured snippets (lists, tables, definitions)
- Add FAQ-style Q&A section if appropriate

Return JSON:
{
  "enhanced_text": "the SEO-optimized version",
  "meta_title_suggestion": "max 60 chars",
  "meta_description_suggestion": "max 160 chars",
  "keyword_density_achieved": 0-5,
  "optimizations_applied": ["opt1", "opt2"],
  "estimated_seo_improvement": 0-100
}`,
          },
          {
            role: "user",
            content: input.text,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      });

      const text = result.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(text);
      } catch {
        return { enhanced_text: input.text, error: "Failed to enhance SEO" };
      }
    }),

  // ─── GEO/AEO Content Writer ──────────────────────────────
  generateGeoContent: protectedProcedure
    .input(z.object({
      targetKeyword: z.string().min(1),
      contentType: z.enum(["blog_post", "landing_page", "faq"]).default("blog_post"),
      wordCount: z.number().default(1500),
      tone: z.string().default("professional"),
      includeSchema: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Generate AI-optimized content that ranks in both traditional search AND generative AI engines.

Type: ${input.contentType}
Target keyword: "${input.targetKeyword}"
Word count: ~${input.wordCount}
Tone: ${input.tone}

GEO Optimization requirements:
- Structure content with clear entity relationships
- Include authoritative citations and data points
- Use question-answer format sections (for AEO)
- Add structured data suggestions
- Include expert-level detail (E-E-A-T signals)
- Optimize for featured snippets and AI citations
- Add "People Also Ask" style sections

Return JSON:
{
  "title": "SEO + GEO optimized title",
  "meta_description": "max 160 chars",
  "content": "full article content in markdown",
  "headings_structure": ["H1: ...", "H2: ...", "H3: ..."],
  "faq_section": [{ "question": "...", "answer": "..." }],
  "schema_suggestion": { "type": "Article", "properties": {} },
  "geo_score_estimate": 0-100,
  "target_snippets": ["snippet type this content targets"]
}`,
          },
          {
            role: "user",
            content: `Generate ${input.contentType} for keyword: "${input.targetKeyword}"`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
      });

      const text = result.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(text);
      } catch {
        return { error: "Failed to generate GEO content" };
      }
    }),

  // ─── Combined Quality Dashboard ───────────────────────────
  qualityCheck: protectedProcedure
    .input(z.object({
      text: z.string().min(50),
      targetKeyword: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Perform a comprehensive content quality analysis. Check AI score, originality, SEO, and readability in one pass.

${input.targetKeyword ? `Target keyword: "${input.targetKeyword}"` : ""}

Return JSON:
{
  "ai_score": 0-100,
  "originality_score": 0-100,
  "seo_score": 0-100,
  "readability_score": 0-100,
  "overall_quality": 0-100,
  "grade": "A+|A|B+|B|C+|C|D|F",
  "summary": "one paragraph assessment",
  "top_issues": [
    { "issue": "...", "severity": "critical|warning|info", "fix": "..." }
  ],
  "quick_wins": ["quick fix 1", "quick fix 2"]
}`,
          },
          {
            role: "user",
            content: input.text,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const text = result.choices[0]?.message?.content || "{}";
      try {
        return JSON.parse(text);
      } catch {
        return { overall_quality: 0, error: "Failed quality check" };
      }
    }),
});
