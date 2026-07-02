import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { contentCalendar } from "../../drizzle/schema";
import { eq, desc, and, sql, between } from "drizzle-orm";

export const calendarRouter = router({
  list: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(), // YYYY-MM-DD
      endDate: z.string().optional(),
      platform: z.string().optional(),
      status: z.string().optional(),
      brandId: z.number().optional(),
      limit: z.number().default(200),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(contentCalendar.userId, ctx.user.id)];
      if (input?.startDate && input?.endDate) {
        conditions.push(between(contentCalendar.scheduledDate, input.startDate, input.endDate));
      }
      if (input?.platform && input.platform !== "all") {
        conditions.push(sql`${contentCalendar.platform} = ${input.platform}`);
      }
      if (input?.status) {
        conditions.push(sql`${contentCalendar.status} = ${input.status}`);
      }
      if (input?.brandId) {
        conditions.push(eq(contentCalendar.brandId, input.brandId));
      }
      return db.select().from(contentCalendar)
        .where(and(...conditions))
        .orderBy(contentCalendar.scheduledDate)
        .limit(input?.limit ?? 200);
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      scheduledDate: z.string(),
      scheduledTime: z.string().optional(),
      platform: z.string().default("linkedin"),
      contentType: z.string().default("post"),
      status: z.string().default("planned"),
      brandId: z.number().optional(),
      contentItemId: z.number().optional(),
      assignee: z.string().optional(),
      color: z.string().optional(),
      metadata: z.object({
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        campaignId: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(contentCalendar).values({
        userId: ctx.user.id,
        ...input,
      } as any).returning({ id: contentCalendar.id });
      return { id: result.id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      scheduledDate: z.string().optional(),
      scheduledTime: z.string().optional(),
      platform: z.string().optional(),
      contentType: z.string().optional(),
      status: z.string().optional(),
      assignee: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      await db.update(contentCalendar)
        .set(data as any)
        .where(and(eq(contentCalendar.id, id), eq(contentCalendar.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(contentCalendar)
        .where(and(eq(contentCalendar.id, input.id), eq(contentCalendar.userId, ctx.user.id)));
      return { success: true };
    }),
});
