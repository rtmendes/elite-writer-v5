/**
 * Brand Context Router — GistStack-inspired Brand Lens System
 * 
 * Features:
 * 1. Brand context CRUD — voice, tone, audience, pillars, competitors
 * 2. Auto-research brand from website URL
 * 3. Image preferences with character/brand consistency
 * 4. Language preferences for multi-language content
 * 5. Content pillar management
 * 6. Brand lens application across social + article creation
 */
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { brandContexts, type InsertBrandContext } from "../../drizzle/schema";

export const brandContextRouter = router({
  // ─── List Brand Contexts ──────────────────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(brandContexts)
      .where(eq(brandContexts.userId, ctx.user.id))
      .orderBy(desc(brandContexts.updatedAt));
  }),

  // ─── Get Single Brand Context ─────────────────────────────
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const [bc] = await db.select().from(brandContexts)
        .where(and(eq(brandContexts.id, input.id), eq(brandContexts.userId, ctx.user.id)));
      return bc || null;
    }),

  // ─── Create Brand Context ────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      brandId: z.number().optional(),
      website: z.string().optional(),
      voice: z.string().optional(),
      tone: z.string().optional(),
      audience: z.string().optional(),
      values: z.array(z.string()).optional(),
      keywords: z.array(z.string()).optional(),
      competitors: z.array(z.string()).optional(),
      contentPillars: z.array(z.string()).optional(),
      avoidTopics: z.array(z.string()).optional(),
      sampleContent: z.array(z.string()).optional(),
      languagePreferences: z.object({
        primary: z.string(),
        additional: z.array(z.string()).optional(),
        formality: z.string().optional(),
        jargon_level: z.string().optional(),
      }).optional(),
      imagePreferences: z.object({
        style: z.string().optional(),
        colors: z.array(z.string()).optional(),
        reference_images: z.array(z.string()).optional(),
        character_refs: z.array(z.string()).optional(),
        custom_prompt_prefix: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [inserted] = await db.insert(brandContexts).values({
        userId: ctx.user.id,
        brandId: input.brandId || null,
        name: input.name,
        website: input.website || null,
        voice: input.voice || null,
        tone: input.tone || null,
        audience: input.audience || null,
        values: input.values || [],
        keywords: input.keywords || [],
        competitors: input.competitors || [],
        contentPillars: input.contentPillars || [],
        avoidTopics: input.avoidTopics || [],
        sampleContent: input.sampleContent || [],
        languagePreferences: input.languagePreferences || { primary: "en" },
        imagePreferences: input.imagePreferences || {},
      });

      return { id: inserted.insertId };
    }),

  // ─── Update Brand Context ────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      website: z.string().optional(),
      voice: z.string().optional(),
      tone: z.string().optional(),
      audience: z.string().optional(),
      values: z.array(z.string()).optional(),
      keywords: z.array(z.string()).optional(),
      competitors: z.array(z.string()).optional(),
      contentPillars: z.array(z.string()).optional(),
      avoidTopics: z.array(z.string()).optional(),
      sampleContent: z.array(z.string()).optional(),
      languagePreferences: z.any().optional(),
      imagePreferences: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { id, ...updates } = input;
      await db.update(brandContexts).set(updates)
        .where(and(eq(brandContexts.id, id), eq(brandContexts.userId, ctx.user.id)));
      return { success: true };
    }),

  // ─── Delete Brand Context ────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(brandContexts)
        .where(and(eq(brandContexts.id, input.id), eq(brandContexts.userId, ctx.user.id)));
      return { success: true };
    }),

  // ─── Auto-Research Brand from Website ────────────────────
  autoResearch: protectedProcedure
    .input(z.object({
      id: z.number(),
      websiteUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Scrape website using Brave Search for context
      let siteContext = "";
      if (ENV.braveApiKey) {
        try {
          const domain = new URL(input.websiteUrl).hostname;
          const resp = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=site:${domain}&count=10`,
            {
              headers: { "X-Subscription-Token": ENV.braveApiKey, Accept: "application/json" },
              signal: AbortSignal.timeout(10000),
            }
          );
          if (resp.ok) {
            const data = await resp.json() as any;
            siteContext = (data.web?.results || [])
              .map((r: any) => `${r.title}: ${r.description}`)
              .join("\n");
          }
        } catch { /* continue without */ }
      }

      // Also try direct scrape of homepage
      try {
        const resp = await fetch(input.websiteUrl, {
          headers: { "User-Agent": "EliteWriter/1.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (resp.ok) {
          const html = await resp.text();
          // Extract meta description and title
          const titleMatch = html.match(/<title>(.*?)<\/title>/i);
          const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
          const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i);
          siteContext += `\n\nHomepage title: ${titleMatch?.[1] || ""}\nMeta description: ${metaMatch?.[1] || ogDescMatch?.[1] || ""}`;
        }
      } catch { /* continue */ }

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a brand strategist. Analyze a website and extract a comprehensive brand profile.

Return JSON:
{
  "voice": "description of brand voice (1-2 sentences)",
  "tone": "tone characteristics",
  "audience": "target audience description",
  "values": ["value1", "value2", ...],
  "keywords": ["keyword1", "keyword2", ...] (industry keywords),
  "competitors": ["competitor1", "competitor2", ...],
  "contentPillars": ["pillar1", "pillar2", ...] (3-5 core content themes),
  "avoidTopics": ["topic1", ...] (topics that would be off-brand),
  "languagePreferences": {
    "primary": "en",
    "formality": "semi-formal|formal|casual",
    "jargon_level": "low|medium|high"
  }
}`,
          },
          {
            role: "user",
            content: `Analyze this brand:\nWebsite: ${input.websiteUrl}\n\nContext:\n${siteContext}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const text = result.choices[0]?.message?.content || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Failed to parse brand analysis");
      }

      // Update the brand context with researched data
      const db = await getDb();
      if (db) {
        await db.update(brandContexts).set({
          voice: parsed.voice || null,
          tone: parsed.tone || null,
          audience: parsed.audience || null,
          values: parsed.values || [],
          keywords: parsed.keywords || [],
          competitors: parsed.competitors || [],
          contentPillars: parsed.contentPillars || [],
          avoidTopics: parsed.avoidTopics || [],
          languagePreferences: parsed.languagePreferences || { primary: "en" },
          autoResearched: 1,
          website: input.websiteUrl,
        }).where(and(eq(brandContexts.id, input.id), eq(brandContexts.userId, ctx.user.id)));
      }

      return parsed;
    }),
});
