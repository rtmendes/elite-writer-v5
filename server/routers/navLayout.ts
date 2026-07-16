/**
 * Nav Layout router — per-user customizable left navigation.
 * Stores the operator's section order, per-section item order/membership (by
 * path), and hidden item paths. The client merges this over the code-defined
 * canonical nav so newly-shipped items always appear. One row per user.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { userNavLayout } from "../../drizzle/schema";

const layoutConfig = z.object({
  sections: z.array(z.object({
    title: z.string().min(1).max(80),
    items: z.array(z.string().max(120)),
  })),
  hidden: z.array(z.string().max(120)),
});

export const navLayoutRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db
      .select({ config: userNavLayout.config })
      .from(userNavLayout)
      .where(eq(userNavLayout.userId, ctx.user.id))
      .limit(1);
    return row?.config ?? null;
  }),

  save: protectedProcedure
    .input(layoutConfig)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .insert(userNavLayout)
        .values({ userId: ctx.user.id, config: input })
        .onConflictDoUpdate({ target: userNavLayout.userId, set: { config: input } });
      return { success: true };
    }),

  // Reset to the code default (delete the override row).
  reset: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(userNavLayout).where(eq(userNavLayout.userId, ctx.user.id));
    return { success: true };
  }),
});
