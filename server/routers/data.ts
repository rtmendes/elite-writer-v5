import { z } from "zod";
import { eq, desc, and, isNotNull, max, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { syncArticleToPipeline } from "../lib/supabase-sync";
import {
  blocksApproval,
  HEALTH_CLAIMS_SAFETY_THRESHOLD,
  scoreHealthClaimsSafety,
} from "../../shared/health-claims-safety";
import {
  ideas, articles, pitches, researchNotes, generatedImages,
  brands, products, earnings, intelligenceItems, userSettings,
  researchItems, articleResearch, researchSeries, articleTag,
  type InsertIdea, type InsertArticle, type InsertPitch,
  type InsertResearchNote, type InsertBrand, type InsertProduct,
  type InsertEarning, type InsertIntelligenceItem,
} from "../../drizzle/schema";

// ─── Ideas ────────────────────────────────────────────────
const ideasRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(ideas).where(eq(ideas.userId, ctx.user.id)).orderBy(desc(ideas.updatedAt));
  }),
  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    angle: z.string().optional(),
    category: z.string().optional(),
    newsPeg: z.string().optional(),
    status: z.enum(["idea", "researching", "drafting", "scoring", "pitching", "published"]).optional(),
    score: z.number().optional(),
    brandId: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const vals: InsertIdea = { userId: ctx.user.id, title: input.title, angle: input.angle ?? null, category: input.category ?? null, newsPeg: input.newsPeg ?? null, status: input.status ?? "idea", score: input.score ?? null, brandId: input.brandId ?? null };
    const [result] = await db.insert(ideas).values(vals).returning({ id: ideas.id });
    return { id: result.id, ...input };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    angle: z.string().optional(),
    category: z.string().optional(),
    newsPeg: z.string().optional(),
    status: z.enum(["idea", "researching", "drafting", "scoring", "pitching", "published"]).optional(),
    score: z.number().optional(),
    brandId: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const { id, ...updates } = input;
    const setObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) { if (v !== undefined) setObj[k] = v; }
    if (Object.keys(setObj).length > 0) {
      await db.update(ideas).set(setObj).where(and(eq(ideas.id, id), eq(ideas.userId, ctx.user.id)));
    }
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(ideas).where(and(eq(ideas.id, input.id), eq(ideas.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Articles ─────────────────────────────────────────────
const articlesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(articles).where(eq(articles.userId, ctx.user.id)).orderBy(desc(articles.updatedAt));
  }),
  // Per-article cover thumbnails. Returns this user's generated images that are
  // linked to an article, newest-first; the client de-dupes to one cover per
  // article via buildCoverMap (skipping the "(base64)" placeholder rows that
  // aren't fetchable URLs). Avoids a schema change — covers already live in the
  // generated_images table via articleId.
  covers: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [] as { articleId: number | null; imageUrl: string | null }[];
    return db
      .select({ articleId: generatedImages.articleId, imageUrl: generatedImages.imageUrl })
      .from(generatedImages)
      .where(and(eq(generatedImages.userId, ctx.user.id), isNotNull(generatedImages.articleId)))
      .orderBy(desc(generatedImages.createdAt))
      .limit(200);
  }),
  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    content: z.string().optional(),
    template: z.string().optional(),
    brandVoice: z.string().optional(),
    wordCount: z.number().optional(),
    status: z.enum(["draft", "review", "scored", "pitched", "published"]).optional(),
    overallScore: z.number().optional(),
    scoreData: z.any().optional(),
    targetPublication: z.string().optional(),
    brandId: z.string().optional(),
    productId: z.string().optional(),
    sources: z.array(z.object({ title: z.string(), url: z.string().optional(), note: z.string().optional(), addedAt: z.string().optional() }).passthrough()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const vals: InsertArticle = {
      sources: input.sources ?? null,
      userId: ctx.user.id, title: input.title, content: input.content ?? null,
      template: input.template ?? null, brandVoice: input.brandVoice ?? null,
      wordCount: input.wordCount ?? null, status: input.status ?? "draft",
      overallScore: input.overallScore ?? null, scoreData: input.scoreData ?? null,
      targetPublication: input.targetPublication ?? null,
      brandId: input.brandId ?? null, productId: input.productId ?? null,
    };
    const [result] = await db.insert(articles).values(vals).returning({ id: articles.id });
    syncArticleToPipeline({
      articleId: result.id, title: input.title, status: input.status ?? "draft",
      brandId: input.brandId, score: input.overallScore, wordCount: input.wordCount,
      targetPublication: input.targetPublication,
    });
    return { id: result.id, ...input };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    content: z.string().optional(),
    template: z.string().optional(),
    brandVoice: z.string().optional(),
    wordCount: z.number().optional(),
    status: z.enum(["draft", "review", "scored", "pitched", "published"]).optional(),
    overallScore: z.number().optional(),
    scoreData: z.any().optional(),
    targetPublication: z.string().optional(),
    brandId: z.string().optional(),
    productId: z.string().optional(),
    seriesId: z.number().nullable().optional(),
    isMoneyPage: z.boolean().optional(),
    articleNumber: z.number().optional(),
    sources: z.array(z.object({ title: z.string(), url: z.string().optional(), note: z.string().optional(), addedAt: z.string().optional() }).passthrough()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const { id, isMoneyPage: isMoneyPageBool, ...updates } = input;

    if (input.status === "pitched" || input.status === "published") {
      const [row] = await db
        .select({ content: articles.content, bodyMarkdown: articles.bodyMarkdown, bodyHtml: articles.bodyHtml, scoreData: articles.scoreData })
        .from(articles)
        .where(and(eq(articles.id, id), eq(articles.userId, ctx.user.id)))
        .limit(1);
      if (row) {
        const stored = (row.scoreData as { healthClaimsSafety?: number } | null)?.healthClaimsSafety;
        const healthScore =
          typeof stored === "number"
            ? stored
            : scoreHealthClaimsSafety(row.bodyMarkdown ?? row.content ?? "", row.bodyHtml).score;
        if (blocksApproval(healthScore, HEALTH_CLAIMS_SAFETY_THRESHOLD)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Health-Claims Safety score ${healthScore} is below threshold ${HEALTH_CLAIMS_SAFETY_THRESHOLD}. Fix flagged health claims before approval.`,
          });
        }
      }
    }

    const setObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) { if (v !== undefined) setObj[k] = v; }
    if (isMoneyPageBool !== undefined) setObj.isMoneyPage = isMoneyPageBool ? 1 : 0;
    if (Object.keys(setObj).length > 0) {
      await db.update(articles).set(setObj).where(and(eq(articles.id, id), eq(articles.userId, ctx.user.id)));
    }
    if (input.status || input.title || input.overallScore) {
      syncArticleToPipeline({
        articleId: id, title: input.title ?? "", status: input.status ?? "draft",
        brandId: input.brandId, score: input.overallScore, wordCount: input.wordCount,
        targetPublication: input.targetPublication,
      });
    }
    return { success: true };
  }),
  // Pitch → article → payment funnel: one row per pitch with article state and
  // earnings matched by publication source name. Joined in JS — the links are
  // soft (articleTitle string, earnings.source) by schema design.
  funnel: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const [allPitches, allArticles, allEarnings] = await Promise.all([
      db.select().from(pitches).where(eq(pitches.userId, ctx.user.id)),
      db.select().from(articles).where(eq(articles.userId, ctx.user.id)),
      db.select().from(earnings).where(eq(earnings.userId, ctx.user.id)),
    ]);
    const articleByTitle = new Map(allArticles.map((a) => [a.title.toLowerCase(), a]));
    const earningsBySource = new Map<string, number>();
    for (const e of allEarnings) {
      if (e.type !== "content") continue;
      const k = e.source.toLowerCase();
      earningsBySource.set(k, (earningsBySource.get(k) ?? 0) + Number(e.amount));
    }
    return allPitches.map((p) => {
      const article = p.articleTitle ? articleByTitle.get(p.articleTitle.toLowerCase()) : undefined;
      const paid = p.publicationName ? (earningsBySource.get(p.publicationName.toLowerCase()) ?? 0) : 0;
      return {
        pitchId: p.id,
        subject: p.subject,
        publicationName: p.publicationName,
        pitchStatus: p.status,
        sentAt: p.sentAt,
        articleTitle: p.articleTitle,
        articleStatus: article?.status ?? null,
        articleScore: article?.overallScore ?? null,
        earningsFromPublication: paid,
      };
    });
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(articles).where(and(eq(articles.id, input.id), eq(articles.userId, ctx.user.id)));
    return { success: true };
  }),

  // P3a: Record attribution when a research item's content is inserted into an article.
  // Content is inserted client-side via insertRichContent (preserves Plate HTML format).
  // This procedure only records the article_research link and appends to sources JSON.
  insertResearch: protectedProcedure
    .input(z.object({
      articleId: z.number(),
      itemId: z.number(),
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [article] = await db.select().from(articles)
        .where(and(eq(articles.id, input.articleId), eq(articles.userId, ctx.user.id)));
      if (!article) throw new Error("Article not found");
      const [item] = await db.select().from(researchItems)
        .where(and(eq(researchItems.id, input.itemId), eq(researchItems.userId, ctx.user.id)));
      if (!item) throw new Error("Research item not found");
      // Record attribution link
      await db.insert(articleResearch).values({
        userId: ctx.user.id,
        articleId: input.articleId,
        itemId: input.itemId,
        note: input.note ?? null,
      });
      // Append to sources JSON provenance registry
      const existingSources = (article.sources as any[] | null) ?? [];
      const newSource = {
        title: item.title,
        url: item.url ?? undefined,
        note: input.note ?? undefined,
        addedAt: new Date().toISOString(),
      };
      await db.update(articles)
        .set({ sources: [...existingSources, newSource] })
        .where(eq(articles.id, input.articleId));
      return { success: true };
    }),

  // P3a: Create a new article seeded with a research item's content.
  // Auto-assigns article_number (per-user MAX+1).
  createFromResearch: protectedProcedure
    .input(z.object({
      itemId: z.number(),
      title: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [item] = await db.select().from(researchItems)
        .where(and(eq(researchItems.id, input.itemId), eq(researchItems.userId, ctx.user.id)));
      if (!item) throw new Error("Research item not found");
      // auto article_number
      const [maxRow] = await db.select({ m: max(articles.articleNumber) })
        .from(articles).where(eq(articles.userId, ctx.user.id));
      const nextNum = ((maxRow?.m ?? 0) as number) + 1;
      const citationLine = [
        item.authors && (item.authors as string[]).length > 0 ? (item.authors as string[]).join(", ") : null,
        item.year ? `(${item.year})` : null,
        item.publication ?? null,
        item.url ? `[Source](${item.url})` : null,
      ].filter(Boolean).join(" · ");
      const seedContent = [
        `## ${item.title}`,
        item.abstract ? `\n\n> ${item.abstract.slice(0, 600)}` : "",
        item.notes ? `\n\n${item.notes}` : "",
        `\n\n*${citationLine}*`,
      ].join("");
      const articleTitle = input.title ?? item.title;
      const vals: InsertArticle = {
        userId: ctx.user.id,
        title: articleTitle,
        content: seedContent,
        articleNumber: nextNum,
        sources: [{ title: item.title, url: item.url ?? undefined, addedAt: new Date().toISOString() }],
      };
      const [result] = await db.insert(articles).values(vals).returning({ id: articles.id });
      await db.insert(articleResearch).values({
        userId: ctx.user.id,
        articleId: result.id,
        itemId: input.itemId,
        note: null,
      });
      syncArticleToPipeline({ articleId: result.id, title: articleTitle, status: "draft" });
      return { id: result.id, articleNumber: nextNum };
    }),

  // P3a: Set/clear series on an article
  setSeries: protectedProcedure
    .input(z.object({ id: z.number(), seriesId: z.number().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(articles).set({ seriesId: input.seriesId })
        .where(and(eq(articles.id, input.id), eq(articles.userId, ctx.user.id)));
      return { success: true };
    }),

  // P3a: Toggle money page flag
  setMoneyPage: protectedProcedure
    .input(z.object({ id: z.number(), value: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(articles).set({ isMoneyPage: input.value ? 1 : 0 })
        .where(and(eq(articles.id, input.id), eq(articles.userId, ctx.user.id)));
      return { success: true };
    }),
});

// ─── Pitches ──────────────────────────────────────────────
const pitchesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(pitches).where(eq(pitches.userId, ctx.user.id)).orderBy(desc(pitches.createdAt));
  }),
  create: protectedProcedure.input(z.object({
    publicationId: z.string(),
    publicationName: z.string().optional(),
    editorName: z.string().optional(),
    editorEmail: z.string().optional(),
    subject: z.string().min(1),
    body: z.string().optional(),
    articleTitle: z.string().optional(),
    status: z.enum(["draft", "sent", "accepted", "rejected", "no_response"]).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const vals: InsertPitch = {
      userId: ctx.user.id, publicationId: input.publicationId,
      publicationName: input.publicationName ?? null, editorName: input.editorName ?? null,
      editorEmail: input.editorEmail ?? null, subject: input.subject,
      body: input.body ?? null, articleTitle: input.articleTitle ?? null,
      status: input.status ?? "draft",
    };
    const [result] = await db.insert(pitches).values(vals).returning({ id: pitches.id });
    return { id: result.id, ...input };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    subject: z.string().optional(),
    body: z.string().optional(),
    status: z.enum(["draft", "sent", "accepted", "rejected", "no_response"]).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const { id, ...updates } = input;
    const setObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) { if (v !== undefined) setObj[k] = v; }
    if (input.status === "sent") (setObj as any).sentAt = new Date();
    if (Object.keys(setObj).length > 0) {
      await db.update(pitches).set(setObj).where(and(eq(pitches.id, id), eq(pitches.userId, ctx.user.id)));
    }
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(pitches).where(and(eq(pitches.id, input.id), eq(pitches.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Research Notes ───────────────────────────────────────
const researchRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(researchNotes).where(eq(researchNotes.userId, ctx.user.id)).orderBy(desc(researchNotes.updatedAt));
  }),
  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    content: z.string().optional(),
    sources: z.any().optional(),
    dataPoints: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const vals: InsertResearchNote = {
      userId: ctx.user.id, title: input.title, content: input.content ?? null,
      sources: input.sources ?? null, dataPoints: input.dataPoints ?? null,
    };
    const [result] = await db.insert(researchNotes).values(vals).returning({ id: researchNotes.id });
    return { id: result.id, ...input };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    content: z.string().optional(),
    sources: z.any().optional(),
    dataPoints: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const { id, ...updates } = input;
    const setObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) { if (v !== undefined) setObj[k] = v; }
    if (Object.keys(setObj).length > 0) {
      await db.update(researchNotes).set(setObj).where(and(eq(researchNotes.id, id), eq(researchNotes.userId, ctx.user.id)));
    }
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(researchNotes).where(and(eq(researchNotes.id, input.id), eq(researchNotes.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Brands ───────────────────────────────────────────────
const brandsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(brands).where(eq(brands.userId, ctx.user.id)).orderBy(desc(brands.updatedAt));
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    niche: z.string().optional(),
    website: z.string().optional(),
    color: z.string().optional(),
    alignedPublications: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const vals: InsertBrand = {
      userId: ctx.user.id, name: input.name, description: input.description ?? null,
      niche: input.niche ?? null, website: input.website ?? null,
      color: input.color ?? null, alignedPublications: input.alignedPublications ?? null,
    };
    const [result] = await db.insert(brands).values(vals).returning({ id: brands.id });
    return { id: result.id, ...input };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    description: z.string().optional(),
    niche: z.string().optional(),
    website: z.string().optional(),
    color: z.string().optional(),
    alignedPublications: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const { id, ...updates } = input;
    const setObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) { if (v !== undefined) setObj[k] = v; }
    if (Object.keys(setObj).length > 0) {
      await db.update(brands).set(setObj).where(and(eq(brands.id, id), eq(brands.userId, ctx.user.id)));
    }
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(brands).where(and(eq(brands.id, input.id), eq(brands.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Products ─────────────────────────────────────────────
const productsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(products).where(eq(products.userId, ctx.user.id)).orderBy(desc(products.updatedAt));
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    brandId: z.number().optional(),
    type: z.string().optional(),
    price: z.string().optional(),
    description: z.string().optional(),
    funnelUrl: z.string().optional(),
    status: z.enum(["draft", "active", "paused"]).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const vals: InsertProduct = {
      userId: ctx.user.id, name: input.name, brandId: input.brandId ?? null,
      type: input.type ?? null, price: input.price ?? null,
      description: input.description ?? null, funnelUrl: input.funnelUrl ?? null,
      status: input.status ?? "draft",
    };
    const [result] = await db.insert(products).values(vals).returning({ id: products.id });
    return { id: result.id, ...input };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(products).where(and(eq(products.id, input.id), eq(products.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Earnings ─────────────────────────────────────────────
const earningsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(earnings).where(eq(earnings.userId, ctx.user.id)).orderBy(desc(earnings.date));
  }),
  create: protectedProcedure.input(z.object({
    type: z.enum(["content", "product"]),
    source: z.string().min(1),
    amount: z.string(),
    description: z.string().optional(),
    brandId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const vals: InsertEarning = {
      userId: ctx.user.id, type: input.type, source: input.source,
      amount: input.amount, description: input.description ?? null,
      brandId: input.brandId ?? null,
    };
    const [result] = await db.insert(earnings).values(vals).returning({ id: earnings.id });
    return { id: result.id, ...input };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(earnings).where(and(eq(earnings.id, input.id), eq(earnings.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Intelligence Items ───────────────────────────────────
const intelligenceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(intelligenceItems).where(eq(intelligenceItems.userId, ctx.user.id)).orderBy(desc(intelligenceItems.createdAt));
  }),
  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    summary: z.string().optional(),
    source: z.string().optional(),
    url: z.string().optional(),
    category: z.string().optional(),
    relevanceScore: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    const vals: InsertIntelligenceItem = {
      userId: ctx.user.id, title: input.title, summary: input.summary ?? null,
      source: input.source ?? null, url: input.url ?? null,
      category: input.category ?? null, relevanceScore: input.relevanceScore ?? null,
    };
    const [result] = await db.insert(intelligenceItems).values(vals).returning({ id: intelligenceItems.id });
    return { id: result.id, ...input };
  }),
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(intelligenceItems).where(and(eq(intelligenceItems.id, input.id), eq(intelligenceItems.userId, ctx.user.id)));
    return { success: true };
  }),
  save: protectedProcedure.input(z.object({ id: z.number(), saved: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.update(intelligenceItems).set({ saved: input.saved ? 1 : 0 }).where(and(eq(intelligenceItems.id, input.id), eq(intelligenceItems.userId, ctx.user.id)));
    return { success: true };
  }),
});


// ─── User Settings (DB-persisted) ─────────────────────────
const settingsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);
    return rows.length > 0 ? rows[0].settings : null;
  }),
  upsert: protectedProcedure.input(z.object({
    settings: z.record(z.string(), z.any()),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    // Try update first, then insert
    const existing = await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);
    if (existing.length > 0) {
      // Merge with existing settings to avoid overwriting
      const merged = { ...(existing[0].settings || {}), ...input.settings };
      await db.update(userSettings).set({ settings: merged }).where(eq(userSettings.userId, ctx.user.id));
    } else {
      await db.insert(userSettings).values({ userId: ctx.user.id, settings: input.settings as any });
    }
    return { success: true };
  }),
});

// ─── Series (P3a) ─────────────────────────────────────────
const seriesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(researchSeries)
      .where(eq(researchSeries.userId, ctx.user.id))
      .orderBy(desc(researchSeries.createdAt));
  }),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(300), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [res] = await db.insert(researchSeries).values({
        userId: ctx.user.id, name: input.name, description: input.description ?? null,
      }).returning({ id: researchSeries.id });
      return { id: res.id };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.update(articles).set({ seriesId: null })
        .where(and(eq(articles.seriesId, input.id), eq(articles.userId, ctx.user.id)));
      await db.delete(researchSeries)
        .where(and(eq(researchSeries.id, input.id), eq(researchSeries.userId, ctx.user.id)));
      return { success: true };
    }),
});

// ─── Article Tags (P3a) ───────────────────────────────────
const articleTagRouter = router({
  list: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(articleTag)
        .where(and(eq(articleTag.articleId, input.articleId), eq(articleTag.userId, ctx.user.id)));
    }),
  tag: protectedProcedure
    .input(z.object({ articleId: z.number(), tag: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.insert(articleTag).values({
        userId: ctx.user.id, articleId: input.articleId, tag: input.tag.toLowerCase().trim(),
      });
      return { success: true };
    }),
  untag: protectedProcedure
    .input(z.object({ articleId: z.number(), tag: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(articleTag)
        .where(and(
          eq(articleTag.articleId, input.articleId),
          eq(articleTag.tag, input.tag),
          eq(articleTag.userId, ctx.user.id),
        ));
      return { success: true };
    }),
});

// ─── Combined Data Router ─────────────────────────────────
export const dataRouter = router({
  ideas: ideasRouter,
  articles: articlesRouter,
  pitches: pitchesRouter,
  research: researchRouter,
  brands: brandsRouter,
  products: productsRouter,
  earnings: earningsRouter,
  intelligence: intelligenceRouter,
  settings: settingsRouter,
  series: seriesRouter,
  articleTags: articleTagRouter,
});
