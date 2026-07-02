/**
 * Content Assets Router — 4 endpoints ported from elite-writer-app
 * Covers: assets/generate, assets/batch-generate, assets/score, import-article
 * Also includes style-analyze from the content generation group
 */
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { marketingAssets, articles, styleProfiles, type InsertMarketingAsset } from "../../drizzle/schema";

// Asset type definitions from old app
const ASSET_TYPES = [
  "social_post", "email_subject", "email_body", "meta_description",
  "twitter_thread", "linkedin_post", "newsletter_intro",
  "pull_quote", "teaser", "headline_variation",
] as const;

export const assetsRouter = router({
  // Generate marketing assets from an article
  generate: protectedProcedure
    .input(z.object({
      articleTitle: z.string(),
      articleContent: z.string(),
      assetTypes: z.array(z.string()).default(["social_post", "email_subject", "meta_description"]),
      brandVoice: z.string().optional(),
      targetAudience: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an elite marketing content strategist. Generate high-quality marketing assets from article content. ${input.brandVoice ? `Brand voice: ${input.brandVoice}` : ""} Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Generate marketing assets for this article:

Title: ${input.articleTitle}
Content: ${input.articleContent.slice(0, 4000)}
${input.targetAudience ? `Target audience: ${input.targetAudience}` : ""}

Generate these asset types: ${input.assetTypes.join(", ")}

Return JSON:
{
  "assets": [
    {
      "type": "<asset_type>",
      "content": "<the generated content>",
      "characterCount": <number>,
      "platform": "<target platform if applicable>",
      "tips": "<optimization tip>"
    }
  ]
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content ?? "";
      let data;
      try { data = JSON.parse(text); } catch { data = { assets: [] }; }

      // Store assets
      const db = await getDb();
      const savedIds: number[] = [];

      if (db && data.assets) {
        for (const asset of data.assets) {
          try {
            const [res] = await db.insert(marketingAssets).values({
              userId: ctx.user.id,
              type: asset.type || "social_post",
              name: `${asset.type} for: ${input.articleTitle.slice(0, 100)}`,
              content: asset.content,
              topic: input.articleTitle,
              metadata: { platform: asset.platform, tips: asset.tips, characterCount: asset.characterCount },
            }).returning({ id: marketingAssets.id });
            savedIds.push(res.id);
          } catch { /* skip */ }
        }
      }

      return { success: true, assets: data.assets, savedIds, usage: result.usage };
    }),

  // Batch generate assets for multiple articles
  batchGenerate: protectedProcedure
    .input(z.object({
      articles: z.array(z.object({
        title: z.string(),
        content: z.string(),
      })),
      assetTypes: z.array(z.string()).default(["social_post", "meta_description"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const results: Array<{ articleTitle: string; assets: any[] }> = [];

      for (const article of input.articles.slice(0, 10)) {
        try {
          const result = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "You are a marketing content strategist. Generate marketing assets from article content. Return ONLY valid JSON.",
              },
              {
                role: "user",
                content: `Generate ${input.assetTypes.join(", ")} for:\n\nTitle: ${article.title}\nContent: ${article.content.slice(0, 2000)}\n\nReturn JSON:\n{\n  "assets": [{"type": "", "content": "", "platform": ""}]\n}`,
              },
            ],
            response_format: { type: "json_object" },
          });

          const text = result.choices[0]?.message?.content ?? "";
          let data;
          try { data = JSON.parse(text); } catch { data = { assets: [] }; }

          results.push({ articleTitle: article.title, assets: data.assets || [] });
        } catch (e) {
          results.push({ articleTitle: article.title, assets: [{ error: (e as Error).message }] });
        }
      }

      return { success: true, results, totalArticles: results.length };
    }),

  // Score marketing assets
  score: protectedProcedure
    .input(z.object({
      assetId: z.number().optional(),
      content: z.string(),
      type: z.string(),
      platform: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a marketing analytics expert. Score marketing content on effectiveness dimensions. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Score this ${input.type} asset${input.platform ? ` for ${input.platform}` : ""}:

"${input.content}"

Return JSON:
{
  "overall": <0-100>,
  "dimensions": {
    "clarity": {"score": <0-100>, "feedback": ""},
    "engagement": {"score": <0-100>, "feedback": ""},
    "persuasion": {"score": <0-100>, "feedback": ""},
    "brandAlignment": {"score": <0-100>, "feedback": ""},
    "platformFit": {"score": <0-100>, "feedback": ""}
  },
  "improvements": ["<suggestion>"],
  "optimizedVersion": "<improved version of the content>"
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content ?? "";
      let scoreData;
      try { scoreData = JSON.parse(text); } catch { scoreData = { overall: 0 }; }

      // Update stored asset if ID provided
      if (input.assetId) {
        const db = await getDb();
        if (db) {
          await db.update(marketingAssets)
            .set({ score: scoreData.overall, scoreData })
            .where(and(eq(marketingAssets.id, input.assetId), eq(marketingAssets.userId, ctx.user.id)));
        }
      }

      return { success: true, scoreData, usage: result.usage };
    }),

  // Import article from URL
  importArticle: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      addToKB: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Fetch and parse article
      let html: string;
      try {
        const resp = await fetch(input.url, {
          headers: { "User-Agent": "Mozilla/5.0 (EliteWriter/5.0)" },
          signal: AbortSignal.timeout(10000),
        });
        html = await resp.text();
      } catch (e) {
        throw new Error(`Failed to fetch URL: ${(e as Error).message}`);
      }

      // Extract title
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
      const ogTitleMatch = html.match(/property="og:title"\s+content="(.*?)"/is);
      const title = ogTitleMatch?.[1] || titleMatch?.[1] || "Imported Article";

      // Extract content (simple extraction)
      const descMatch = html.match(/property="og:description"\s+content="(.*?)"/is);
      const metaDescMatch = html.match(/name="description"\s+content="(.*?)"/is);

      // Strip HTML tags for content
      let content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 10000);

      // Use AI to clean and structure the content
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an article extraction engine. Clean and structure the raw content from a web page into a well-formatted article. Return the cleaned article content in markdown format.",
          },
          {
            role: "user",
            content: `Clean and structure this raw web page content into an article:\n\nTitle: ${title}\nURL: ${input.url}\n\nRaw content:\n${content.slice(0, 6000)}\n\nReturn the cleaned article in markdown format with the title as H1.`,
          },
        ],
      });

      const cleanedContent = result.choices[0]?.message?.content ?? content;

      // Store as article
      const db = await getDb();
      let articleId: number | undefined;

      if (db) {
        const [res] = await db.insert(articles).values({
          userId: ctx.user.id,
          title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
          content: cleanedContent,
          status: "draft",
          importedFrom: input.url,
          wordCount: cleanedContent.split(/\s+/).length,
        }).returning({ id: articles.id });
        articleId = res.id;
      }

      return {
        success: true,
        articleId,
        title,
        wordCount: cleanedContent.split(/\s+/).length,
        preview: cleanedContent.slice(0, 500),
      };
    }),

  // Analyze writing style
  analyzeStyle: protectedProcedure
    .input(z.object({
      content: z.string().min(100),
      profileName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a writing style analyst. Analyze the provided text and extract detailed style attributes. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Analyze the writing style of this text:\n\n${input.content.slice(0, 6000)}\n\nReturn JSON:\n{\n  "attributes": {\n    "tone": "<formal|casual|academic|journalistic|conversational>",\n    "voice": "<first-person|second-person|third-person>",\n    "complexity": "<simple|moderate|complex|expert>",\n    "sentenceLength": "<short|medium|long|varied>",\n    "vocabularyLevel": "<basic|intermediate|advanced|specialized>",\n    "emotionalTone": "<neutral|positive|negative|passionate|analytical>",\n    "targetAudience": "<general|professional|academic|technical>"\n  },\n  "strengths": ["<strength>"],\n  "weaknesses": ["<weakness>"],\n  "signature_phrases": ["<recurring phrase or pattern>"],\n  "styleGuide": "<2-3 paragraph guide on how to replicate this writing style>",\n  "comparableTo": ["<similar publications or authors>"]\n}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content ?? "";
      let data;
      try { data = JSON.parse(text); } catch { data = { attributes: {} }; }

      // Store style profile
      if (input.profileName) {
        const db = await getDb();
        if (db) {
          await db.insert(styleProfiles).values({
            userId: ctx.user.id,
            name: input.profileName,
            analysisData: data,
            attributes: data.attributes,
          });
        }
      }

      return { success: true, data, usage: result.usage };
    }),

  // List marketing assets
  list: protectedProcedure
    .input(z.object({
      type: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [eq(marketingAssets.userId, ctx.user.id)];
      if (input.type) conditions.push(eq(marketingAssets.type, input.type));

      return db.select().from(marketingAssets)
        .where(and(...conditions))
        .orderBy(desc(marketingAssets.createdAt))
        .limit(input.limit);
    }),

  // Delete asset
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(marketingAssets)
        .where(and(eq(marketingAssets.id, input.id), eq(marketingAssets.userId, ctx.user.id)));
      return { success: true };
    }),
});
