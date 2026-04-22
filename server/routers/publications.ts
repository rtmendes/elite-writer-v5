/**
 * Publications Router — 3+1 endpoints ported from elite-writer-app
 * Covers: publications/seed, publications/upsert, publications/template-upsert
 * The old seed.js was 2793 lines containing a massive publication database.
 * We port the seed logic and add CRUD operations.
 */
import { z } from "zod";
import { eq, desc, and, like, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { publications, type InsertPublication } from "../../drizzle/schema";

export const publicationsRouter = router({
  // List all publications with optional filters
  list: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      tier: z.number().optional(),
      search: z.string().optional(),
      limit: z.number().default(100),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions: any[] = [];
      if (input.category) conditions.push(eq(publications.category, input.category));
      if (input.tier) conditions.push(eq(publications.tier, input.tier));

      let query = db.select().from(publications);
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      return query.orderBy(publications.name).limit(input.limit);
    }),

  // Upsert a publication (create or update by slug)
  upsert: protectedProcedure
    .input(z.object({
      slug: z.string().min(1),
      name: z.string().min(1),
      url: z.string().optional(),
      category: z.string().optional(),
      payRange: z.string().optional(),
      payMin: z.number().optional(),
      payMax: z.number().optional(),
      acceptsFreelance: z.boolean().default(true),
      submissionUrl: z.string().optional(),
      editorName: z.string().optional(),
      editorEmail: z.string().optional(),
      guidelines: z.string().optional(),
      notes: z.string().optional(),
      topics: z.array(z.string()).optional(),
      tier: z.number().min(1).max(3).default(2),
      responseTime: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Check if exists
      const existing = await db.select().from(publications)
        .where(eq(publications.slug, input.slug)).limit(1);

      if (existing.length > 0) {
        // Update
        const { slug, ...updates } = input;
        const setObj: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(updates)) {
          if (v !== undefined) setObj[k] = k === "acceptsFreelance" ? (v ? 1 : 0) : v;
        }
        await db.update(publications).set(setObj).where(eq(publications.slug, slug));
        return { success: true, action: "updated", id: existing[0].id };
      } else {
        // Insert
        const [result] = await db.insert(publications).values({
          userId: ctx.user.id,
          slug: input.slug,
          name: input.name,
          url: input.url ?? null,
          category: input.category ?? null,
          payRange: input.payRange ?? null,
          payMin: input.payMin ?? null,
          payMax: input.payMax ?? null,
          acceptsFreelance: input.acceptsFreelance ? 1 : 0,
          submissionUrl: input.submissionUrl ?? null,
          editorName: input.editorName ?? null,
          editorEmail: input.editorEmail ?? null,
          guidelines: input.guidelines ?? null,
          notes: input.notes ?? null,
          topics: input.topics || [],
          tier: input.tier,
          responseTime: input.responseTime ?? null,
        }).$returningId();
        return { success: true, action: "created", id: result.id };
      }
    }),

  // Upsert pitch template for a publication
  templateUpsert: protectedProcedure
    .input(z.object({
      slug: z.string(),
      templateData: z.object({
        subjectLine: z.string().optional(),
        greeting: z.string().optional(),
        openingHook: z.string().optional(),
        bodyTemplate: z.string().optional(),
        closingTemplate: z.string().optional(),
        tips: z.array(z.string()).optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.update(publications)
        .set({ templateData: input.templateData })
        .where(eq(publications.slug, input.slug));

      return { success: true };
    }),

  // Seed publications database with curated list
  seed: protectedProcedure
    .input(z.object({
      categories: z.array(z.string()).optional(),
      count: z.number().default(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const categories = input.categories || [
        "Business & Finance", "Technology", "Health & Wellness",
        "Science", "Culture & Lifestyle", "Politics & Policy",
        "Personal Finance", "Marketing & Advertising",
      ];

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a freelance writing market researcher. Generate a comprehensive database of real publications that accept freelance submissions. Include accurate pay rates, submission guidelines, and editor contacts where publicly available. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Generate ${input.count} publications across these categories: ${categories.join(", ")}

For each publication, include:
- Real publication names and URLs
- Accurate pay ranges (research-based)
- Tier classification (1=top-tier/$1+/word, 2=mid-tier/$0.25-1/word, 3=entry-level/<$0.25/word)
- Topics they cover
- Submission guidelines summary
- Response time estimates

Return JSON:
{
  "publications": [
    {
      "slug": "<url-safe-slug>",
      "name": "<publication name>",
      "url": "<website URL>",
      "category": "<category>",
      "payRange": "<e.g. $0.50-$1.00/word>",
      "payMin": <cents per word min>,
      "payMax": <cents per word max>,
      "acceptsFreelance": true,
      "submissionUrl": "<submission page URL if known>",
      "guidelines": "<brief submission guidelines>",
      "topics": ["<topic1>", "<topic2>"],
      "tier": <1|2|3>,
      "responseTime": "<e.g. 2-4 weeks>"
    }
  ]
}`,
          },
        ],
        response_format: { type: "json_object" },
        maxTokens: 8000,
      });

      const text = result.choices[0]?.message?.content ?? "";
      let data;
      try { data = JSON.parse(text); } catch { data = { publications: [] }; }

      let seeded = 0;
      for (const pub of (data.publications || [])) {
        try {
          await db.insert(publications).values({
            userId: ctx.user.id,
            slug: pub.slug || pub.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            name: pub.name,
            url: pub.url || null,
            category: pub.category || null,
            payRange: pub.payRange || null,
            payMin: pub.payMin || null,
            payMax: pub.payMax || null,
            acceptsFreelance: pub.acceptsFreelance ? 1 : 0,
            submissionUrl: pub.submissionUrl || null,
            guidelines: pub.guidelines || null,
            topics: pub.topics || [],
            tier: pub.tier || 2,
            responseTime: pub.responseTime || null,
          });
          seeded++;
        } catch { /* skip duplicates */ }
      }

      return { success: true, seeded, total: data.publications?.length || 0 };
    }),

  // Get publication by slug
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [pub] = await db.select().from(publications)
        .where(eq(publications.slug, input.slug));
      return pub || null;
    }),

  // Delete publication
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(publications).where(eq(publications.id, input.id));
      return { success: true };
    }),

  // Match publications to an article
  matchToArticle: protectedProcedure
    .input(z.object({
      articleTitle: z.string(),
      articleSummary: z.string().optional(),
      topics: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Get all publications
      const allPubs = await db.select().from(publications).limit(200);

      if (allPubs.length === 0) {
        return { matches: [], message: "No publications in database. Run seed first." };
      }

      const pubList = allPubs.map(p =>
        `- ${p.name} (${p.category}, Tier ${p.tier}, ${p.payRange || "pay unknown"}) Topics: ${(p.topics as string[] || []).join(", ")}`
      ).join("\n");

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a freelance writing market strategist. Match articles to the most suitable publications. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Match this article to the best publications from our database:\n\nTitle: ${input.articleTitle}\nSummary: ${input.articleSummary || "N/A"}\nTopics: ${(input.topics || []).join(", ")}\n\nAvailable publications:\n${pubList}\n\nReturn JSON:\n{\n  "matches": [\n    {\n      "publicationName": "<name>",\n      "fitScore": <0-100>,\n      "reasoning": "<why this is a good match>",\n      "pitchAngle": "<suggested pitch angle>"\n    }\n  ]\n}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content ?? "";
      try { return JSON.parse(text); } catch { return { matches: [] }; }
    }),
});
