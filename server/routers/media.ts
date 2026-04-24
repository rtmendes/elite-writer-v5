/**
 * Media Generation Router — 4 endpoints ported from elite-writer-app
 * Covers: generate-image, generate-image-advanced, edit-image, generate-video
 */
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { generatedImages } from "../../drizzle/schema";

// ─── Editorial Style Prompts ──────────────────────────────

const EDITORIAL_STYLE_MAP: Record<string, string> = {
  bloomberg: "Bloomberg Businessweek editorial photography",
  forbes: "Forbes magazine editorial photography",
  fortune: "Fortune magazine editorial photography",
  nyt: "New York Times editorial photography",
  atlantic: "The Atlantic editorial photography",
  default: "premium editorial magazine photography",
};

function buildEditorialPrompt(opts: {
  articleTitle?: string;
  articleSummary?: string;
  sectionHeading?: string;
  styleHint?: string;
}): string {
  const styleKey = (opts.styleHint || "default").toLowerCase().replace(/[^a-z]/g, "");
  const style = EDITORIAL_STYLE_MAP[styleKey] || EDITORIAL_STYLE_MAP.default;
  const topic = opts.articleTitle || opts.sectionHeading || "business and finance";
  const topicLower = topic.toLowerCase();

  let scene = "";
  if (/tech|ai|artificial intelligence|machine|software|startup/i.test(topicLower)) {
    scene = "A modern office with sleek technology, a professional examining data on screens, natural window light, clean minimal aesthetic";
  } else if (/money|finance|invest|stock|market|economic|wealth|fund/i.test(topicLower)) {
    scene = "A professional in a modern financial district, glass buildings reflecting city light, crisp business attire";
  } else if (/health|medical|pharma|biotech|wellness/i.test(topicLower)) {
    scene = "A modern healthcare facility with clean lines, medical professional in contemporary setting";
  } else if (/climate|energy|sustain|environment|green/i.test(topicLower)) {
    scene = "Renewable energy landscape with modern wind turbines or solar panels, golden hour lighting";
  } else {
    scene = `Professional setting related to ${topic}, clean composition, editorial quality`;
  }

  return `${scene}. ${style}. Shot on medium format, shallow depth of field, natural lighting. For article: "${topic}". ${opts.articleSummary ? `Context: ${opts.articleSummary.slice(0, 200)}` : ""}`;
}

// ─── Image Generation via Stability AI ────────────────────

async function generateStabilityAI(prompt: string, aspectRatio = "16:9"): Promise<string | null> {
  if (!ENV.stabilityAiKey) return null;

  try {
    const fd = new FormData();
    fd.append("prompt", prompt);
    fd.append("output_format", "jpeg");
    fd.append("aspect_ratio", aspectRatio);

    const resp = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.stabilityAiKey}`, Accept: "application/json" },
      body: fd,
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      const data = await resp.json() as any;
      if (data.image) return `data:image/jpeg;base64,${data.image}`;
    }
  } catch (e) {
    console.warn("[media] Stability AI error:", (e as Error).message);
  }
  return null;
}

// ─── Image Generation via DALL-E 3 ───────────────────────

async function generateDallE3(prompt: string, size = "1792x1024", returnFormat: "url" | "b64_json" = "b64_json"): Promise<string | null> {
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
        response_format: returnFormat,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (resp.ok) {
      const data = await resp.json() as any;
      if (returnFormat === "b64_json") {
        const b64 = data.data?.[0]?.b64_json;
        if (b64) return `data:image/png;base64,${b64}`;
      } else {
        return data.data?.[0]?.url || null;
      }
    }
  } catch (e) {
    console.warn("[media] DALL-E 3 error:", (e as Error).message);
  }
  return null;
}

// ─── Image Generation via Gemini (Nano Banana 2) ─────────

async function generateGemini(prompt: string): Promise<string | null> {
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
        signal: AbortSignal.timeout(20000),
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
    console.warn("[media] Gemini image error:", (e as Error).message);
  }
  return null;
}

// ─── Advanced Image via Runware ───────────────────────────

async function generateRunware(prompt: string, model = "101@1", width = 1024, height = 576): Promise<string | null> {
  if (!ENV.runwareApiKey) return null;

  try {
    const resp = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ENV.runwareApiKey}` },
      body: JSON.stringify([{
        taskType: "imageInference",
        taskUUID: crypto.randomUUID(),
        positivePrompt: prompt,
        model: `runware:${model}`,
        width,
        height,
        numberResults: 1,
        outputFormat: "JPEG",
      }]),
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      const data = await resp.json() as any;
      const url = data.data?.[0]?.imageURL;
      if (url) return url;
    }
  } catch (e) {
    console.warn("[media] Runware error:", (e as Error).message);
  }
  return null;
}

export const mediaRouter = router({
  // Standard image generation (Stability AI → DALL-E 3 fallback)
  generateImage: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1),
      type: z.enum(["main", "h1", "infographic"]).default("main"),
      style: z.enum(["editorial", "infographic"]).default("editorial"),
      articleTitle: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const safePrompt = input.prompt.replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, 800);

      const finalPrompt = input.style === "infographic"
        ? `${safePrompt}. Visual Capitalist style data journalism infographic. Clean vector aesthetic, modern sans-serif typography, dark navy background, white and electric blue color scheme, professional chart design.`
        : `${safePrompt}. Editorial photography style. High quality, photorealistic, professional journalism aesthetic, suitable for ${input.articleTitle || "a tier-1 business publication"}. Clean composition, natural lighting, authentic setting.`;

      const aspectRatio = input.type === "infographic" ? "9:16" : "16:9";
      const dalleSize = input.type === "infographic" ? "1024x1792" : "1792x1024";

      // Try Stability AI first, then DALL-E 3
      let imageUrl = await generateStabilityAI(finalPrompt, aspectRatio);
      let source = "stability-ai";

      if (!imageUrl) {
        imageUrl = await generateDallE3(finalPrompt, dalleSize as any);
        source = "dalle-3";
      }

      if (!imageUrl) {
        imageUrl = await generateGemini(finalPrompt);
        source = "gemini";
      }

      if (!imageUrl) {
        throw new Error("Image generation failed. No API keys configured or all providers returned errors.");
      }

      // Store record
      const db = await getDb();
      if (db) {
        await db.insert(generatedImages).values({
          userId: ctx.user.id,
          prompt: finalPrompt,
          imageUrl: imageUrl.startsWith("data:") ? "(base64)" : imageUrl,
          model: source,
          style: input.style,
        });
      }

      return { imageUrl, type: input.type, source };
    }),

  // Advanced image generation with editorial style support
  generateAdvanced: protectedProcedure
    .input(z.object({
      prompt: z.string().optional(),
      model: z.string().default("auto"),
      articleTitle: z.string().optional(),
      articleSummary: z.string().optional(),
      sectionHeading: z.string().optional(),
      styleHint: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let prompt = input.prompt || "";

      // If editorial fields provided, build editorial prompt
      if (input.articleTitle || input.articleSummary) {
        prompt = buildEditorialPrompt({
          articleTitle: input.articleTitle,
          articleSummary: input.articleSummary,
          sectionHeading: input.sectionHeading,
          styleHint: input.styleHint,
        });
      }

      if (!prompt) throw new Error("prompt is required");

      let imageUrl: string | null = null;
      let source = "unknown";

      // Route based on model prefix
      if (input.model.startsWith("runware:")) {
        imageUrl = await generateRunware(prompt, input.model.replace("runware:", ""), input.width || 1024, input.height || 576);
        source = "runware";
      } else if (input.model === "gemini" || input.model === "nanobanana2") {
        imageUrl = await generateGemini(prompt);
        source = "gemini";
      } else {
        // Auto: try Gemini → Stability → DALL-E
        imageUrl = await generateGemini(prompt);
        source = "gemini";
        if (!imageUrl) {
          imageUrl = await generateStabilityAI(prompt);
          source = "stability-ai";
        }
        if (!imageUrl) {
          imageUrl = await generateDallE3(prompt);
          source = "dalle-3";
        }
      }

      if (!imageUrl) throw new Error("Image generation failed across all providers");

      return { ok: true, imageUrl, source, promptUsed: prompt };
    }),

  // Edit image using GPT-4 Vision + DALL-E 3
  editImage: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1),
      imageBase64: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      if (!ENV.openaiApiKey) throw new Error("OPENAI_API_KEY required for image editing");

      const safePrompt = input.prompt.replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, 1000);
      let refinedPrompt = safePrompt;

      // Step 1: Vision pass to understand canvas + produce refined prompt
      if (input.imageBase64?.startsWith("data:image")) {
        try {
          const visionResp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${ENV.openaiApiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-4o",
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: `You are a creative director. The user wants to edit this image with: "${safePrompt}"\n\nWrite a single DALL-E 3 generation prompt (max 1000 chars) for an improved version. Output ONLY the prompt.` },
                  { type: "image_url", image_url: { url: input.imageBase64, detail: "low" } },
                ],
              }],
              max_tokens: 200,
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (visionResp.ok) {
            const data = await visionResp.json() as any;
            const text = data.choices?.[0]?.message?.content?.trim();
            if (text) refinedPrompt = text.slice(0, 1000);
          }
        } catch { /* Use raw prompt */ }
      }

      // Step 2: DALL-E 3 generation
      const imageUrl = await generateDallE3(refinedPrompt, "1792x1024", "url");
      if (!imageUrl) throw new Error("Image generation failed");

      return { editedImageUrl: imageUrl, description: refinedPrompt };
    }),

  // Video generation via PiAPI (Kling)
  generateVideo: protectedProcedure
    .input(z.object({
      script: z.string().min(1),
      title: z.string().optional(),
      style: z.enum(["explainer", "cinematic", "pro"]).default("explainer"),
      duration: z.number().default(10),
      apiKey: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const piApiKey = input.apiKey || ENV.piapiKey;
      if (!piApiKey) throw new Error("PiAPI key required for video generation");

      const clipDuration = input.duration <= 5 ? 5 : 10;
      const mode = (input.style === "cinematic" || input.style === "pro") ? "pro" : "std";
      const prompt = [
        input.title ? `Video about: ${input.title}.` : "",
        input.script.slice(0, 1800),
      ].filter(Boolean).join(" ");

      const resp = await fetch("https://api.piapi.ai/api/kling/v1/video/text2video", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": piApiKey },
        body: JSON.stringify({
          model_name: "kling-v1",
          prompt,
          negative_prompt: "",
          cfg_scale: 0.5,
          mode,
          duration: clipDuration,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const data = await resp.json() as any;
      if (!resp.ok || data.code !== 200) {
        throw new Error(data.message || data.error || `PiAPI error ${resp.status}`);
      }

      const taskId = data.data?.task_id;
      if (!taskId) throw new Error("No task_id returned from PiAPI");

      return { ok: true, taskId, status: "pending", source: "piapi" };
    }),

  // Poll video generation task
  pollVideo: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      apiKey: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const piApiKey = input.apiKey || ENV.piapiKey;
      if (!piApiKey) throw new Error("PiAPI key required");

      const resp = await fetch(`https://api.piapi.ai/api/kling/v1/video/task/${input.taskId}`, {
        headers: { "X-API-Key": piApiKey },
        signal: AbortSignal.timeout(10000),
      });

      const data = await resp.json() as any;
      if (!resp.ok || data.code !== 200) {
        throw new Error(data.message || `Poll error ${resp.status}`);
      }

      const taskData = data.data || {};
      const status = (taskData.task_status || "").toLowerCase();

      if (status === "completed" || status === "succeed") {
        const videoUrl = taskData.task_result?.videos?.[0]?.url
          || taskData.works?.[0]?.resource?.resource
          || taskData.works?.[0]?.url || "";
        if (!videoUrl) throw new Error("Task completed but no video URL found");
        return { ok: true, status: "complete" as const, videoUrl, source: "piapi" };
      }

      if (status === "failed" || status === "fail") {
        return { ok: false, status: "failed" as const, error: taskData.task_status_msg || "Video generation failed" };
      }

      return { ok: true, status: "pending" as const, taskId: input.taskId };
    }),

  // List generated images
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(generatedImages)
      .where(eq(generatedImages.userId, ctx.user.id))
      .orderBy(desc(generatedImages.createdAt))
      .limit(50);
  }),
});
