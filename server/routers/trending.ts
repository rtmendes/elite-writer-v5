import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { trendingTopics } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export const trendingRouter = router({
  list: protectedProcedure
    .input(z.object({
      platform: z.string().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(trendingTopics.userId, ctx.user.id)];
      if (input?.platform && input.platform !== "all") {
        conditions.push(sql`${trendingTopics.platform} = ${input.platform}`);
      }
      if (input?.category) {
        conditions.push(sql`${trendingTopics.category} = ${input.category}`);
      }
      if (input?.status) {
        conditions.push(sql`${trendingTopics.status} = ${input.status}`);
      }
      return db.select().from(trendingTopics)
        .where(and(...conditions))
        .orderBy(desc(trendingTopics.trendScore))
        .limit(input?.limit ?? 50);
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      platform: z.string().default("general"),
      category: z.string().optional(),
      trendScore: z.number().default(50),
      velocity: z.string().default("rising"),
      suggestedAngles: z.array(z.string()).optional(),
      sampleHeadlines: z.array(z.string()).optional(),
      relatedKeywords: z.array(z.string()).optional(),
      sourceUrl: z.string().optional(),
      brandId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(trendingTopics).values({
        userId: ctx.user.id,
        ...input,
      } as any).returning({ id: trendingTopics.id });
      return { id: result.id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      platform: z.string().optional(),
      category: z.string().optional(),
      trendScore: z.number().optional(),
      velocity: z.string().optional(),
      suggestedAngles: z.array(z.string()).optional(),
      status: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      await db.update(trendingTopics)
        .set(data as any)
        .where(and(eq(trendingTopics.id, id), eq(trendingTopics.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(trendingTopics)
        .where(and(eq(trendingTopics.id, input.id), eq(trendingTopics.userId, ctx.user.id)));
      return { success: true };
    }),
});
