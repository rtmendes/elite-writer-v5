/**
 * Research Library Router (P1)
 * Items, highlights, folders, projects, article backlinks.
 * Full text stored in R2; metadata in DB.
 */
import { z } from "zod";
import { eq, desc, and, like, or, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  researchItems, researchHighlights, researchFolders, researchProjects, articleResearch,
} from "../../drizzle/schema";
import { uploadBuffer, downloadText } from "../_core/storage";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function fetchPageText(url: string): Promise<string> {
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "EliteWriter-ResearchBot/1.0" },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  // Strip tags — good enough for body storage; not a full readability parse
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 200_000); // cap at 200k chars
}

// ─── items ───────────────────────────────────────────────────────────────────

const itemsRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      folderId: z.number().optional(),
      projectId: z.number().optional(),
      status: z.enum(["inbox", "saved", "archived"]).optional(),
      contentType: z.string().optional(),
      tag: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };
      const conds: any[] = [eq(researchItems.userId, ctx.user.id)];
      if (input.folderId != null) conds.push(eq(researchItems.folderId, input.folderId));
      if (input.projectId != null) conds.push(eq(researchItems.projectId, input.projectId));
      if (input.status) conds.push(eq(researchItems.status, input.status));
      if (input.contentType) conds.push(eq(researchItems.contentType, input.contentType as any));
      if (input.search) {
        const q = `%${input.search}%`;
        conds.push(or(like(researchItems.title, q), like(researchItems.abstract, q), like(researchItems.notes, q)));
      }
      const where = and(...conds);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(researchItems).where(where);
      const items = await db.select().from(researchItems)
        .where(where)
        .orderBy(desc(researchItems.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      return { items, total: Number(count) };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number(), includeBody: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const [item] = await db.select().from(researchItems)
        .where(and(eq(researchItems.id, input.id), eq(researchItems.userId, ctx.user.id)));
      if (!item) return null;
      let body: string | null = null;
      if (input.includeBody && item.r2Key) {
        body = await downloadText(item.r2Key).catch(() => null);
      }
      return { ...item, body };
    }),

  save: protectedProcedure
    .input(z.object({
      url: z.string().url().optional(),
      title: z.string().min(1).max(700),
      contentType: z.enum(["webpage", "pdf", "video", "academic", "manual"]).default("webpage"),
      abstract: z.string().optional(),
      authors: z.array(z.string()).optional(),
      year: z.number().optional(),
      doi: z.string().optional(),
      publication: z.string().optional(),
      tags: z.array(z.string()).optional(),
      refKey: z.string().optional(),
      source: z.string().optional(),
      notes: z.string().optional(),
      folderId: z.number().optional(),
      projectId: z.number().optional(),
      status: z.enum(["inbox", "saved", "archived"]).default("inbox"),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { url, metadata, ...rest } = input;
      const [res] = await db.insert(researchItems).values({
        userId: ctx.user.id,
        url: url ?? null,
        metadata: metadata ?? null,
        ...rest,
      });
      const newId = res.insertId;

      // Async R2 body fetch — don't block the response
      if (url && (input.contentType === "webpage" || input.contentType === "academic")) {
        fetchPageText(url)
          .then(async text => {
            const key = `research/${ctx.user.id}/${newId}/body.txt`;
            const k = await uploadBuffer(Buffer.from(text, "utf8"), key, "text/plain");
            if (k) await db.update(researchItems).set({ r2Key: k }).where(eq(researchItems.id, newId));
          })
          .catch(() => {}); // silent — R2 is best-effort for P1
      }

      return { id: newId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      abstract: z.string().optional(),
      tags: z.array(z.string()).optional(),
      refKey: z.string().optional(),
      notes: z.string().optional(),
      folderId: z.number().nullable().optional(),
      projectId: z.number().nullable().optional(),
      status: z.enum(["inbox", "saved", "archived"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...updates } = input;
      await db.update(researchItems)
        .set(updates as any)
        .where(and(eq(researchItems.id, id), eq(researchItems.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(researchItems)
        .where(and(eq(researchItems.id, input.id), eq(researchItems.userId, ctx.user.id)));
      return { success: true };
    }),

  bulkImport: protectedProcedure
    .input(z.object({
      urls: z.array(z.string().url()).min(1).max(50),
      folderId: z.number().optional(),
      projectId: z.number().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const results: { url: string; id?: number; error?: string }[] = [];

      for (const url of input.urls) {
        try {
          // Extract title from URL path as placeholder
          const urlTitle = decodeURIComponent(
            new URL(url).pathname.split("/").filter(Boolean).pop() ?? url
          ).replace(/[-_]/g, " ").slice(0, 200) || url;

          const [res] = await db.insert(researchItems).values({
            userId: ctx.user.id,
            url,
            title: urlTitle,
            contentType: "webpage",
            folderId: input.folderId ?? null,
            projectId: input.projectId ?? null,
            tags: input.tags ?? [],
            source: "bulk_import",
            status: "inbox",
          });
          const newId = res.insertId;
          results.push({ url, id: newId });

          // Async body fetch
          fetchPageText(url)
            .then(async text => {
              const key = `research/${ctx.user.id}/${newId}/body.txt`;
              const k = await uploadBuffer(Buffer.from(text, "utf8"), key, "text/plain");
              if (k) await db.update(researchItems).set({ r2Key: k }).where(eq(researchItems.id, newId));
            })
            .catch(() => {});
        } catch (e: any) {
          results.push({ url, error: e.message });
        }
      }

      const ok = results.filter(r => r.id).length;
      return { imported: ok, failed: results.length - ok, results };
    }),
});

// ─── highlights ──────────────────────────────────────────────────────────────

const highlightsRouter = router({
  list: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(researchHighlights)
        .where(and(eq(researchHighlights.itemId, input.itemId), eq(researchHighlights.userId, ctx.user.id)))
        .orderBy(desc(researchHighlights.createdAt));
    }),

  add: protectedProcedure
    .input(z.object({
      itemId: z.number(),
      text: z.string().min(1),
      note: z.string().optional(),
      color: z.string().optional(),
      position: z.record(z.string(), z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [res] = await db.insert(researchHighlights).values({
        userId: ctx.user.id,
        itemId: input.itemId,
        text: input.text,
        note: input.note ?? null,
        color: input.color ?? "yellow",
        position: input.position ?? null,
      });
      return { id: res.insertId };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(researchHighlights)
        .where(and(eq(researchHighlights.id, input.id), eq(researchHighlights.userId, ctx.user.id)));
      return { success: true };
    }),
});

// ─── folders ─────────────────────────────────────────────────────────────────

const foldersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(researchFolders)
      .where(eq(researchFolders.userId, ctx.user.id))
      .orderBy(researchFolders.name);
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(300),
      parentId: z.number().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [res] = await db.insert(researchFolders).values({
        userId: ctx.user.id,
        name: input.name,
        parentId: input.parentId ?? null,
        color: input.color ?? null,
      });
      return { id: res.insertId };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Unset folderId on child items before deleting
      await db.update(researchItems)
        .set({ folderId: null })
        .where(and(eq(researchItems.folderId, input.id), eq(researchItems.userId, ctx.user.id)));
      await db.delete(researchFolders)
        .where(and(eq(researchFolders.id, input.id), eq(researchFolders.userId, ctx.user.id)));
      return { success: true };
    }),
});

// ─── projects ────────────────────────────────────────────────────────────────

const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(researchProjects)
      .where(eq(researchProjects.userId, ctx.user.id))
      .orderBy(desc(researchProjects.updatedAt));
  }),

  // P2: per-project item counts grouped by status for portfolio board
  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const projects = await db.select().from(researchProjects)
      .where(eq(researchProjects.userId, ctx.user.id))
      .orderBy(desc(researchProjects.updatedAt));
    const counts = await db.select({
      projectId: researchItems.projectId,
      status: researchItems.status,
      count: sql<number>`count(*)`,
    })
      .from(researchItems)
      .where(eq(researchItems.userId, ctx.user.id))
      .groupBy(researchItems.projectId, researchItems.status);
    return projects.map(p => {
      const pCounts = counts.filter(c => c.projectId === p.id);
      const total = pCounts.reduce((s, c) => s + Number(c.count), 0);
      const byStatus: Record<string, number> = {};
      pCounts.forEach(c => { byStatus[c.status] = Number(c.count); });
      return { ...p, total, byStatus };
    });
  }),

  // P2: bulk-create projects from a newline-separated list of names
  bulkCreate: protectedProcedure
    .input(z.object({ names: z.array(z.string().min(1).max(300)) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const rows = input.names.map(name => ({ userId: ctx.user.id, name }));
      for (const row of rows) {
        await db.insert(researchProjects).values(row);
      }
      return { created: rows.length };
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(300),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [res] = await db.insert(researchProjects).values({
        userId: ctx.user.id,
        name: input.name,
        description: input.description ?? null,
      });
      return { id: res.insertId };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(researchItems)
        .set({ projectId: null })
        .where(and(eq(researchItems.projectId, input.id), eq(researchItems.userId, ctx.user.id)));
      await db.delete(researchProjects)
        .where(and(eq(researchProjects.id, input.id), eq(researchProjects.userId, ctx.user.id)));
      return { success: true };
    }),
});

// ─── article backlinks ───────────────────────────────────────────────────────

const attachRouter = router({
  listForArticle: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(articleResearch)
        .where(and(eq(articleResearch.articleId, input.articleId), eq(articleResearch.userId, ctx.user.id)))
        .orderBy(desc(articleResearch.createdAt));
    }),

  attach: protectedProcedure
    .input(z.object({ articleId: z.number(), itemId: z.number(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [res] = await db.insert(articleResearch).values({
        userId: ctx.user.id,
        articleId: input.articleId,
        itemId: input.itemId,
        note: input.note ?? null,
      });
      return { id: res.insertId };
    }),

  detach: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(articleResearch)
        .where(and(eq(articleResearch.id, input.id), eq(articleResearch.userId, ctx.user.id)));
      return { success: true };
    }),
});

// ─── combined ────────────────────────────────────────────────────────────────

export const researchLibraryRouter = router({
  items: itemsRouter,
  highlights: highlightsRouter,
  folders: foldersRouter,
  projects: projectsRouter,
  attach: attachRouter,
});
