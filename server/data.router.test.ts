import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-001",
      email: "test@elitewriter.com",
      name: "Test Writer",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("data router - procedure existence", () => {
  it("has all expected data sub-routers", () => {
    const caller = appRouter.createCaller(createAuthContext());
    expect(caller.data).toBeDefined();
    expect(caller.data.ideas).toBeDefined();
    expect(caller.data.articles).toBeDefined();
    expect(caller.data.pitches).toBeDefined();
    expect(caller.data.research).toBeDefined();
    expect(caller.data.brands).toBeDefined();
    expect(caller.data.earnings).toBeDefined();
  });

  it("ideas.list returns empty array when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.data.ideas.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it("articles.list returns empty array when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.data.articles.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it("pitches.list returns empty array when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.data.pitches.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it("research.list returns empty array when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.data.research.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it("brands.list returns empty array when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.data.brands.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it("earnings.list returns empty array when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.data.earnings.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });
});

describe("data router - input validation", () => {
  it("ideas.create rejects empty title", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.data.ideas.create({ title: "" })
    ).rejects.toThrow();
  });

  it("articles.create rejects empty title", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.data.articles.create({ title: "" })
    ).rejects.toThrow();
  });
});
