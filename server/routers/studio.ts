import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { contentStudioItems, brands } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export const studioRouter = router({
  list: protectedProcedure
    .input(z.object({
      platform: z.string().optional(),
      contentType: z.string().optional(),
      status: z.string().optional(),
      brandId: z.number().optional(),
      limit: z.number().default(500),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(contentStudioItems.userId, ctx.user.id)];
      if (input?.platform && input.platform !== "all") {
        conditions.push(sql`${contentStudioItems.platform} = ${input.platform}`);
      }
      if (input?.contentType && input.contentType !== "all") {
        conditions.push(sql`${contentStudioItems.contentType} = ${input.contentType}`);
      }
      if (input?.status && input.status !== "all") {
        conditions.push(sql`${contentStudioItems.status} = ${input.status}`);
      }
      if (input?.brandId) {
        conditions.push(eq(contentStudioItems.brandId, input.brandId));
      }
      return db.select().from(contentStudioItems)
        .where(and(...conditions))
        .orderBy(desc(contentStudioItems.updatedAt))
        .limit(input?.limit ?? 500);
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      body: z.string().optional(),
      platform: z.string().default("linkedin"),
      contentType: z.string().default("post"),
      status: z.string().default("draft"),
      brandId: z.number().optional(),
      sourceInsightId: z.number().optional(),
      trendingTopicId: z.number().optional(),
      imageUrl: z.string().optional(),
      metadata: z.object({
        hashtags: z.array(z.string()).optional(),
        mentions: z.array(z.string()).optional(),
        hooks: z.array(z.string()).optional(),
        cta: z.string().optional(),
        targetAudience: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const charCount = input.body?.length ?? 0;
      const [result] = await db.insert(contentStudioItems).values({
        userId: ctx.user.id,
        charCount,
        ...input,
      } as any);
      return { id: result.insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      body: z.string().optional(),
      platform: z.string().optional(),
      contentType: z.string().optional(),
      status: z.string().optional(),
      imageUrl: z.string().optional(),
      publishUrl: z.string().optional(),
      metadata: z.object({
        hashtags: z.array(z.string()).optional(),
        mentions: z.array(z.string()).optional(),
        hooks: z.array(z.string()).optional(),
        cta: z.string().optional(),
        targetAudience: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      if (data.body !== undefined) {
        (data as any).charCount = data.body.length;
      }
      await db.update(contentStudioItems)
        .set(data as any)
        .where(and(eq(contentStudioItems.id, id), eq(contentStudioItems.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(contentStudioItems)
        .where(and(eq(contentStudioItems.id, input.id), eq(contentStudioItems.userId, ctx.user.id)));
      return { success: true };
    }),

  publish: protectedProcedure
    .input(z.object({
      id: z.number(),
      publishUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(contentStudioItems).set({
        status: "published",
        publishUrl: input.publishUrl,
        publishedAt: new Date(),
      } as any).where(and(eq(contentStudioItems.id, input.id), eq(contentStudioItems.userId, ctx.user.id)));
      return { success: true };
    }),
  // ─── List Brands ──────────────────────────────────────────
  listBrands: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(brands)
      .where(eq(brands.userId, ctx.user.id))
      .orderBy(brands.name);
  }),

  // ─── AI Enrich — generate metadata for a content item ─────
  enrich: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [item] = await db.select().from(contentStudioItems)
        .where(and(eq(contentStudioItems.id, input.id), eq(contentStudioItems.userId, ctx.user.id)));
      if (!item) throw new Error("Item not found");
      // Return the item for client-side enrichment display
      return { success: true, item };
    }),
});
