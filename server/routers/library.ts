/**
 * Content & Image Library Router — GistStack My Content + Asset Library
 * 
 * Features:
 * 1. Content Library — auto-save social posts, article excerpts, templates
 * 2. Image Library — save generated images with tags, presets, brand refs
 * 3. Image Presets — save/load custom image prompt configurations
 * 4. Search and filter across both libraries
 * 5. Usage tracking and starring
 */
import { z } from "zod";
import { eq, desc, and, like, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  contentLibrary, imageLibrary, imagePresets,
  type InsertContentLibraryItem, type InsertImageLibraryItem, type InsertImagePreset,
} from "../../drizzle/schema";

// ─── Content Library ──────────────────────────────────────
const contentRouter = router({
  list: protectedProcedure
    .input(z.object({
      type: z.string().optional(),
      platform: z.string().optional(),
      search: z.string().optional(),
      starred: z.boolean().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: any[] = [eq(contentLibrary.userId, ctx.user.id)];
      if (input.type) conditions.push(eq(contentLibrary.type, input.type as any));
      if (input.platform) conditions.push(eq(contentLibrary.platform, input.platform));
      if (input.starred) conditions.push(eq(contentLibrary.starred, 1));
      if (input.search) conditions.push(like(contentLibrary.content, `%${input.search}%`));
      return db.select().from(contentLibrary)
        .where(and(...conditions))
        .orderBy(desc(contentLibrary.createdAt))
        .limit(input.limit);
    }),

  save: protectedProcedure
    .input(z.object({
      type: z.enum(["social_post", "article_excerpt", "quote", "idea", "template"]),
      platform: z.string().optional(),
      title: z.string().optional(),
      content: z.string().min(1),
      tags: z.array(z.string()).optional(),
      brandId: z.number().optional(),
      sourcePostId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [inserted] = await db.insert(contentLibrary).values({
        userId: ctx.user.id,
        type: input.type,
        platform: input.platform || null,
        title: input.title || null,
        content: input.content,
        tags: input.tags || [],
        brandId: input.brandId || null,
        sourcePostId: input.sourcePostId || null,
      });
      return { id: inserted.insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      content: z.string().optional(),
      title: z.string().optional(),
      tags: z.array(z.string()).optional(),
      starred: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, starred, ...updates } = input;
      await db.update(contentLibrary)
        .set({ ...updates, starred: starred !== undefined ? (starred ? 1 : 0) : undefined })
        .where(and(eq(contentLibrary.id, id), eq(contentLibrary.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(contentLibrary).where(
        and(eq(contentLibrary.id, input.id), eq(contentLibrary.userId, ctx.user.id))
      );
      return { success: true };
    }),

  toggleStar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [item] = await db.select().from(contentLibrary)
        .where(and(eq(contentLibrary.id, input.id), eq(contentLibrary.userId, ctx.user.id)));
      if (!item) throw new Error("Not found");
      await db.update(contentLibrary)
        .set({ starred: item.starred ? 0 : 1 })
        .where(eq(contentLibrary.id, input.id));
      return { starred: !item.starred };
    }),
});

// ─── Image Library ────────────────────────────────────────
const imagesRouter = router({
  list: protectedProcedure
    .input(z.object({
      style: z.string().optional(),
      search: z.string().optional(),
      brandId: z.number().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions: any[] = [eq(imageLibrary.userId, ctx.user.id)];
      if (input.style) conditions.push(eq(imageLibrary.style, input.style));
      if (input.brandId) conditions.push(eq(imageLibrary.brandId, input.brandId));
      if (input.search) conditions.push(like(imageLibrary.name, `%${input.search}%`));
      return db.select().from(imageLibrary)
        .where(and(...conditions))
        .orderBy(desc(imageLibrary.createdAt))
        .limit(input.limit);
    }),

  save: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      imageUrl: z.string().min(1),
      thumbnailUrl: z.string().optional(),
      prompt: z.string().optional(),
      model: z.string().optional(),
      style: z.string().optional(),
      tags: z.array(z.string()).optional(),
      brandId: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      presetName: z.string().optional(),
      metadata: z.object({
        reference_images: z.array(z.string()).optional(),
        character_consistency: z.boolean().optional(),
        brand_colors: z.array(z.string()).optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [inserted] = await db.insert(imageLibrary).values({
        userId: ctx.user.id,
        name: input.name,
        imageUrl: input.imageUrl,
        thumbnailUrl: input.thumbnailUrl || null,
        prompt: input.prompt || null,
        model: input.model || null,
        style: input.style || null,
        tags: input.tags || [],
        brandId: input.brandId || null,
        width: input.width || null,
        height: input.height || null,
        presetName: input.presetName || null,
        metadata: input.metadata || {},
      });
      return { id: inserted.insertId };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(imageLibrary).where(
        and(eq(imageLibrary.id, input.id), eq(imageLibrary.userId, ctx.user.id))
      );
      return { success: true };
    }),
});

// ─── Image Presets ────────────────────────────────────────
const presetsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(imagePresets)
      .where(eq(imagePresets.userId, ctx.user.id))
      .orderBy(desc(imagePresets.updatedAt));
  }),

  save: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      promptPrefix: z.string().optional(),
      promptSuffix: z.string().optional(),
      model: z.string().optional(),
      style: z.string().optional(),
      referenceImages: z.array(z.string()).optional(),
      characterConsistency: z.boolean().optional(),
      brandId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [inserted] = await db.insert(imagePresets).values({
        userId: ctx.user.id,
        name: input.name,
        promptPrefix: input.promptPrefix || null,
        promptSuffix: input.promptSuffix || null,
        model: input.model || null,
        style: input.style || null,
        referenceImages: input.referenceImages || [],
        characterConsistency: input.characterConsistency ? 1 : 0,
        brandId: input.brandId || null,
      });
      return { id: inserted.insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      promptPrefix: z.string().optional(),
      promptSuffix: z.string().optional(),
      model: z.string().optional(),
      style: z.string().optional(),
      referenceImages: z.array(z.string()).optional(),
      characterConsistency: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, characterConsistency, ...updates } = input;
      await db.update(imagePresets)
        .set({ ...updates, characterConsistency: characterConsistency !== undefined ? (characterConsistency ? 1 : 0) : undefined })
        .where(and(eq(imagePresets.id, id), eq(imagePresets.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(imagePresets).where(
        and(eq(imagePresets.id, input.id), eq(imagePresets.userId, ctx.user.id))
      );
      return { success: true };
    }),
});

// ─── Combined Library Router ──────────────────────────────
export const libraryRouter = router({
  content: contentRouter,
  images: imagesRouter,
  presets: presetsRouter,
});
