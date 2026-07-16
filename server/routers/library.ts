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
import { createHash } from "crypto";
import { eq, desc, and, like, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { uploadDataUrl } from "../_core/storage";
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
      }).returning({ id: contentLibrary.id });
      return { id: inserted.id };
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
      }).returning({ id: imageLibrary.id });
      return { id: inserted.id };
    }),

  // Edit metadata in place (Admin UX media library): name / altText / tags.
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      altText: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...rest } = input;
      const set: Record<string, unknown> = {};
      if (rest.name !== undefined) set.name = rest.name;
      if (rest.altText !== undefined) set.altText = rest.altText;
      if (rest.tags !== undefined) set.tags = rest.tags;
      if (Object.keys(set).length > 0) {
        await db.update(imageLibrary).set(set)
          .where(and(eq(imageLibrary.id, id), eq(imageLibrary.userId, ctx.user.id)));
      }
      return { success: true };
    }),

  // Drag-drop upload → R2 → library, with content-hash dedup per user.
  upload: protectedProcedure
    .input(z.object({
      dataUrl: z.string().min(1),   // data:image/...;base64,....
      name: z.string().min(1),
      altText: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const b64 = input.dataUrl.split(",")[1] ?? "";
      const hash = createHash("sha256").update(b64).digest("hex");
      // Dedup: same bytes already in this user's library → return it.
      const existing = await db.select({ id: imageLibrary.id, imageUrl: imageLibrary.imageUrl })
        .from(imageLibrary)
        .where(and(eq(imageLibrary.userId, ctx.user.id), eq(imageLibrary.contentHash, hash)))
        .limit(1);
      if (existing[0]) return { id: existing[0].id, imageUrl: existing[0].imageUrl, deduped: true };

      const url = await uploadDataUrl(input.dataUrl, "library");
      if (!url) throw new Error("Object storage not configured (R2 env vars missing)");
      const [inserted] = await db.insert(imageLibrary).values({
        userId: ctx.user.id,
        name: input.name,
        imageUrl: url,
        altText: input.altText || null,
        tags: input.tags || [],
        contentHash: hash,
      }).returning({ id: imageLibrary.id });
      return { id: inserted.id, imageUrl: url, deduped: false };
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
      }).returning({ id: imagePresets.id });
      return { id: inserted.id };
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
