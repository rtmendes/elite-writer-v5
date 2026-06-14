/**
 * Creative Generation Router — AI Images, Infographics, and Mini Apps
 * 
 * v5.2.0 — Enhanced with OpenRouter multi-model routing and GPT Image generation
 * 
 * Features:
 * 1. GPT Image 2 generation (gpt-image-2) — newest model (Apr 21 2026), highest quality
 * 2. Multi-provider fallback: OpenAI → DALL-E 3 → Gemini → PiAPI
 * 3. OpenRouter-powered intelligent prompt enhancement
 * 4. Data-driven infographic generation (SVG/HTML)
 * 5. Interactive mini-app generation (calculators, quizzes, tools)
 * 6. Hero images, social cards, editorial styling
 * 7. AI-powered image editing and variations
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { recordCentralCost } from "../_core/proactiveAgents";
import { generatedImages } from "../../drizzle/schema";

// Rough per-image cost (USD) by provider source, so every paid image
// generation lands in the central record_cost_event ledger (cost-tracking
// rule). Values are list-price ballparks for a single high-quality render;
// "unknown"/free fall back to ~0 so we never over-report.
const IMAGE_COST_USD: Record<string, number> = {
  "gpt-image-2": 0.04,
  "gpt-image-1": 0.02,
  "dall-e-3": 0.04,
  gemini: 0.003,
  piapi: 0.01,
};
import {
  generateImage,
  generateImageGPT2,
  generateImageOpenAI,
  generateImageDallE3,
  generateImageGemini,
  generateImagePiAPI,
} from "../_core/imageGeneration";

// ─── OpenRouter Enhanced Prompt Generation ────────────────

async function enhancePromptViaOpenRouter(
  prompt: string,
  context: { style?: string; type?: string; publication?: string }
): Promise<string> {
  if (!ENV.openrouterApiKey) return prompt;

  try {
    const result = await invokeLLM({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a world-class art director. Enhance the image generation prompt to produce stunning, publication-quality visuals. 
Style: ${context.style || "editorial"}
Type: ${context.type || "hero image"}
${context.publication ? `Publication: ${context.publication}` : ""}
Return ONLY the enhanced prompt — no explanation, no quotes.`,
        },
        { role: "user", content: prompt },
      ],
      maxTokens: 500,
      temperature: 0.8,
    });
    return result.choices[0]?.message?.content?.trim() || prompt;
  } catch {
    return prompt;
  }
}

// ─── Image Generation with Smart Routing ──────────────────

async function generateArticleImageMultiProvider(
  prompt: string,
  opts: {
    size?: "landscape" | "portrait" | "square";
    quality?: "low" | "medium" | "high";
    preferredProvider?: string;
  } = {}
): Promise<{ imageUrl: string; source: string }> {
  const sizeMap: Record<string, "1536x1024" | "1024x1536" | "1024x1024"> = {
    landscape: "1536x1024",
    portrait: "1024x1536",
    square: "1024x1024",
  };

  const result = await generateImage({
    prompt,
    size: sizeMap[opts.size || "landscape"] || "1536x1024",
    quality: opts.quality || "high",
  });

  return {
    imageUrl: result.url || (result.b64Json ? `data:image/png;base64,${result.b64Json}` : ""),
    source: result.source || "unknown",
  };
}

export const creativeRouter = router({
  // ─── Available Image Providers ────────────────────────────
  providers: protectedProcedure.query(() => {
    const providers: Array<{ id: string; name: string; available: boolean; quality: string }> = [];

    if (ENV.openaiApiKey) {
      providers.push({ id: "gpt-image-2", name: "GPT Image 2 (Latest — Best Quality)", available: true, quality: "highest" });
      providers.push({ id: "gpt-image-1", name: "GPT Image 1", available: true, quality: "high" });
      providers.push({ id: "dall-e-3", name: "DALL-E 3", available: true, quality: "high" });
    }
    if (ENV.geminiApiKey) {
      providers.push({ id: "gemini", name: "Gemini Image Gen", available: true, quality: "good" });
    }
    if (ENV.piapiKey) {
      providers.push({ id: "piapi", name: "PiAPI (Midjourney-style)", available: true, quality: "high" });
    }
    if (ENV.openrouterApiKey) {
      providers.push({ id: "openrouter-enhance", name: "OpenRouter Prompt Enhancement", available: true, quality: "n/a" });
    }

    return {
      providers,
      primaryProvider: ENV.openaiApiKey ? "gpt-image-2" : (ENV.geminiApiKey ? "gemini" : "none"),
      hasOpenRouter: !!ENV.openrouterApiKey,
    };
  }),

  // ─── Suggest Images for Article ───────────────────────────
  suggestImages: protectedProcedure
    .input(z.object({
      title: z.string(),
      content: z.string(),
      targetPublication: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Use OpenRouter for intelligent image suggestions
      const modelToUse = ENV.openrouterApiKey ? "google/gemini-2.5-pro" : undefined;

      const result = await invokeLLM({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: "You are a creative director at a premium editorial publication. Suggest contextual images and visual elements for the article. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Suggest visual elements for this article:

Title: ${input.title}
${input.targetPublication ? `Publication: ${input.targetPublication}` : ""}

Content: ${input.content.slice(0, 5000)}

Return JSON:
{
  "heroImage": {
    "concept": "<description of the ideal hero image>",
    "prompt": "<detailed generation prompt for GPT image model — be specific about composition, lighting, mood, color palette, and style>",
    "style": "<editorial|infographic|abstract|photographic>"
  },
  "inlineImages": [
    {
      "afterSection": "<section heading or paragraph identifier>",
      "concept": "<image concept>",
      "prompt": "<detailed generation prompt>",
      "type": "<photo|illustration|chart|diagram>",
      "caption": "<suggested caption>"
    }
  ],
  "infographicOpportunities": [
    {
      "dataPoint": "<what data to visualize>",
      "chartType": "<bar|line|pie|comparison|timeline|flowchart>",
      "title": "<infographic title>",
      "description": "<what it shows>"
    }
  ],
  "socialCards": [
    {
      "platform": "<twitter|linkedin|instagram>",
      "text": "<text overlay for the card>",
      "prompt": "<image generation prompt>"
    }
  ]
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content || "";
      let data;
      try { data = JSON.parse(text); } catch { data = { heroImage: null, inlineImages: [], infographicOpportunities: [] }; }

      return { success: true, data, usage: result.usage };
    }),

  // ─── Generate Article Image (Multi-Provider) ──────────────
  generateArticleImage: protectedProcedure
    .input(z.object({
      prompt: z.string(),
      type: z.enum(["hero", "inline", "social", "infographic"]).default("hero"),
      style: z.enum(["editorial", "bloomberg", "forbes", "atlantic", "nyt", "abstract", "photographic", "cinematic", "minimal"]).default("editorial"),
      articleTitle: z.string().optional(),
      articleId: z.number().optional(),
      size: z.enum(["landscape", "portrait", "square"]).default("landscape"),
      enhancePrompt: z.boolean().default(true),
      preferredProvider: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const styleMap: Record<string, string> = {
        editorial: "Premium editorial magazine photography, shallow depth of field, natural lighting, publication-quality composition",
        bloomberg: "Bloomberg Businessweek style — bold, graphic, conceptual editorial illustration with striking visual metaphors",
        forbes: "Forbes magazine style — polished executive photography, corporate confidence, premium stock quality",
        atlantic: "The Atlantic style — thoughtful, literary, moody editorial photography with artistic depth",
        nyt: "New York Times style — documentary photography, authentic moments, natural light, journalistic integrity",
        abstract: "Abstract conceptual art, clean geometric shapes, bold color palette, minimalist composition, modern design",
        photographic: "High-end stock photography, photorealistic, professional composition, pristine quality, shot on medium format",
        cinematic: "Cinematic film still, wide aspect ratio, dramatic lighting, Arri Alexa quality, color-graded",
        minimal: "Clean minimalist design, whitespace-heavy, modern typography-focused, Swiss design influenced",
      };

      let finalPrompt = `${input.prompt}. ${styleMap[input.style] || styleMap.editorial}.`;
      if (input.articleTitle) {
        finalPrompt += ` For article: "${input.articleTitle}".`;
      }

      // Enhance prompt via OpenRouter if enabled
      if (input.enhancePrompt && ENV.openrouterApiKey) {
        finalPrompt = await enhancePromptViaOpenRouter(finalPrompt, {
          style: input.style,
          type: input.type,
        });
      }

      // Generate using multi-provider chain (GPT Image → DALL-E 3 → Gemini → PiAPI)
      const { imageUrl, source } = await generateArticleImageMultiProvider(finalPrompt, {
        size: input.size,
        quality: "high",
      });

      if (!imageUrl) {
        throw new Error("Image generation failed — no provider available");
      }

      // Cost ledger: log the paid render to the central record_cost_event RPC.
      // Fire-and-forget so a logging hiccup never fails the image request.
      void recordCentralCost(
        "article_image",
        source,
        0,
        0,
        IMAGE_COST_USD[source] ?? 0,
        input.articleTitle || input.type,
      );

      // Store in DB
      const db = await getDb();
      if (db) {
        try {
          await db.insert(generatedImages).values({
            userId: ctx.user.id,
            prompt: finalPrompt,
            imageUrl: imageUrl.startsWith("data:") ? "(base64)" : imageUrl,
            model: source,
            style: input.style,
            articleId: input.articleId,
            metadata: { type: input.type, originalPrompt: input.prompt, enhanced: input.enhancePrompt },
          });
        } catch (e) {
          console.warn("[creative] DB insert error:", (e as Error).message);
        }
      }

      return { success: true, imageUrl, source, type: input.type, promptUsed: finalPrompt };
    }),

  // ─── Edit/Vary Existing Image ─────────────────────────────
  editImage: protectedProcedure
    .input(z.object({
      originalImageUrl: z.string(),
      editPrompt: z.string(),
      size: z.enum(["landscape", "portrait", "square"]).default("landscape"),
    }))
    .mutation(async ({ input }) => {
      if (!ENV.openaiApiKey) {
        throw new Error("Image editing requires OpenAI API key");
      }

      const sizeMap: Record<string, "1536x1024" | "1024x1536" | "1024x1024"> = {
        landscape: "1536x1024",
        portrait: "1024x1536",
        square: "1024x1024",
      };

      // Use GPT Image 2 model for editing
      const result = await generateImageGPT2({
        prompt: input.editPrompt,
        size: sizeMap[input.size],
        quality: "high",
      });

      if (!result) {
        throw new Error("Image editing failed");
      }

      return {
        success: true,
        imageUrl: result.url || (result.b64Json ? `data:image/png;base64,${result.b64Json}` : ""),
        source: result.source,
      };
    }),

  // ─── Batch Generate Images for Article ────────────────────
  batchGenerate: protectedProcedure
    .input(z.object({
      prompts: z.array(z.object({
        prompt: z.string(),
        type: z.enum(["hero", "inline", "social"]),
        style: z.string().default("editorial"),
      })).max(5),
      articleTitle: z.string().optional(),
      enhancePrompts: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const results = await Promise.allSettled(
        input.prompts.map(async (p) => {
          let prompt = p.prompt;
          if (input.enhancePrompts && ENV.openrouterApiKey) {
            prompt = await enhancePromptViaOpenRouter(prompt, { style: p.style, type: p.type });
          }
          const { imageUrl, source } = await generateArticleImageMultiProvider(prompt, {
            size: p.type === "social" ? "square" : "landscape",
          });
          return { prompt: p.prompt, imageUrl, source, type: p.type };
        })
      );

      return {
        success: true,
        images: results.map((r, i) => ({
          index: i,
          ...(r.status === "fulfilled" ? r.value : { error: (r as PromiseRejectedResult).reason?.message }),
        })),
      };
    }),

  // ─── Generate Infographic (HTML/SVG) ──────────────────────
  generateInfographic: protectedProcedure
    .input(z.object({
      title: z.string(),
      content: z.string(),
      chartType: z.enum(["bar", "comparison", "timeline", "flowchart", "statistics", "process", "list"]).default("statistics"),
      colorScheme: z.enum(["dark", "light", "blue", "green", "corporate"]).default("dark"),
      articleTitle: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const colorSchemes: Record<string, { bg: string; text: string; accent: string; secondary: string }> = {
        dark: { bg: "#0f172a", text: "#f8fafc", accent: "#3b82f6", secondary: "#6366f1" },
        light: { bg: "#ffffff", text: "#1e293b", accent: "#2563eb", secondary: "#7c3aed" },
        blue: { bg: "#0c1929", text: "#e2e8f0", accent: "#60a5fa", secondary: "#38bdf8" },
        green: { bg: "#052e16", text: "#ecfdf5", accent: "#4ade80", secondary: "#34d399" },
        corporate: { bg: "#1a1a2e", text: "#eef2f7", accent: "#e94560", secondary: "#16213e" },
      };

      const colors = colorSchemes[input.colorScheme] || colorSchemes.dark;

      // Use OpenRouter for higher-quality infographic generation
      const modelToUse = ENV.openrouterApiKey ? "anthropic/claude-sonnet-4" : undefined;

      const result = await invokeLLM({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: `You are a data visualization expert who creates Visual Capitalist-quality infographics. Generate self-contained HTML/CSS infographic code. Use inline styles only. The infographic should be responsive and visually striking. Return ONLY valid JSON.

Color scheme: Background ${colors.bg}, Text ${colors.text}, Accent ${colors.accent}, Secondary ${colors.secondary}`,
          },
          {
            role: "user",
            content: `Create a ${input.chartType} infographic from this content:

Title: ${input.title}
${input.articleTitle ? `From article: ${input.articleTitle}` : ""}

Content to visualize:
${input.content.slice(0, 4000)}

Return JSON:
{
  "title": "<infographic title>",
  "html": "<complete self-contained HTML with inline CSS — the infographic must be a standalone div that renders at 800px width, using modern CSS flexbox/grid, SVG for charts where needed, clean typography with system fonts>",
  "dataPoints": [{"label": "<label>", "value": "<value>", "context": "<context>"}],
  "description": "<alt text description of the infographic>",
  "suggestedCaption": "<caption for the article>"
}`,
          },
        ],
        response_format: { type: "json_object" },
        maxTokens: 8192,
      });

      const text = result.choices[0]?.message?.content || "";
      let data;
      try { data = JSON.parse(text); } catch { data = { title: input.title, html: "<p>Generation failed</p>" }; }

      return { success: true, data, usage: result.usage };
    }),

  // ─── Generate Mini App ────────────────────────────────────
  generateMiniApp: protectedProcedure
    .input(z.object({
      articleTitle: z.string(),
      articleContent: z.string(),
      appType: z.enum([
        "calculator", "quiz", "assessment", "comparison",
        "checklist_interactive", "estimator", "scorecard",
        "decision_tree", "roi_calculator", "survey",
      ]),
      customDescription: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const appDescriptions: Record<string, string> = {
        calculator: "An interactive calculator that lets users compute a key metric from the article",
        quiz: "A knowledge quiz that tests understanding of the article's key concepts",
        assessment: "A self-assessment tool that helps users evaluate their current situation",
        comparison: "A side-by-side comparison tool for evaluating options discussed in the article",
        checklist_interactive: "An interactive checklist users can check off and track progress",
        estimator: "An estimation tool that helps users project outcomes based on their inputs",
        scorecard: "A scoring tool that rates users across multiple dimensions",
        decision_tree: "A guided decision tree that leads users to personalized recommendations",
        roi_calculator: "An ROI calculator specific to the topic covered in the article",
        survey: "An interactive survey with real-time results visualization",
      };

      // Use OpenRouter with Claude for best code generation
      const modelToUse = ENV.openrouterApiKey ? "anthropic/claude-sonnet-4" : undefined;

      const result = await invokeLLM({
        model: modelToUse,
        messages: [
          {
            role: "system",
            content: `You are a senior full-stack developer who creates interactive web applications. Generate a complete, self-contained interactive app as HTML/JS/CSS. The app must:
- Use only inline styles (no external CSS)
- Use vanilla JavaScript (no frameworks)
- Be fully self-contained — no external dependencies
- Be mobile-responsive
- Have polished UI with smooth transitions and micro-animations
- Include proper error handling and input validation
- Use a dark theme by default with professional aesthetics (bg: #0f172a, text: #e2e8f0, accent: #3b82f6)
- Feel like a premium SaaS product, not a toy
Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Create a ${input.appType} mini-app based on this article:

Article Title: ${input.articleTitle}
App Type: ${input.appType}
Description: ${input.customDescription || appDescriptions[input.appType]}

Article Content:
${input.articleContent.slice(0, 5000)}

Return JSON:
{
  "name": "<app name>",
  "description": "<one-line description>",
  "appType": "${input.appType}",
  "html": "<complete self-contained HTML with embedded JS and CSS that creates the interactive app — must work when injected into a div>",
  "embedCode": "<a simplified embed snippet for external use>",
  "dataInputs": [{"name": "<input name>", "type": "<number|text|select>", "label": "<label>", "default": "<default value>"}],
  "outputs": [{"name": "<output name>", "label": "<label>", "format": "<number|percentage|text|chart>"}],
  "educationalContext": "<how this app reinforces the article's message>"
}`,
          },
        ],
        response_format: { type: "json_object" },
        maxTokens: 8192,
      });

      const text = result.choices[0]?.message?.content || "";
      let data;
      try { data = JSON.parse(text); } catch { data = { name: input.appType, html: "<p>Generation failed</p>" }; }

      return { success: true, data, usage: result.usage };
    }),

  // ─── Suggest Mini Apps for Article ────────────────────────
  suggestMiniApps: protectedProcedure
    .input(z.object({
      articleTitle: z.string(),
      articleContent: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        model: ENV.openrouterApiKey ? "google/gemini-2.5-pro" : undefined,
        messages: [
          {
            role: "system",
            content: "You are a product strategist who identifies opportunities for interactive content. Analyze the article and suggest mini-apps that would enhance reader engagement and provide practical value. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Suggest interactive mini-apps for this article:

Title: ${input.articleTitle}
Content: ${input.articleContent.slice(0, 5000)}

Return JSON:
{
  "suggestions": [
    {
      "type": "<calculator|quiz|assessment|comparison|checklist_interactive|estimator|scorecard|decision_tree|roi_calculator|survey>",
      "name": "<app name>",
      "description": "<what it does and why readers would use it>",
      "engagementPotential": "<high|medium|low>",
      "leadGenPotential": "<high|medium|low>",
      "complexity": "<simple|moderate|complex>",
      "dataFromArticle": "<what article data it would use>"
    }
  ],
  "recommendedFirst": "<which to build first and why>"
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content || "";
      let data;
      try { data = JSON.parse(text); } catch { data = { suggestions: [] }; }

      return { success: true, data, usage: result.usage };
    }),

  // ─── Generate Social Media Image Card ─────────────────────
  generateSocialCard: protectedProcedure
    .input(z.object({
      headline: z.string(),
      subtext: z.string().optional(),
      platform: z.enum(["twitter", "linkedin", "instagram", "facebook"]).default("twitter"),
      style: z.enum(["quote", "stat", "headline", "listicle"]).default("headline"),
      brandColor: z.string().optional(),
      useAiImage: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const platformSizes: Record<string, { w: number; h: number }> = {
        twitter: { w: 1200, h: 675 },
        linkedin: { w: 1200, h: 627 },
        instagram: { w: 1080, h: 1080 },
        facebook: { w: 1200, h: 630 },
      };

      const size = platformSizes[input.platform];
      const accent = input.brandColor || "#3b82f6";

      // Optionally generate a background image with GPT Image
      let bgImageUrl: string | null = null;
      if (input.useAiImage && ENV.openaiApiKey) {
        const imgResult = await generateImageGPT2({
          prompt: `Abstract background for social media card about: "${input.headline}". Moody, dark, with accent color ${accent}. No text.`,
          size: input.platform === "instagram" ? "1024x1024" : "1536x1024",
          quality: "medium",
        });
        bgImageUrl = imgResult?.url || null;
      }

      // Generate HTML card via OpenRouter
      const result = await invokeLLM({
        model: ENV.openrouterApiKey ? "anthropic/claude-sonnet-4" : undefined,
        messages: [
          {
            role: "system",
            content: `You are a social media designer. Create a stunning ${input.platform} card as self-contained HTML with inline CSS. The card should be exactly ${size.w}x${size.h}px. Use the accent color ${accent}. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Create a ${input.style} social card:

Headline: ${input.headline}
${input.subtext ? `Subtext: ${input.subtext}` : ""}
Platform: ${input.platform}
Style: ${input.style}
Size: ${size.w}x${size.h}
${bgImageUrl ? `Background image URL: ${bgImageUrl}` : ""}

Return JSON:
{
  "html": "<complete self-contained HTML/CSS card at the exact pixel dimensions, with modern typography, gradient backgrounds, and visual impact — dark theme preferred>",
  "altText": "<accessibility description>",
  "hashtags": ["<relevant hashtag>"]
}`,
          },
        ],
        response_format: { type: "json_object" },
        maxTokens: 4096,
      });

      const text = result.choices[0]?.message?.content || "";
      let data;
      try { data = JSON.parse(text); } catch { data = { html: "<p>Generation failed</p>" }; }

      return { success: true, data, platform: input.platform, bgImageUrl, usage: result.usage };
    }),
});
