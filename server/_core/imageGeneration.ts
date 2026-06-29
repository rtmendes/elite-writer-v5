/**
 * Image generation helper — Multi-provider image generation
 * 
 * Priority chain:
 * 1. OpenAI (gpt-image-2 — latest & best quality, released Apr 21 2026)
 * 2. OpenAI (gpt-image-1 — fallback)
 * 3. DALL-E 3 (legacy fallback)
 * 4. Gemini (native image generation)
 * 5. PiAPI (additional provider)
 * 6. Legacy Forge API (deprecated)
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  size?: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
  style?: string;
  background?: "transparent" | "opaque" | "auto";
  model?: "gpt-image-2" | "gpt-image-1" | "dall-e-3" | "gemini" | "piapi";
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
 * Generate image using OpenAI's GPT Image 2 model (gpt-image-2)
 * Released April 21 2026 — the newest and highest-quality option.
 */
export async function generateImageGPT2(
  options: GenerateImageOptions
): Promise<GenerateImageResponse | null> {
  if (!ENV.openaiApiKey) return null;

  try {
    const payload: Record<string, unknown> = {
      model: "gpt-image-2",
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
      signal: AbortSignal.timeout(90000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn("[imageGen] GPT-image-2 error:", response.status, errorText.slice(0, 200));
      return null;
    }

    const data = (await response.json()) as any;
    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      return { b64Json: b64, url: `data:image/png;base64,${b64}`, source: "gpt-image-2" };
    }

    const url = data.data?.[0]?.url;
    if (url) {
      return { url, source: "gpt-image-2" };
    }
  } catch (e) {
    console.warn("[imageGen] GPT-image-2 error:", (e as Error).message);
  }
  return null;
}

/**
 * Generate image using OpenAI's GPT Image 1 model (gpt-image-1)
 * Fallback from GPT Image 2.
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
      console.warn("[imageGen] GPT-image-1 error:", response.status, errorText.slice(0, 200));
      return null;
    }

    const data = (await response.json()) as any;
    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      return { b64Json: b64, url: `data:image/png;base64,${b64}`, source: "gpt-image-1" };
    }

    const url = data.data?.[0]?.url;
    if (url) {
      return { url, source: "gpt-image-1" };
    }
  } catch (e) {
    console.warn("[imageGen] GPT-image-1 error:", (e as Error).message);
  }
  return null;
}

/**
 * Generate image using DALL-E 3 (legacy fallback)
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
 * GPT-image-2 first (newest, best quality), then GPT-image-1, DALL-E 3, Gemini, PiAPI.
 * Pass options.model to force a specific provider.
 */
export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  // Allow forcing a specific model
  if (options.model) {
    const providerMap: Record<string, (o: GenerateImageOptions) => Promise<GenerateImageResponse | null>> = {
      "gpt-image-2": generateImageGPT2,
      "gpt-image-1": generateImageOpenAI,
      "dall-e-3": generateImageDallE3,
      gemini: generateImageGemini,
      piapi: generateImagePiAPI,
    };
    const provider = providerMap[options.model];
    if (provider) {
      const result = await provider(options);
      if (result) return result;
    }
    // Fall through to chain if forced model fails
  }

  // 1. GPT Image 2 (newest, best quality — released Apr 21 2026)
  const gpt2Result = await generateImageGPT2(options);
  if (gpt2Result) return gpt2Result;

  // 2. GPT Image 1 (previous gen)
  const openaiResult = await generateImageOpenAI(options);
  if (openaiResult) return openaiResult;

  // 3. DALL-E 3 legacy
  const dalleResult = await generateImageDallE3(options);
  if (dalleResult) return dalleResult;

  // 4. Gemini native
  const geminiResult = await generateImageGemini(options);
  if (geminiResult) return geminiResult;

  // 5. PiAPI
  const piapiResult = await generateImagePiAPI(options);
  if (piapiResult) return piapiResult;

  // 6. OpenRouter FLUX (free, no extra key — uses OPENROUTER_API_KEY)
  const fluxResult = await generateImageOpenRouter(options);
  if (fluxResult) return fluxResult;

  // 7. Legacy Forge (if configured)
  if (ENV.forgeApiKey && ENV.forgeApiUrl) {
    return generateImageForge(options);
  }

  throw new Error("No image generation provider available. Configure OPENAI_API_KEY, GEMINI_API_KEY, PIAPI_KEY, or OPENROUTER_API_KEY.");
}

async function generateImageOpenRouter(options: GenerateImageOptions): Promise<GenerateImageResponse | null> {
  if (!ENV.openrouterApiKey) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ENV.openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "black-forest-labs/flux-1-schnell:free",
        prompt: options.prompt,
        n: 1,
        size: options.size === "1024x1536" ? "1024x1536" : options.size === "1024x1024" ? "1024x1024" : "1536x1024",
      }),
    });
    if (!res.ok) {
      console.warn("[imageGen] OpenRouter FLUX error:", res.status);
      return null;
    }
    const data = await res.json() as { data?: Array<{ url?: string; b64_json?: string }> };
    const item = data?.data?.[0];
    if (!item) return null;
    if (item.url) return { url: item.url, source: "openrouter-flux" };
    if (item.b64_json) return { b64Json: item.b64_json, url: `data:image/png;base64,${item.b64_json}`, source: "openrouter-flux" };
    return null;
  } catch (e: any) {
    console.warn("[imageGen] OpenRouter FLUX error:", e?.message);
    return null;
  }
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
