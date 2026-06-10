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

    (global.fetch as any)
      .mockRejectedValueOnce(new Error('OpenRouter network error'))
      .mockRejectedValueOnce(new Error('OpenAI network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Anthropic success' }]
        })
      });

    const result = await invokeLLM({ messages: [{ role: 'user', content: 'test' }] });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    // Check URLs
    expect((global.fetch as any).mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((global.fetch as any).mock.calls[1][0]).toBe('https://api.openai.com/v1/chat/completions');
    expect((global.fetch as any).mock.calls[2][0]).toBe('https://api.anthropic.com/v1/messages');

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

    // OpenRouter
    mockFetch.mockRejectedValueOnce(new Error('OR Error'));
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
    expect(resolveModelSlug(undefined)).toBe('anthropic/claude-sonnet-4');
  });
});
