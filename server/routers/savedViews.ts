/**
 * Saved Views router — per-user collection view state (Admin UX).
 * A view captures a collection page's search + filters + sort + visible columns
 * + view mode as JSON, so operators can save and switch between organizing
 * setups per collection. See docs/PRD_ADMIN_UX.md.
 */
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { savedViews } from "../../drizzle/schema";

const viewConfig = z.object({
  search: z.string().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  sort: z.object({ field: z.string(), dir: z.enum(["asc", "desc"]) }).nullable().optional(),
  columns: z.array(z.string()).optional(),
  mode: z.enum(["list", "gallery", "kanban"]).optional(),
});

export const savedViewsRouter = router({
  // All of this user's views for one collection page, oldest first.
  list: protectedProcedure
    .input(z.object({ page: z.string().min(1).max(60) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(savedViews)
        .where(and(eq(savedViews.userId, ctx.user.id), eq(savedViews.page, input.page)))
        .orderBy(asc(savedViews.createdAt));
    }),

  create: protectedProcedure
    .input(z.object({
      page: z.string().min(1).max(60),
      name: z.string().min(1).max(120),
      config: viewConfig,
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      if (input.isDefault) await clearDefault(db, ctx.user.id, input.page);
      const [row] = await db
        .insert(savedViews)
        .values({ userId: ctx.user.id, page: input.page, name: input.name, config: input.config, isDefault: input.isDefault })
        .returning({ id: savedViews.id });
      return { id: row.id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(120).optional(),
      config: viewConfig.optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...rest } = input;
      // Ownership scoping: only touch the caller's own view.
      const [existing] = await db
        .select({ page: savedViews.page })
        .from(savedViews)
        .where(and(eq(savedViews.id, id), eq(savedViews.userId, ctx.user.id)))
        .limit(1);
      if (!existing) throw new Error("View not found");
      if (rest.isDefault) await clearDefault(db, ctx.user.id, existing.page);
      const set: Record<string, unknown> = {};
      if (rest.name !== undefined) set.name = rest.name;
      if (rest.config !== undefined) set.config = rest.config;
      if (rest.isDefault !== undefined) set.isDefault = rest.isDefault;
      if (Object.keys(set).length > 0) {
        await db.update(savedViews).set(set).where(and(eq(savedViews.id, id), eq(savedViews.userId, ctx.user.id)));
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(savedViews).where(and(eq(savedViews.id, input.id), eq(savedViews.userId, ctx.user.id)));
      return { success: true };
    }),
});

// Only one default view per (user, page); clear the flag before setting a new one.
async function clearDefault(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, page: string) {
  await db
    .update(savedViews)
    .set({ isDefault: false })
    .where(and(eq(savedViews.userId, userId), eq(savedViews.page, page), eq(savedViews.isDefault, true)));
}
