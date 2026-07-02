/**
 * Knowledge Base Router — 7 endpoints ported from elite-writer-app
 * Covers: kb/add-note, kb/embed, kb/export, kb/extract, kb/import, kb/search, kb/seed
 */
import { z } from "zod";
import { eq, desc, and, like, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { kbItems, type InsertKbItem } from "../../drizzle/schema";

// ─── OpenAI Embedding Helper ──────────────────────────────

async function getEmbedding(text: string): Promise<number[] | null> {
  if (!ENV.openaiApiKey) return null;

  try {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ENV.openaiApiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      const data = await resp.json() as any;
      return data.data?.[0]?.embedding || null;
    }
  } catch { /* skip */ }
  return null;
}

// Simple cosine similarity
function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// ─── Supabase KB Search (legacy pgvector) ────────────────

async function supabaseKBSearch(query: string, userId: string, opts: { limit?: number; threshold?: number } = {}) {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey || !ENV.openaiApiKey) return null;

  const queryEmbedding = await getEmbedding(query);
  if (!queryEmbedding) return null;

  try {
    const resp = await fetch(`${ENV.supabaseUrl}/rest/v1/rpc/search_kb_embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ENV.supabaseServiceKey,
        Authorization: `Bearer ${ENV.supabaseServiceKey}`,
      },
      body: JSON.stringify({
        query_embedding: queryEmbedding,
        match_threshold: opts.threshold || 0.65,
        match_count: opts.limit || 10,
        p_user_id: userId,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (resp.ok) {
      const data = await resp.json();
      return data;
    }
  } catch { /* skip */ }
  return null;
}

export const kbRouter = router({
  // Add a new KB note/item
  addNote: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string(),
      category: z.string().optional(),
      subcategory: z.string().optional(),
      tags: z.array(z.string()).optional(),
      useCases: z.array(z.string()).optional(),
      source: z.string().optional(),
      sourceUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const tokenCount = Math.ceil(input.content.length / 4);

      const vals: InsertKbItem = {
        userId: ctx.user.id,
        title: input.title,
        content: input.content,
        category: input.category ?? null,
        subcategory: input.subcategory ?? null,
        tags: input.tags || [],
        useCases: input.useCases || [],
        source: input.source ?? null,
        sourceUrl: input.sourceUrl ?? null,
        tokenCount,
      };

      const [result] = await db.insert(kbItems).values(vals).returning({ id: kbItems.id });
      return { success: true, id: result.id, tokenCount };
    }),

  // Generate embeddings for a KB item (stored in metadata JSON)
  embed: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [item] = await db.select().from(kbItems)
        .where(and(eq(kbItems.id, input.itemId), eq(kbItems.userId, ctx.user.id)));

      if (!item) throw new Error("Item not found");

      const text = `${item.title}\n\n${item.content || ""}`.slice(0, 8000);
      const embedding = await getEmbedding(text);

      if (!embedding) throw new Error("Embedding generation failed. Check OPENAI_API_KEY.");

      await db.update(kbItems).set({
        metadata: { ...(item.metadata as any || {}), embedding },
      }).where(eq(kbItems.id, input.itemId));

      return { success: true, dimensions: embedding.length };
    }),

  // Export KB items
  export: protectedProcedure
    .input(z.object({
      format: z.enum(["json", "csv", "markdown"]).default("json"),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { data: "", count: 0 };

      const items = await db.select().from(kbItems)
        .where(eq(kbItems.userId, ctx.user.id))
        .orderBy(desc(kbItems.createdAt));

      if (input.format === "json") {
        return { data: JSON.stringify(items, null, 2), count: items.length, format: "json" };
      }

      if (input.format === "csv") {
        const header = "id,title,category,tags,tokenCount,createdAt\n";
        const rows = items.map(i =>
          `${i.id},"${(i.title || "").replace(/"/g, '""')}","${i.category || ""}","${JSON.stringify(i.tags || [])}",${i.tokenCount || 0},${i.createdAt}`
        ).join("\n");
        return { data: header + rows, count: items.length, format: "csv" };
      }

      // Markdown
      const md = items.map(i =>
        `## ${i.title}\n\n**Category:** ${i.category || "Uncategorized"}\n**Tags:** ${(i.tags as string[] || []).join(", ")}\n\n${i.content || ""}\n\n---\n`
      ).join("\n");
      return { data: md, count: items.length, format: "markdown" };
    }),

  // Extract key information from text and add to KB
  extract: protectedProcedure
    .input(z.object({
      content: z.string().min(10),
      source: z.string().optional(),
      sourceUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a knowledge extraction engine. Extract structured knowledge items from the provided content. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Extract knowledge items from this content:\n\n${input.content.slice(0, 8000)}\n\nReturn JSON:\n{\n  "items": [\n    {\n      "title": "<concise title>",\n      "content": "<key information and insights>",\n      "category": "<business|technology|finance|health|marketing|writing|other>",\n      "tags": ["<tag>"],\n      "useCases": ["<when this knowledge is useful>"]\n    }\n  ]\n}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content ?? "";
      let extracted;
      try { extracted = JSON.parse(text); } catch { extracted = { items: [] }; }

      const db = await getDb();
      const saved: number[] = [];

      if (db && extracted.items) {
        for (const item of extracted.items) {
          try {
            const [res] = await db.insert(kbItems).values({
              userId: ctx.user.id,
              title: item.title || "Extracted item",
              content: item.content,
              category: item.category,
              tags: item.tags || [],
              useCases: item.useCases || [],
              source: input.source,
              sourceUrl: input.sourceUrl,
              tokenCount: Math.ceil((item.content || "").length / 4),
            }).returning({ id: kbItems.id });
            saved.push(res.id);
          } catch { /* skip */ }
        }
      }

      return { success: true, extracted: extracted.items?.length || 0, savedIds: saved };
    }),

  // Import KB items from JSON
  import: protectedProcedure
    .input(z.object({
      items: z.array(z.object({
        title: z.string(),
        content: z.string(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        useCases: z.array(z.string()).optional(),
        source: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      let imported = 0;
      for (const item of input.items) {
        try {
          await db.insert(kbItems).values({
            userId: ctx.user.id,
            title: item.title,
            content: item.content,
            category: item.category ?? null,
            tags: item.tags || [],
            useCases: item.useCases || [],
            source: item.source ?? null,
            tokenCount: Math.ceil((item.content || "").length / 4),
          });
          imported++;
        } catch { /* skip */ }
      }

      return { success: true, imported, total: input.items.length };
    }),

  // Semantic search across KB
  search: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      useCases: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      limit: z.number().default(10),
      threshold: z.number().default(0.65),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Method 1: Try local embedding search
      const queryEmbedding = await getEmbedding(input.query);
      const allItems = await db.select().from(kbItems)
        .where(eq(kbItems.userId, ctx.user.id));

      if (queryEmbedding) {
        const scored = allItems
          .filter(item => (item.metadata as any)?.embedding)
          .map(item => ({
            ...item,
            similarity: cosineSim(queryEmbedding, (item.metadata as any).embedding),
          }))
          .filter(item => item.similarity >= input.threshold)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, input.limit);

        if (scored.length > 0) {
          return {
            results: scored.map(s => ({
              id: s.id,
              title: s.title,
              content: s.content?.slice(0, 500),
              category: s.category,
              tags: s.tags,
              similarity: Math.round(s.similarity * 100) / 100,
            })),
            method: "embedding",
            count: scored.length,
          };
        }
      }

      // Method 2: Keyword search fallback
      const queryWords = input.query.toLowerCase().split(/\s+/);
      const keywordResults = allItems
        .map(item => {
          const text = `${item.title} ${item.content || ""} ${(item.tags as string[] || []).join(" ")}`.toLowerCase();
          const matches = queryWords.filter(w => text.includes(w)).length;
          return { ...item, score: matches / queryWords.length };
        })
        .filter(item => item.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit);

      return {
        results: keywordResults.map(r => ({
          id: r.id,
          title: r.title,
          content: r.content?.slice(0, 500),
          category: r.category,
          tags: r.tags,
          similarity: r.score,
        })),
        method: "keyword",
        count: keywordResults.length,
      };
    }),

  // Seed KB with starter content
  seed: protectedProcedure
    .input(z.object({
      domain: z.enum(["writing", "marketing", "business", "technology", "all"]).default("all"),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a knowledge management system. Generate high-quality seed knowledge items for a professional writer's knowledge base. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Generate 10 essential knowledge items for a freelance writer's knowledge base focused on: ${input.domain}\n\nReturn JSON:\n{\n  "items": [\n    {\n      "title": "<concise title>",\n      "content": "<detailed, actionable knowledge (200-400 words)>",\n      "category": "<category>",\n      "tags": ["<tag>"],\n      "useCases": ["<when to use this knowledge>"]\n    }\n  ]\n}`,
          },
        ],
        response_format: { type: "json_object" },
        maxTokens: 8000,
      });

      const text = result.choices[0]?.message?.content ?? "";
      let data;
      try { data = JSON.parse(text); } catch { data = { items: [] }; }

      const db = await getDb();
      let seeded = 0;

      if (db && data.items) {
        for (const item of data.items) {
          try {
            await db.insert(kbItems).values({
              userId: ctx.user.id,
              title: item.title || "Seed item",
              content: item.content,
              category: item.category,
              tags: item.tags || [],
              useCases: item.useCases || [],
              source: "ai-seed",
              tokenCount: Math.ceil((item.content || "").length / 4),
            });
            seeded++;
          } catch { /* skip */ }
        }
      }

      return { success: true, seeded, items: data.items };
    }),

  // List all KB items
  // Index-first recall (ported from elite-writer-app kb-index): a compact map
  // of the knowledge base — title + hook + token size — cheap enough to put in
  // any prompt. Agents read the index, then fetch exactly ONE item via get().
  index: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select({
        id: kbItems.id,
        title: kbItems.title,
        category: kbItems.category,
        tokenCount: kbItems.tokenCount,
        hook: sql<string>`LEFT(COALESCE(${kbItems.content}, ''), 140)`,
        contentLength: sql<number>`CHAR_LENGTH(COALESCE(${kbItems.content}, ''))`,
      })
      .from(kbItems)
      .where(eq(kbItems.userId, ctx.user.id))
      .orderBy(desc(kbItems.createdAt))
      .limit(300);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      hook: (r.hook || "").replace(/\s+/g, " "),
      approxTokens: r.tokenCount ?? Math.ceil((r.contentLength ?? 0) / 4),
    }));
  }),

  // Fetch exactly one item's full content — the only thing that enters a prompt.
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(kbItems)
        .where(and(eq(kbItems.id, input.id), eq(kbItems.userId, ctx.user.id)))
        .limit(1);
      return rows[0] ?? null;
    }),

  list: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(kbItems.userId, ctx.user.id)];
      if (input.category) conditions.push(eq(kbItems.category, input.category));

      return db.select().from(kbItems)
        .where(and(...conditions))
        .orderBy(desc(kbItems.createdAt))
        .limit(input.limit);
    }),

  // Delete KB item
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(kbItems).where(and(eq(kbItems.id, input.id), eq(kbItems.userId, ctx.user.id)));
      return { success: true };
    }),

  // Update KB item
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      useCases: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { id, ...updates } = input;
      const setObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) { if (v !== undefined) setObj[k] = v; }

      if (Object.keys(setObj).length > 0) {
        await db.update(kbItems).set(setObj)
          .where(and(eq(kbItems.id, id), eq(kbItems.userId, ctx.user.id)));
      }
      return { success: true };
    }),
});
