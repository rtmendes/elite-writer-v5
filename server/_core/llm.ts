/**
 * LLM Invocation Module — Standalone Anthropic Claude API
 * Replaces Manus Forge dependency with direct Claude API calls.
 * Falls back to OpenAI if configured and Anthropic unavailable.
 */
import { ENV } from "./env";
import { assertBudget, applyBudgetLadder, recordUsage } from "./budget";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };
export type FileContent = { type: "file_url"; file_url: { url: string; mime_type?: string } };
export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean } };

export type InvokeParams = {
  messages: Message[];
  maxTokens?: number;
  max_tokens?: number;
  response_format?: ResponseFormat;
  responseFormat?: ResponseFormat;
  temperature?: number;
  model?: string;
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: Role; content: string };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

function extractText(content: MessageContent | MessageContent[]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(c => typeof c === "string" ? c : c.type === "text" ? c.text : "").join("\n");
  }
  if (content.type === "text") return content.text;
  return "";
}

/**
 * Invoke LLM using direct Anthropic Claude API.
 * OpenAI-compatible response shape for backward compatibility with v5 router code.
 */

/**
 * Legacy/bare model aliases used across v5 routers, normalized to valid
 * OpenRouter slugs so the OpenRouter-first chain routes to the RIGHT family
 * (a bare "gemini-flash" must never silently become an Anthropic/OpenAI call).
 */
const MODEL_ALIASES: Record<string, string> = {
  "claude-sonnet": "anthropic/claude-sonnet-4.6",
  "claude-sonnet-4": "anthropic/claude-sonnet-4",
  "claude-opus": "anthropic/claude-opus-4.8",
  "claude-haiku": "anthropic/claude-haiku-4.5",
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gemini": "google/gemini-2.5-flash",
  "gemini-flash": "google/gemini-2.5-flash",
  "gemini-pro": "google/gemini-2.5-pro",
  "deepseek-r1": "deepseek/deepseek-r1",
  "free": "openai/gpt-oss-120b:free",
  "free-big": "nvidia/nemotron-3-ultra-550b-a55b:free",
};

/**
 * Cost tiers — the house routing policy. Routine agent work rides FREE
 * OpenRouter models (the detailed personas/prompts carry the quality);
 * paid Sonnet is reserved for publish-grade prose. Opus is never a default.
 * With a paid balance on the account OpenRouter allows 1000 free requests/day.
 */
export const TIER = {
  free: "openai/gpt-oss-120b:free",
  freeBig: "nvidia/nemotron-3-ultra-550b-a55b:free",
  cheap: "anthropic/claude-haiku-4.5",
  standard: "anthropic/claude-sonnet-4.6",
} as const;

/** When a :free model is rate-limited or down, walk this ladder before
 *  spending money — haiku last so a busy free pool never blocks a job. */
const FREE_FALLBACKS = [
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "anthropic/claude-haiku-4.5",
];

export function resolveModelSlug(model?: string): string {
  const m = model ?? TIER.free; // house policy: unspecified = free
  if (m.includes("/")) return m;
  return MODEL_ALIASES[m] ?? `anthropic/${m}`;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  // Budget gate (ported from elite-writer-app gateway): refuses the call when
  // AI_DAILY_BUDGET_USD is exhausted; past the soft threshold (80% by default)
  // requests continue on the fallback model instead of failing.
  await assertBudget();
  const ladder = await applyBudgetLadder(params.model ?? TIER.free);
  if (ladder.downgraded) {
    console.warn(`[LLM] budget soft threshold reached — downgrading ${params.model ?? "claude-sonnet"} → ${ladder.model}`);
    params = { ...params, model: ladder.model };
  }
  const maxTokens = params.maxTokens ?? params.max_tokens ?? 4096;
  const format = params.response_format ?? params.responseFormat;
  const wantsJson = format?.type === "json_object" || format?.type === "json_schema";
  const temperature = params.temperature ?? 0.7;
  const model = params.model ?? TIER.free; // house policy: unspecified = free

  // Priority: OpenRouter (cheapest, multi-model) → OpenAI → Anthropic → Forge
  // OpenRouter handles all model prefixes (anthropic/, openai/, google/, etc.)

  // Step 1: OpenRouter first — handles any model, cheapest routing.
  // :free models get a fallback ladder (other free models, then haiku) so a
  // rate-limited free pool degrades to cents instead of failing the job.
  if (ENV.openrouterApiKey) {
    // Normalize bare aliases to valid OpenRouter slugs (right model family)
    const orModel = resolveModelSlug(params.model ?? model);
    const candidates = orModel.endsWith(":free")
      ? [orModel, ...FREE_FALLBACKS.filter((m) => m !== orModel)]
      : [orModel];
    for (const candidate of candidates) {
      try {
        const orRes = await invokeOpenRouter(params.messages, { maxTokens, format, temperature, model: candidate });
        recordUsage(orRes.model || candidate, orRes.usage);
        return orRes;
      } catch (err: any) {
        console.warn(`[LLM] OpenRouter ${candidate} failed (${err?.message?.slice(0, 100)})${candidates.length > 1 ? ", trying next" : ", falling back..."}`);
      }
    }
  }

  // Step 2: OpenAI direct
  if (ENV.openaiApiKey) {
    try {
      const oaRes = await invokeOpenAI(params.messages, { maxTokens, format, temperature });
      recordUsage(oaRes.model || "gpt-4o", oaRes.usage);
      return oaRes;
    } catch (err: any) {
      console.warn(`[LLM] OpenAI failed (${err?.message?.slice(0, 100)}), falling back...`);
    }
  }

  // Step 3: Anthropic direct (last resort for paid APIs — balance may be low)
  if (ENV.anthropicApiKey) {
    try {
      let anthropicModel = model;
      if (model.startsWith("anthropic/")) {
        anthropicModel = model.replace("anthropic/", "");
      } else if (model.includes("/")) {
        // Non-Anthropic model (incl. the free default) but OpenRouter/OpenAI failed — use default Claude
        anthropicModel = "claude-sonnet-4";
      }
      const anRes = await invokeAnthropic(params.messages, { maxTokens, wantsJson, temperature, model: anthropicModel });
      recordUsage(anRes.model || anthropicModel, anRes.usage);
      return anRes;
    } catch (err: any) {
      console.warn(`[LLM] Anthropic failed (${err?.message?.slice(0, 100)}), falling back...`);
    }
  }

  // Step 4: Legacy Forge API
  if (ENV.forgeApiKey && ENV.forgeApiUrl) {
    return invokeForge(params);
  }

  throw new Error("No LLM API key configured or all providers failed (ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or BUILT_IN_FORGE_API_KEY)");
}

async function invokeAnthropic(
  messages: Message[],
  opts: { maxTokens: number; wantsJson: boolean; temperature: number; model: string }
): Promise<InvokeResult> {
  // Separate system message from conversation messages
  let systemPrompt = "";
  const conversationMessages: Array<{ role: string; content: string }> = [];

  for (const msg of messages) {
    const text = extractText(msg.content);
    if (msg.role === "system") {
      systemPrompt += (systemPrompt ? "\n\n" : "") + text;
    } else {
      conversationMessages.push({ role: msg.role === "assistant" ? "assistant" : "user", content: text });
    }
  }

  // Ensure alternating user/assistant messages (Anthropic requirement)
  if (conversationMessages.length === 0) {
    conversationMessages.push({ role: "user", content: systemPrompt || "Hello" });
    systemPrompt = "";
  }

  if (opts.wantsJson && systemPrompt) {
    systemPrompt += "\n\nIMPORTANT: Return ONLY valid JSON with no markdown formatting, no code blocks, no extra text.";
  }

  const payload: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    messages: conversationMessages,
  };

  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} – ${errorText}`);
  }

  const data = await response.json() as any;

  // Map Anthropic response to OpenAI-compatible format
  const contentText = data.content?.map((c: any) => c.text || "").join("") ?? "";

  return {
    id: data.id || "msg_" + Date.now(),
    created: Math.floor(Date.now() / 1000),
    model: data.model || opts.model,
    choices: [{
      index: 0,
      message: { role: "assistant", content: contentText },
      finish_reason: data.stop_reason || "stop",
    }],
    usage: data.usage ? {
      prompt_tokens: data.usage.input_tokens || 0,
      completion_tokens: data.usage.output_tokens || 0,
      total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
    } : undefined,
  };
}

async function invokeOpenAI(
  messages: Message[],
  opts: { maxTokens: number; format?: ResponseFormat; temperature: number }
): Promise<InvokeResult> {
  const oaiMessages = messages.map(m => ({
    role: m.role,
    content: extractText(m.content),
  }));

  const payload: Record<string, unknown> = {
    model: "gpt-4o",
    messages: oaiMessages,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
  };

  if (opts.format) {
    payload.response_format = opts.format;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openaiApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}

async function invokeOpenRouter(
  messages: Message[],
  opts: { maxTokens: number; format?: ResponseFormat; temperature: number; model: string }
): Promise<InvokeResult> {
  const oaiMessages = messages.map(m => ({
    role: m.role,
    content: extractText(m.content),
  }));

  const payload: Record<string, unknown> = {
    model: opts.model,
    messages: oaiMessages,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
  };

  if (opts.format) {
    payload.response_format = opts.format;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.openrouterApiKey}`,
      "HTTP-Referer": ENV.appUrl || "https://elitewriter.insightprofit.live",
      "X-Title": "Elite Writer V5",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}

async function invokeForge(params: InvokeParams): Promise<InvokeResult> {
  const url = ENV.forgeApiUrl.endsWith("/")
    ? `${ENV.forgeApiUrl}v1/chat/completions`
    : `${ENV.forgeApiUrl}/v1/chat/completions`;

  const payload: Record<string, unknown> = {
    model: "gemini-2.5-flash",
    messages: params.messages.map(m => ({
      role: m.role,
      content: extractText(m.content),
    })),
    max_tokens: params.maxTokens ?? params.max_tokens ?? 32768,
  };

  if (params.response_format ?? params.responseFormat) {
    payload.response_format = params.response_format ?? params.responseFormat;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Forge API error: ${response.status} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}

/**
 * Stream LLM response using OpenRouter (preferred) or Anthropic streaming API.
 * Returns an async generator of text chunks.
 */
export async function* streamLLM(params: InvokeParams): AsyncGenerator<string> {
  if (!ENV.openrouterApiKey && !ENV.anthropicApiKey) {
    throw new Error("Streaming requires OPENROUTER_API_KEY or ANTHROPIC_API_KEY");
  }

  let systemPrompt = "";
  const conversationMessages: Array<{ role: string; content: string }> = [];

  for (const msg of params.messages) {
    const text = extractText(msg.content);
    if (msg.role === "system") {
      systemPrompt += (systemPrompt ? "\n\n" : "") + text;
    } else {
      conversationMessages.push({ role: msg.role === "assistant" ? "assistant" : "user", content: text });
    }
  }

  if (conversationMessages.length === 0) {
    conversationMessages.push({ role: "user", content: systemPrompt || "Hello" });
    systemPrompt = "";
  }

  const maxTokens = params.maxTokens ?? params.max_tokens ?? 4096;
  const temperature = params.temperature ?? 0.7;

  // Try OpenRouter streaming first (OpenAI-compatible SSE format)
  if (ENV.openrouterApiKey) {
    const orModel = resolveModelSlug(params.model);
    const orPayload: Record<string, unknown> = {
      model: orModel,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...conversationMessages,
      ],
    };

    let orResponse;
    try {
      orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ENV.openrouterApiKey}`,
          "HTTP-Referer": ENV.appUrl || "https://elitewriter.insightprofit.live",
          "X-Title": "Elite Writer V5",
        },
        body: JSON.stringify(orPayload),
      });

      if (orResponse.ok) {
        // OpenRouter uses OpenAI-compatible SSE: choices[0].delta.content
        yield* parseSSEStream(orResponse, "openrouter");
        return;
      }
    } catch (err: any) {
      console.warn(`[streamLLM] OpenRouter network error (${err?.message}), falling back to Anthropic`);
    }

    // If OpenRouter fails and we have Anthropic, fall through
    if (!ENV.anthropicApiKey) {
      throw new Error(`OpenRouter stream error: ${orResponse?.status || 'Network error'}`);
    }
    if (orResponse && !orResponse.ok) {
      console.warn(`[streamLLM] OpenRouter streaming failed (${orResponse.status}), falling back to Anthropic`);
    }
  }

  // Anthropic streaming fallback
  const anthropicPayload: Record<string, unknown> = {
    model: params.model ?? "claude-sonnet-4",
    max_tokens: maxTokens,
    temperature,
    messages: conversationMessages,
    stream: true,
  };

  if (systemPrompt) anthropicPayload.system = systemPrompt;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(anthropicPayload),
  });

  if (!response.ok) {
    throw new Error(`Anthropic stream error: ${response.status}`);
  }

  yield* parseSSEStream(response, "anthropic");
}

/**
 * Parse SSE stream from either Anthropic or OpenRouter/OpenAI format.
 */
async function* parseSSEStream(response: Response, provider: "anthropic" | "openrouter"): AsyncGenerator<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") return;

      try {
        const event = JSON.parse(jsonStr);
        if (provider === "anthropic") {
          // Anthropic format: content_block_delta → delta.text
          if (event.type === "content_block_delta" && event.delta?.text) {
            yield event.delta.text;
          }
        } else {
          // OpenRouter/OpenAI format: choices[0].delta.content
          const text = event.choices?.[0]?.delta?.content;
          if (text) {
            yield text;
          }
        }
      } catch {
        // Skip non-JSON lines
      }
    }
  }
}
