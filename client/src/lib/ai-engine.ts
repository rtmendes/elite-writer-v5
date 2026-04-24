// Elite Writer V5 — Multi-LLM AI Engine
// Cost-optimized routing: uses cheapest model for each task type
// Supports: OpenAI, Anthropic, OpenRouter, Google Gemini
// Tracks token usage and cost per provider

export type LLMProvider = 'openai' | 'anthropic' | 'openrouter' | 'gemini';
export type TaskType = 'score' | 'draft' | 'pitch' | 'research' | 'summarize' | 'ideas' | 'edit' | 'analyze';

export interface LLMConfig {
  openai_key: string;
  anthropic_key: string;
  openrouter_key: string;
  gemini_key: string;
  newsapi_key: string;
  gnews_key: string;
  mediastack_key: string;
  preferred_provider: LLMProvider | 'auto';
  cost_mode: 'minimum' | 'balanced' | 'quality';
}

interface ModelSpec {
  provider: LLMProvider;
  model: string;
  costPer1kInput: number;
  costPer1kOutput: number;
  maxTokens: number;
  label: string;
  tier: 'free' | 'cheap' | 'standard' | 'premium';
}

// Model catalog with real pricing (as of 2026)
const MODEL_CATALOG: ModelSpec[] = [
  // Free / ultra-cheap tier
  { provider: 'gemini', model: 'gemini-2.0-flash', costPer1kInput: 0, costPer1kOutput: 0, maxTokens: 8192, label: 'Gemini 2.0 Flash (Free)', tier: 'free' },
  { provider: 'openrouter', model: 'google/gemini-2.0-flash-exp:free', costPer1kInput: 0, costPer1kOutput: 0, maxTokens: 8192, label: 'Gemini Flash via OpenRouter (Free)', tier: 'free' },
  { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', costPer1kInput: 0, costPer1kOutput: 0, maxTokens: 8192, label: 'Llama 3.3 70B (Free)', tier: 'free' },
  // Cheap tier
  { provider: 'openai', model: 'gpt-4o-mini', costPer1kInput: 0.00015, costPer1kOutput: 0.0006, maxTokens: 16384, label: 'GPT-4o Mini', tier: 'cheap' },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', costPer1kInput: 0.0008, costPer1kOutput: 0.004, maxTokens: 8192, label: 'Claude 3.5 Haiku', tier: 'cheap' },
  // Standard tier
  { provider: 'openai', model: 'gpt-4o', costPer1kInput: 0.0025, costPer1kOutput: 0.01, maxTokens: 16384, label: 'GPT-4o', tier: 'standard' },
  { provider: 'anthropic', model: 'claude-sonnet-4-20250514', costPer1kInput: 0.003, costPer1kOutput: 0.015, maxTokens: 8192, label: 'Claude Sonnet 4', tier: 'standard' },
  // Premium tier
  { provider: 'openai', model: 'o3-mini', costPer1kInput: 0.011, costPer1kOutput: 0.044, maxTokens: 100000, label: 'o3-mini (Reasoning)', tier: 'premium' },
  { provider: 'anthropic', model: 'claude-opus-4-20250514', costPer1kInput: 0.015, costPer1kOutput: 0.075, maxTokens: 8192, label: 'Claude Opus 4', tier: 'premium' },
];

// Task → tier mapping for cost optimization
const TASK_TIER_MAP: Record<string, Record<TaskType, ModelSpec['tier']>> = {
  minimum: {
    score: 'free', draft: 'cheap', pitch: 'free', research: 'free',
    summarize: 'free', ideas: 'free', edit: 'cheap', analyze: 'free',
  },
  balanced: {
    score: 'cheap', draft: 'standard', pitch: 'cheap', research: 'cheap',
    summarize: 'free', ideas: 'cheap', edit: 'standard', analyze: 'cheap',
  },
  quality: {
    score: 'standard', draft: 'premium', pitch: 'standard', research: 'standard',
    summarize: 'cheap', ideas: 'standard', edit: 'premium', analyze: 'standard',
  },
};

export interface TokenUsage {
  provider: LLMProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  task: TaskType;
  timestamp: string;
}

export interface AIEngineState {
  config: LLMConfig;
  usage: TokenUsage[];
  totalCost: number;
  totalTokens: number;
}

const AI_CONFIG_KEY = 'elite_writer_ai_config';
const AI_USAGE_KEY = 'elite_writer_ai_usage';

export function getDefaultAIConfig(): LLMConfig {
  return {
    openai_key: '', anthropic_key: '', openrouter_key: '', gemini_key: '',
    newsapi_key: '', gnews_key: '', mediastack_key: '',
    preferred_provider: 'auto', cost_mode: 'balanced',
  };
}

export function loadAIConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) return { ...getDefaultAIConfig(), ...JSON.parse(raw) };
  } catch {}
  return getDefaultAIConfig();
}

export function saveAIConfig(config: LLMConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

export function loadUsage(): TokenUsage[] {
  try {
    const raw = localStorage.getItem(AI_USAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveUsage(usage: TokenUsage[]): void {
  localStorage.setItem(AI_USAGE_KEY, JSON.stringify(usage.slice(-500)));
}

function getAvailableProviders(config: LLMConfig): LLMProvider[] {
  const providers: LLMProvider[] = [];
  if (config.openai_key) providers.push('openai');
  if (config.anthropic_key) providers.push('anthropic');
  if (config.openrouter_key) providers.push('openrouter');
  if (config.gemini_key) providers.push('gemini');
  return providers;
}

function selectModel(config: LLMConfig, task: TaskType): ModelSpec | null {
  const available = getAvailableProviders(config);
  if (available.length === 0) return null;

  const tierMap = TASK_TIER_MAP[config.cost_mode] || TASK_TIER_MAP.balanced;
  const targetTier = tierMap[task];

  // Try exact tier match first
  const tierOrder: ModelSpec['tier'][] = ['free', 'cheap', 'standard', 'premium'];
  const startIdx = tierOrder.indexOf(targetTier);

  for (let i = startIdx; i < tierOrder.length; i++) {
    const candidates = MODEL_CATALOG.filter(
      m => m.tier === tierOrder[i] && available.includes(m.provider)
    );
    if (config.preferred_provider !== 'auto') {
      const preferred = candidates.find(m => m.provider === config.preferred_provider);
      if (preferred) return preferred;
    }
    if (candidates.length > 0) return candidates[0];
  }
  // Fallback: any available model
  for (let i = 0; i < tierOrder.length; i++) {
    const candidates = MODEL_CATALOG.filter(m => m.tier === tierOrder[i] && available.includes(m.provider));
    if (candidates.length > 0) return candidates[0];
  }
  return null;
}

function getApiKey(config: LLMConfig, provider: LLMProvider): string {
  switch (provider) {
    case 'openai': return config.openai_key;
    case 'anthropic': return config.anthropic_key;
    case 'openrouter': return config.openrouter_key;
    case 'gemini': return config.gemini_key;
  }
}

async function callLLM(
  config: LLMConfig,
  model: ModelSpec,
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number } = {}
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const key = getApiKey(config, model.provider);
  const temp = options.temperature ?? 0.7;
  const maxTok = options.maxTokens ?? 2000;

  if (model.provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: model.model, temperature: temp, max_tokens: maxTok,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || 'OpenAI error'); }
    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };
  }

  if (model.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'x-api-key': key,
        'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model.model, max_tokens: maxTok, temperature: temp,
        system: systemPrompt, messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || 'Anthropic error'); }
    const data = await res.json();
    return {
      text: data.content?.[0]?.text || '',
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };
  }

  if (model.provider === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${key}`,
        'HTTP-Referer': window.location.href, 'X-Title': 'Elite Writer V5',
      },
      body: JSON.stringify({
        model: model.model, temperature: temp, max_tokens: maxTok,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || 'OpenRouter error'); }
    const data = await res.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };
  }

  if (model.provider === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model.model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: { temperature: temp, maxOutputTokens: maxTok },
      }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || 'Gemini error'); }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const inTok = data.usageMetadata?.promptTokenCount || 0;
    const outTok = data.usageMetadata?.candidatesTokenCount || 0;
    return { text, inputTokens: inTok, outputTokens: outTok };
  }

  throw new Error('Unknown provider');
}

// Main AI generation function with cost tracking
export async function aiGenerate(
  task: TaskType,
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number; forceProvider?: LLMProvider } = {}
): Promise<{ text: string; model: string; provider: LLMProvider; cost: number }> {
  const config = loadAIConfig();
  let model: ModelSpec | null;

  if (options.forceProvider) {
    model = MODEL_CATALOG.find(m => m.provider === options.forceProvider && getApiKey(config, m.provider)) || null;
  } else {
    model = selectModel(config, task);
  }

  if (!model) throw new Error('No AI provider configured. Add an API key in Settings.');

  const result = await callLLM(config, model, systemPrompt, userPrompt, options);
  const cost = (result.inputTokens / 1000) * model.costPer1kInput + (result.outputTokens / 1000) * model.costPer1kOutput;

  // Track usage
  const usage = loadUsage();
  usage.push({
    provider: model.provider, model: model.model,
    inputTokens: result.inputTokens, outputTokens: result.outputTokens,
    cost, task, timestamp: new Date().toISOString(),
  });
  saveUsage(usage);

  return { text: result.text, model: model.label, provider: model.provider, cost };
}

export function hasAnyProvider(): boolean {
  const config = loadAIConfig();
  return getAvailableProviders(config).length > 0;
}

export function getProviderStatus(): Record<string, { configured: boolean; label: string }> {
  const config = loadAIConfig();
  return {
    openai: { configured: !!config.openai_key, label: 'OpenAI' },
    anthropic: { configured: !!config.anthropic_key, label: 'Anthropic' },
    openrouter: { configured: !!config.openrouter_key, label: 'OpenRouter' },
    gemini: { configured: !!config.gemini_key, label: 'Google Gemini' },
    newsapi: { configured: !!config.newsapi_key, label: 'NewsAPI' },
    gnews: { configured: !!config.gnews_key, label: 'GNews' },
    mediastack: { configured: !!config.mediastack_key, label: 'MediaStack' },
  };
}

export function getUsageSummary(): { totalCost: number; totalTokens: number; byProvider: Record<string, { cost: number; tokens: number; calls: number }>; byTask: Record<string, { cost: number; calls: number }> } {
  const usage = loadUsage();
  const byProvider: Record<string, { cost: number; tokens: number; calls: number }> = {};
  const byTask: Record<string, { cost: number; calls: number }> = {};
  let totalCost = 0;
  let totalTokens = 0;

  for (const u of usage) {
    totalCost += u.cost;
    totalTokens += u.inputTokens + u.outputTokens;
    if (!byProvider[u.provider]) byProvider[u.provider] = { cost: 0, tokens: 0, calls: 0 };
    byProvider[u.provider].cost += u.cost;
    byProvider[u.provider].tokens += u.inputTokens + u.outputTokens;
    byProvider[u.provider].calls += 1;
    if (!byTask[u.task]) byTask[u.task] = { cost: 0, calls: 0 };
    byTask[u.task].cost += u.cost;
    byTask[u.task].calls += 1;
  }

  return { totalCost, totalTokens, byProvider, byTask };
}

export { MODEL_CATALOG, getAvailableProviders };
// Add after the existing exports at the bottom of ai-engine.ts

// Sync from server env vars — called once on Settings page mount
export async function syncFromServer(): Promise<LLMConfig | null> {
  try {
    const res = await fetch('/api/trpc/system.getServerKeys', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.result?.data?.json ?? json?.result?.data ?? null;
    if (!data) return null;

    const current = loadAIConfig();
    let changed = false;

    // Merge server keys into config (only fill empty fields)
    const keyMap: Array<[keyof LLMConfig, string]> = [
      ['openai_key', 'openai_key'],
      ['anthropic_key', 'anthropic_key'],
      ['openrouter_key', 'openrouter_key'],
      ['gemini_key', 'gemini_key'],
      ['newsapi_key', 'newsapi_key'],
      ['gnews_key', 'gnews_key'],
      ['mediastack_key', 'mediastack_key'],
    ];

    for (const [configKey, serverKey] of keyMap) {
      if (!current[configKey] && data[serverKey]) {
        (current as any)[configKey] = data[serverKey];
        changed = true;
      }
    }

    if (changed) {
      saveAIConfig(current);
    }
    return current;
  } catch (e) {
    console.warn('Failed to sync from server:', e);
    return null;
  }
}
