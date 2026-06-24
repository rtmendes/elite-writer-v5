import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invokeLLM, streamLLM } from './llm';
import { ENV } from './env';

// Mock ENV
vi.mock('./env', () => ({
  ENV: {
    openrouterApiKey: 'mock-openrouter',
    openaiApiKey: 'mock-openai',
    anthropicApiKey: 'mock-anthropic',
    forgeApiKey: 'mock-forge',
    forgeApiUrl: 'mock-forge-url',
  }
}));

// Mock fetch globally
const originalFetch = global.fetch;

describe('invokeLLM', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should fall back correctly if providers fail', async () => {
    // We will simulate OpenRouter failing, then OpenAI failing, then Anthropic succeeding

    // Default model is the :free tier, so OpenRouter walks the 4-rung free
    // ladder first, then OpenAI, then Anthropic succeeds.
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('OpenRouter free #1 down'))
      .mockRejectedValueOnce(new Error('OpenRouter free #2 down'))
      .mockRejectedValueOnce(new Error('OpenRouter free #3 down'))
      .mockRejectedValueOnce(new Error('OpenRouter haiku rung down'))
      .mockRejectedValueOnce(new Error('OpenAI network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Anthropic success' }]
        })
      });

    const result = await invokeLLM({ messages: [{ role: 'user', content: 'test' }] });

    expect(global.fetch).toHaveBeenCalledTimes(6);
    // Check URLs: 4 OpenRouter ladder attempts, then OpenAI, then Anthropic
    for (let i = 0; i < 4; i++) {
      expect((global.fetch as any).mock.calls[i][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    }
    expect((global.fetch as any).mock.calls[4][0]).toBe('https://api.openai.com/v1/chat/completions');
    expect((global.fetch as any).mock.calls[5][0]).toBe('https://api.anthropic.com/v1/messages');

    expect(result.choices[0].message.content).toBe('Anthropic success');
  });
});

describe('streamLLM', () => {
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function createMockReadableStream(chunks: string[]) {
    return new ReadableStream({
      start(controller) {
        chunks.forEach(chunk => controller.enqueue(new TextEncoder().encode(chunk)));
        controller.close();
      }
    });
  }

  it('should handle OpenRouter SSE stream correctly', async () => {
    const mockStream = createMockReadableStream([
      'data: {"choices": [{"delta": {"content": "Hello"}}]}\n\n',
      'data: {"choices": [{"delta": {"content": " World"}}]}\n\n',
      'data: [DONE]\n\n'
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
    });

    const generator = streamLLM({ messages: [{ role: 'user', content: 'test' }] });

    const chunks = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' World']);
  });

  it('should fall back to Anthropic if OpenRouter fails with non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429
    });

    const mockAnthropicStream = createMockReadableStream([
      'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Anthropic"}}\n\n',
      'data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": " Stream"}}\n\n',
      'data: [DONE]\n\n'
    ]);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockAnthropicStream,
    });

    const generator = streamLLM({ messages: [{ role: 'user', content: 'test' }] });

    const chunks = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Anthropic', ' Stream']);
  });

  it('should fall back to Anthropic if OpenRouter fetch throws a network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const mockAnthropicStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "AnthropicFallback"}}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockAnthropicStream,
    });

    const generator = streamLLM({ messages: [{ role: 'user', content: 'test' }] });

    const chunks = [];
    try {
      for await (const chunk of generator) {
        chunks.push(chunk);
      }
    } catch (e) {
      chunks.push('ERROR_CAUGHT');
    }

    expect(chunks).toEqual(['AnthropicFallback']);
  });
});

describe('parseSSEStream', () => {
  it('should parse Anthropic SSE correctly', async () => {
    let mockFetch = vi.fn();
    global.fetch = mockFetch;

    const mockAnthropicStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "A"}}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "B"}}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429
    }).mockResolvedValueOnce({
      ok: true,
      body: mockAnthropicStream,
    });

    const generator = streamLLM({ messages: [{ role: 'user', content: 'test' }] });
    const chunks = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['A', 'B']);

    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should parse OpenRouter/OpenAI SSE correctly', async () => {
    let mockFetch = vi.fn();
    global.fetch = mockFetch;

    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices": [{"delta": {"content": "O"}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"choices": [{"delta": {"content": "R"}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockStream,
    });

    const generator = streamLLM({ messages: [{ role: 'user', content: 'test' }] });
    const chunks = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['O', 'R']);

    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });
});

describe('invokeLLM Fallbacks and Errors', () => {
  it('should throw error when all providers fail', async () => {
    let mockFetch = vi.fn();
    global.fetch = mockFetch;

    // OpenRouter — 4-rung free ladder (default model is :free)
    mockFetch.mockRejectedValueOnce(new Error('OR Error 1'));
    mockFetch.mockRejectedValueOnce(new Error('OR Error 2'));
    mockFetch.mockRejectedValueOnce(new Error('OR Error 3'));
    mockFetch.mockRejectedValueOnce(new Error('OR Error 4'));
    // OpenAI
    mockFetch.mockRejectedValueOnce(new Error('OAI Error'));
    // Anthropic
    mockFetch.mockRejectedValueOnce(new Error('Anthropic Error'));
    // Forge
    mockFetch.mockRejectedValueOnce(new Error('Forge Error'));

    await expect(invokeLLM({ messages: [{ role: 'user', content: 'test' }] })).rejects.toThrow('Forge Error');

    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });
});

describe('resolveModelSlug', () => {
  it('maps bare aliases to the correct provider family', async () => {
    const { resolveModelSlug } = await import('./llm');
    expect(resolveModelSlug('gemini-flash')).toBe('google/gemini-2.5-flash');
    expect(resolveModelSlug('gpt-4o')).toBe('openai/gpt-4o');
    expect(resolveModelSlug('claude-sonnet')).toBe('anthropic/claude-sonnet-4.6');
    expect(resolveModelSlug('deepseek-r1')).toBe('deepseek/deepseek-r1');
  });
  it('passes through prefixed slugs and defaults unknown bare names to anthropic', async () => {
    const { resolveModelSlug } = await import('./llm');
    expect(resolveModelSlug('openai/gpt-4o-mini')).toBe('openai/gpt-4o-mini');
    expect(resolveModelSlug('claude-future-9')).toBe('anthropic/claude-future-9');
    // House policy: unspecified model = free tier
    expect(resolveModelSlug(undefined)).toBe('openai/gpt-oss-120b:free');
  });
});

describe('resolveAnthropicModel', () => {
  afterEach(async () => {
    // Reset the cached catalog so other suites see the default (empty) state.
    const { _setAnthropicModelIds } = await import('./llm');
    _setAnthropicModelIds([]);
  });

  it('normalizes dotted/prefixed slugs to dash-style ids (no catalog)', async () => {
    const { resolveAnthropicModel, _setAnthropicModelIds } = await import('./llm');
    _setAnthropicModelIds([]);
    expect(resolveAnthropicModel('anthropic/claude-sonnet-4.6')).toBe('claude-sonnet-4-6');
    expect(resolveAnthropicModel('anthropic/claude-opus-4.8')).toBe('claude-opus-4-8');
    expect(resolveAnthropicModel('anthropic/claude-haiku-4.5')).toBe('claude-haiku-4-5');
  });

  it('maps legacy bare names and non-Anthropic slugs to a valid default', async () => {
    const { resolveAnthropicModel, _setAnthropicModelIds } = await import('./llm');
    _setAnthropicModelIds([]);
    // The old buggy default + the free tier slug must not reach Anthropic verbatim.
    expect(resolveAnthropicModel('claude-sonnet-4')).toBe('claude-sonnet-4-6');
    expect(resolveAnthropicModel('openai/gpt-oss-120b:free')).toBe('claude-sonnet-4-6');
    expect(resolveAnthropicModel(undefined)).toBe('claude-sonnet-4-6');
  });

  it('repairs to the closest account-served id when the catalog is known', async () => {
    const { resolveAnthropicModel, _setAnthropicModelIds } = await import('./llm');
    _setAnthropicModelIds(['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001']);
    // Exact undated id served -> kept.
    expect(resolveAnthropicModel('anthropic/claude-sonnet-4.6')).toBe('claude-sonnet-4-6');
    // Undated haiku not served -> repaired to the dated id in the same family.
    expect(resolveAnthropicModel('anthropic/claude-haiku-4.5')).toBe('claude-haiku-4-5-20251001');
    // Unknown family -> falls back to a served sonnet.
    expect(resolveAnthropicModel('anthropic/claude-mystery-9')).toBe('claude-sonnet-4-6');
  });
});
