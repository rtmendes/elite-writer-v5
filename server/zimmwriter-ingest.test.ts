/**
 * ZimmWriter ingest — idempotent article insert with memory DB mock.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createMemoryDb, testEq, testAnd } from "./test/memoryDb";
import { ingestZimmwriterArticle } from "./lib/zimmwriter-ingest";
import { computeIngestHmac, verifyZimmwriterIngestAuth } from "../shared/zimmwriter-ingest";

vi.mock("./db", () => ({
  getDb: vi.fn(),
  getUserByOpenId: vi.fn().mockResolvedValue({ id: 99, openId: "admin_test", role: "admin" }),
  upsertUser: vi.fn(),
}));
vi.mock("./lib/supabase-sync", () => ({ syncArticleToPipeline: vi.fn() }));

import { getDb } from "./db";

vi.mock("drizzle-orm", async (importOriginal) => {
  const orig = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...orig,
    eq: (col: { name: string }, val: unknown) => testEq(col, val),
    and: (...conds: unknown[]) => testAnd(...conds),
    or: (...conds: unknown[]) => ({ type: "or", conditions: conds }),
    like: () => ({ type: "like" }),
    sql: () => ({ type: "sql" }),
  };
});

const SAMPLE = {
  webhook_name: "second_spring",
  title: "What Is Perimenopause? A Plain-English Guide",
  markdown: "## What's Actually Happening\nA plain guide.",
  html: "<h2>What's Actually Happening</h2><p>A plain guide.</p>",
  excerpt: "A plain-English guide.",
  image_base64: false as const,
  category: "Perimenopause 101",
  image_url: false as const,
  slug: "what-is-perimenopause",
  tags: ["perimenopause", "midlife"],
};

describe("ingestZimmwriterArticle", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockResolvedValue(createMemoryDb() as never);
  });

  it("creates draft article with needs_scoring=true", async () => {
    const result = await ingestZimmwriterArticle(SAMPLE);
    expect(result.status).toBe("created");
    expect(result.id).toBeGreaterThan(0);

    const db = await getDb();
    const row = (db as ReturnType<typeof createMemoryDb>)._stores.articles[0];
    expect(row.status).toBe("draft");
    expect(row.needsScoring).toBe(true);
    expect(row.source).toBe("zimmwriter");
    expect(row.brandId).toBe("second_spring");
  });

  it("returns exists on duplicate source_id", async () => {
    const first = await ingestZimmwriterArticle(SAMPLE);
    const second = await ingestZimmwriterArticle(SAMPLE);
    expect(first.status).toBe("created");
    expect(second).toEqual({ status: "exists", id: first.id });

    const db = await getDb();
    expect((db as ReturnType<typeof createMemoryDb>)._stores.articles).toHaveLength(1);
  });
});

describe("articles.update approval gate", () => {
  it("blocks pitched when healthClaimsSafety is below threshold", async () => {
    vi.mocked(getDb).mockResolvedValue(createMemoryDb() as never);
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: {
        id: 1,
        openId: "gate-test",
        email: "gate@test.com",
        name: "Gate",
        loginMethod: "test",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} },
      res: { clearCookie: () => {} },
    } as import("./_core/context").TrpcContext);

    const article = await caller.data.articles.create({
      title: "Risky health claims article",
      content: "This supplement cures menopause insomnia.",
      scoreData: { healthClaimsSafety: 45 },
    });

    await expect(
      caller.data.articles.update({ id: article.id, status: "pitched" })
    ).rejects.toThrow(/Health-Claims Safety/);
  });
});

describe("ingest HTTP auth integration", () => {
  const secret = "integration-test-secret-key!!";
  const token = "integration-test-token-value";
  const body = Buffer.from(JSON.stringify(SAMPLE));

  it("HMAC path authorizes and token path authorizes independently", () => {
    const sig = computeIngestHmac(body, secret);
    expect(verifyZimmwriterIngestAuth({ rawBody: body, signatureHeader: sig, secret }).ok).toBe(true);
    expect(verifyZimmwriterIngestAuth({ rawBody: body, tokenHeader: token, token }).ok).toBe(true);
    expect(verifyZimmwriterIngestAuth({ rawBody: body, secret, token }).ok).toBe(false);
  });
});
