/**
 * Image generation helper — Multi-provider image generation
 * 
 * Priority chain:
 * 1. OpenAI (gpt-image-1 — best quality, Rashida's preference)
 * 2. OpenRouter (routes to best available model)
 * 3. Gemini (native image generation)
 * 4. PiAPI (additional provider)
 * 5. Legacy Forge API (deprecated fallback)
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
  style?: string;
  background?: "transparent" | "opaque" | "auto";
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
  b64Json?: string;
  source?: string;
};

/**
 * Generate image using OpenAI's GPT Image model (gpt-image-1)
 * This is the highest-quality option and Rashida's preferred provider.
 */
export async function generateImageOpenAI(
  options: GenerateImageOptions
): Promise<GenerateImageResponse | null> {
  if (!ENV.openaiApiKey) return null;

  try {
    const payload: Record<string, unknown> = {
      model: "gpt-image-1",
      prompt: options.prompt.slice(0, 32000),
      n: 1,
      size: options.size || "1536x1024",
      quality: options.quality || "high",
      output_format: "b64_json",
    };

    if (options.background && options.background !== "auto") {
      payload.background = options.background;
    }

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.openaiApiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("[imageGen] OpenAI error:", response.status, errorText.slice(0, 200));
      return null;
    }

    const data = (await response.json()) as any;
    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      return { b64Json: b64, url: `data:image/png;base64,${b64}`, source: "gpt-image-1" };
    }

    // url-based response
    const url = data.data?.[0]?.url;
    if (url) {
      return { url, source: "gpt-image-1" };
    }
  } catch (e) {
    console.warn("[imageGen] OpenAI error:", (e as Error).message);
  }
  return null;
}

/**
 * Generate image using DALL-E 3 (fallback from GPT image model)
 */
export async function generateImageDallE3(
  options: GenerateImageOptions
): Promise<GenerateImageResponse | null> {
  if (!ENV.openaiApiKey) return null;

  try {
    const sizeMap: Record<string, string> = {
      "1024x1024": "1024x1024",
      "1536x1024": "1792x1024",
      "1024x1536": "1024x1792",
      auto: "1792x1024",
    };

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: options.prompt.slice(0, 4000),
        n: 1,
        size: sizeMap[options.size || "auto"] || "1792x1024",
        quality: "hd",
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) {
      console.warn("[imageGen] DALL-E 3 error:", response.status);
      return null;
    }

    const data = (await response.json()) as any;
    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      return { b64Json: b64, url: `data:image/png;base64,${b64}`, source: "dall-e-3" };
    }
  } catch (e) {
    console.warn("[imageGen] DALL-E 3 error:", (e as Error).message);
  }
  return null;
}

/**
 * Generate image using Gemini's native image generation
 */
export async function generateImageGemini(
  options: GenerateImageOptions
): Promise<GenerateImageResponse | null> {
  if (!ENV.geminiApiKey) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${ENV.geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate an image: ${options.prompt}` }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as any;
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        return {
          b64Json: part.inlineData.data,
          url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          source: "gemini",
        };
      }
    }
  } catch (e) {
    console.warn("[imageGen] Gemini error:", (e as Error).message);
  }
  return null;
}

/**
 * Generate image using PiAPI
 */
export async function generateImagePiAPI(
  options: GenerateImageOptions
): Promise<GenerateImageResponse | null> {
  if (!ENV.piapiKey) return null;

  try {
    const response = await fetch("https://api.piapi.ai/api/v1/task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ENV.piapiKey,
      },
      body: JSON.stringify({
        model: "midjourney",
        task_type: "imagine",
        input: { prompt: options.prompt.slice(0, 2000) },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as any;
    if (data.data?.output?.image_url) {
      return { url: data.data.output.image_url, source: "piapi" };
    }
  } catch (e) {
    console.warn("[imageGen] PiAPI error:", (e as Error).message);
  }
  return null;
}

/**
 * Master image generation function — tries providers in priority order.
 * OpenAI GPT-image-1 first (best quality), then DALL-E 3, Gemini, PiAPI.
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  // 1. OpenAI GPT Image (best quality — Rashida's preference)
  const openaiResult = await generateImageOpenAI(options);
  if (openaiResult) return openaiResult;

  // 2. DALL-E 3 fallback
  const dalleResult = await generateImageDallE3(options);
  if (dalleResult) return dalleResult;

  // 3. Gemini native
  const geminiResult = await generateImageGemini(options);
  if (geminiResult) return geminiResult;

  // 4. PiAPI
  const piapiResult = await generateImagePiAPI(options);
  if (piapiResult) return piapiResult;

  // 5. Legacy Forge (if configured)
  if (ENV.forgeApiKey && ENV.forgeApiUrl) {
    return generateImageForge(options);
  }

  throw new Error("No image generation provider available. Configure OPENAI_API_KEY, GEMINI_API_KEY, or PIAPI_KEY.");
}

async function generateImageForge(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      prompt: options.prompt,
      original_images: options.originalImages || [],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Forge API error (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const result = (await response.json()) as { image: { b64Json: string; mimeType: string } };
  const buffer = Buffer.from(result.image.b64Json, "base64");
  const { url } = await storagePut(`generated/${Date.now()}.png`, buffer, result.image.mimeType);
  return { url, source: "forge" };
}
