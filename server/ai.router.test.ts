import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the LLM to avoid real API calls during testing
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          overall: 78,
          originality: 80,
          depth: 75,
          clarity: 82,
          structure: 76,
          evidence: 70,
          voice: 79,
          audience: 81,
          timeliness: 74,
          seo: 72,
          publication_fit: 77,
          summary: "Strong article with good structure.",
          improvements: ["Add more data points", "Strengthen the conclusion"],
          strengths: ["Clear voice", "Good topic selection"],
        }),
      },
    }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("ai.score", () => {
  it("returns a structured score response", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.score({
      content: "This is a test article about the future of AI in healthcare.",
      title: "AI in Healthcare: A New Frontier",
      publication: "Forbes",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.overall).toBeGreaterThanOrEqual(0);
    expect(result.data.overall).toBeLessThanOrEqual(100);
    expect(result.usage).toBeDefined();
    expect(result.usage.total_tokens).toBeGreaterThan(0);
  });
});

describe("ai.ideas", () => {
  it("returns generated ideas", async () => {
    // Re-mock for ideas endpoint
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            ideas: [
              { title: "Test Idea 1", hook: "Hook 1", timeliness: "Current" },
              { title: "Test Idea 2", hook: "Hook 2", timeliness: "Trending" },
            ],
          }),
        },
      }],
      usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
    });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.ideas({
      topics: ["Technology"],
      count: 2,
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});

describe("ai.pitch", () => {
  it("returns a generated pitch", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            subject: "Pitch: AI in Healthcare",
            body: "Dear Editor, I would like to propose an article...",
          }),
        },
      }],
      usage: { prompt_tokens: 80, completion_tokens: 150, total_tokens: 230 },
    });

    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.pitch({
      articleTitle: "AI in Healthcare",
      articleSummary: "An exploration of how AI is transforming healthcare delivery.",
      publicationName: "Forbes",
      editorName: "John Smith",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
