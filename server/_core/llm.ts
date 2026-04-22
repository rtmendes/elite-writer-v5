/**
 * LLM Invocation Module — Standalone Anthropic Claude API
 * Replaces Manus Forge dependency with direct Claude API calls.
 * Falls back to OpenAI if configured and Anthropic unavailable.
 */
import { ENV } from "./env";

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
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const maxTokens = params.maxTokens ?? params.max_tokens ?? 4096;
  const format = params.response_format ?? params.responseFormat;
  const wantsJson = format?.type === "json_object" || format?.type === "json_schema";
  const temperature = params.temperature ?? 0.7;
  const model = params.model ?? "claude-sonnet-4-20250514";

  // Try Anthropic first
  if (ENV.anthropicApiKey) {
    return invokeAnthropic(params.messages, { maxTokens, wantsJson, temperature, model });
  }

  // Fallback: OpenAI
  if (ENV.openaiApiKey) {
    return invokeOpenAI(params.messages, { maxTokens, format, temperature });
  }

  // Legacy: Forge API
  if (ENV.forgeApiKey && ENV.forgeApiUrl) {
    return invokeForge(params);
  }

  throw new Error("No LLM API key configured (ANTHROPIC_API_KEY, OPENAI_API_KEY, or BUILT_IN_FORGE_API_KEY)");
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
 * Stream LLM response using Anthropic's streaming API.
 * Returns an async generator of text chunks.
 */
export async function* streamLLM(params: InvokeParams): AsyncGenerator<string> {
  if (!ENV.anthropicApiKey) {
    throw new Error("Streaming requires ANTHROPIC_API_KEY");
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

  const payload: Record<string, unknown> = {
    model: params.model ?? "claude-sonnet-4-20250514",
    max_tokens: params.maxTokens ?? params.max_tokens ?? 4096,
    temperature: params.temperature ?? 0.7,
    messages: conversationMessages,
    stream: true,
  };

  if (systemPrompt) payload.system = systemPrompt;

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
    throw new Error(`Anthropic stream error: ${response.status}`);
  }

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
        if (event.type === "content_block_delta" && event.delta?.text) {
          yield event.delta.text;
        }
      } catch {
        // Skip non-JSON lines
      }
    }
  }
}
