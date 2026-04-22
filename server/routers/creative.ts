/**
 * Creative Generation Router — AI Images, Infographics, and Mini Apps
 * 
 * Features:
 * 1. Contextual inline image generation for articles
 * 2. Data-driven infographic generation (SVG/HTML)
 * 3. Interactive mini-app generation (calculators, quizzes, tools)
 * 4. Hero image generation with editorial styling
 * 5. Social media image cards
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { generatedImages } from "../../drizzle/schema";

// ─── Image Generation Helpers ─────────────────────────────

async function generateImageDallE(prompt: string, size: string = "1792x1024"): Promise<string | null> {
  if (!ENV.openaiApiKey) return null;
  try {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.openaiApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt.slice(0, 4000),
        n: 1,
        size,
        quality: "hd",
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (resp.ok) {
      const data = await resp.json() as any;
      const b64 = data.data?.[0]?.b64_json;
      if (b64) return `data:image/png;base64,${b64}`;
    }
  } catch (e) {
    console.warn("[creative] DALL-E error:", (e as Error).message);
  }
  return null;
}

async function generateImageGemini(prompt: string): Promise<string | null> {
  if (!ENV.geminiApiKey) return null;
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${ENV.geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: AbortSignal.timeout(25000),
      }
    );
    if (resp.ok) {
      const data = await resp.json() as any;
      const parts = data.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (e) {
    console.warn("[creative] Gemini image error:", (e as Error).message);
  }
  return null;
}

export const creativeRouter = router({
  // ─── Suggest Images for Article ───────────────────────────
  suggestImages: protectedProcedure
    .input(z.object({
      title: z.string(),
      content: z.string(),
      targetPublication: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
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
    "prompt": "<DALL-E generation prompt for the hero>",
    "style": "<editorial|infographic|abstract|photographic>"
  },
  "inlineImages": [
    {
      "afterSection": "<section heading or paragraph identifier>",
      "concept": "<image concept>",
      "prompt": "<generation prompt>",
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

  // ─── Generate Article Image ───────────────────────────────
  generateArticleImage: protectedProcedure
    .input(z.object({
      prompt: z.string(),
      type: z.enum(["hero", "inline", "social", "infographic"]).default("hero"),
      style: z.enum(["editorial", "bloomberg", "forbes", "atlantic", "nyt", "abstract", "photographic"]).default("editorial"),
      articleTitle: z.string().optional(),
      articleId: z.number().optional(),
      size: z.enum(["landscape", "portrait", "square"]).default("landscape"),
    }))
    .mutation(async ({ ctx, input }) => {
      const styleMap: Record<string, string> = {
        editorial: "Premium editorial magazine photography, shallow depth of field, natural lighting",
        bloomberg: "Bloomberg Businessweek style — bold, graphic, conceptual editorial illustration",
        forbes: "Forbes magazine style — polished executive photography, corporate confidence",
        atlantic: "The Atlantic style — thoughtful, literary, moody editorial photography",
        nyt: "New York Times style — documentary photography, authentic moments, natural light",
        abstract: "Abstract conceptual art, clean geometric shapes, bold color palette, minimalist composition",
        photographic: "High-end stock photography, photorealistic, professional composition, pristine quality",
      };

      const sizeMap: Record<string, string> = {
        landscape: "1792x1024",
        portrait: "1024x1792",
        square: "1024x1024",
      };

      const finalPrompt = `${input.prompt}. ${styleMap[input.style] || styleMap.editorial}. ${input.articleTitle ? `For article: "${input.articleTitle}".` : ""} Shot on medium format, cinematic quality.`;

      // Try DALL-E first, then Gemini
      let imageUrl = await generateImageDallE(finalPrompt, sizeMap[input.size]);
      let source = "dalle-3";

      if (!imageUrl) {
        imageUrl = await generateImageGemini(finalPrompt);
        source = "gemini";
      }

      if (!imageUrl) {
        throw new Error("Image generation failed — no image provider available");
      }

      // Store in DB
      const db = await getDb();
      if (db) {
        await db.insert(generatedImages).values({
          userId: ctx.user.id,
          prompt: finalPrompt,
          imageUrl: imageUrl.startsWith("data:") ? "(base64)" : imageUrl,
          model: source,
          style: input.style,
          articleId: input.articleId,
          metadata: { type: input.type, originalPrompt: input.prompt },
        });
      }

      return { success: true, imageUrl, source, type: input.type };
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

      const result = await invokeLLM({
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

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a senior full-stack developer who creates interactive web applications. Generate a complete, self-contained React component that works as an embeddable mini-app. The component must:
- Use only inline styles (no external CSS)
- Use only React hooks (useState, useEffect, useMemo)
- Be fully self-contained — no external dependencies beyond React
- Be mobile-responsive
- Have polished UI with smooth transitions
- Include proper error handling
- Use a dark theme by default with professional aesthetics
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
  "html": "<complete self-contained HTML with embedded JS (vanilla, no React needed) and CSS that creates the interactive app — must work when injected into a div. Use modern DOM manipulation, event listeners, and animations. The app should be fully functional with a polished dark UI (bg: #0f172a, text: #e2e8f0, accent: #3b82f6). Must be 100% self-contained in a single HTML string.>",
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

      // Generate HTML card
      const result = await invokeLLM({
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

      return { success: true, data, platform: input.platform, usage: result.usage };
    }),
});
