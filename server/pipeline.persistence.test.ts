/**
 * E2E persistence — create → score → pitch → publish round-trip.
 * Uses in-memory DB mock (no MySQL required in CI).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createMemoryDb, testEq, testAnd } from "./test/memoryDb";

vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./lib/supabase-sync", () => ({ syncArticleToPipeline: vi.fn() }));

import { getDb } from "./db";

const USER_ID = 1;

function ctx(): TrpcContext {
  return {
    user: {
      id: USER_ID,
      openId: "test-persist-001",
      email: "persist@elitewriter.com",
      name: "Persist Test",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

// Override drizzle eq/and in data router path via memory db where matchers
vi.mock("drizzle-orm", async (importOriginal) => {
  const orig = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...orig,
    eq: (col: { name: string }, val: unknown) => testEq(col, val),
    and: (...conds: unknown[]) => testAnd(...conds),
  };
});

describe("pipeline persistence E2E", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockResolvedValue(createMemoryDb() as never);
  });

  it("create → score → pitch → publish survives reload", async () => {
    const caller = appRouter.createCaller(ctx());

    const idea = await caller.data.ideas.create({
      title: "Phase A persistence probe",
      angle: "E2E round-trip",
      status: "idea",
    });
    expect(idea.id).toBeGreaterThan(0);

    const article = await caller.data.articles.create({
      title: "Phase A persistence probe",
      content: "Draft body for persistence test.",
      status: "draft",
    });
    expect(article.id).toBeGreaterThan(0);

    await caller.data.articles.update({
      id: article.id,
      overallScore: 82,
      scoreData: { clarity: 8, hook: 9 },
      status: "scored",
    });

    const pitch = await caller.data.pitches.create({
      publicationId: "test-pub",
      subject: "Pitch: Phase A persistence probe",
      publicationName: "Test Publication",
      articleTitle: "Phase A persistence probe",
      status: "draft",
    });
    expect(pitch.id).toBeGreaterThan(0);

    await caller.data.articles.update({
      id: article.id,
      status: "published",
    });

    const [ideasReload, articlesReload, pitchesReload] = await Promise.all([
      caller.data.ideas.list(),
      caller.data.articles.list(),
      caller.data.pitches.list(),
    ]);

    expect(ideasReload.some((i) => i.title === "Phase A persistence probe")).toBe(true);
    const art = articlesReload.find((a) => a.id === article.id);
    expect(art?.status).toBe("published");
    expect(art?.overallScore).toBe(82);
    expect(pitchesReload.some((p) => p.subject.includes("Phase A persistence probe"))).toBe(true);
  });
});
