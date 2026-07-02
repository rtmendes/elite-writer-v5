/**
 * Product Creation Router — Auto-generate products from article content
 * 
 * Transforms articles into monetizable digital products:
 * - eBooks with chapter outlines and content expansion
 * - Online courses with module structures
 * - Lead magnets (checklists, templates, worksheets)
 * - Email sequences for nurture funnels
 * - Webinar scripts and slide outlines
 */
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { products, articles } from "../../drizzle/schema";

// Migrate existing installs: add articleId column if missing (idempotent).
let _migrated = false;
async function ensureArticleIdColumn() {
  if (_migrated) return;
  _migrated = true;
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(sql.raw(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "articleId" INT`));
  } catch { /* already present or unsupported syntax */ }
}

const PRODUCT_TYPES = [
  "ebook",
  "course",
  "lead_magnet",
  "email_sequence",
  "webinar",
  "toolkit",
  "template_pack",
  "worksheet",
  "checklist",
  "swipe_file",
] as const;

export const productCreationRouter = router({
  // ─── Analyze Article for Product Opportunities ────────────
  analyzeOpportunities: protectedProcedure
    .input(z.object({
      articleTitle: z.string(),
      articleContent: z.string(),
      brandId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a digital product strategist who transforms editorial content into revenue-generating products. Analyze the article and identify the highest-value product opportunities. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Analyze this article for product creation opportunities:

Title: ${input.articleTitle}
Content: ${input.articleContent.slice(0, 6000)}

Return JSON:
{
  "opportunities": [
    {
      "type": "<ebook|course|lead_magnet|email_sequence|webinar|toolkit|template_pack|worksheet|checklist|swipe_file>",
      "name": "<product name>",
      "description": "<2-3 sentence product description>",
      "targetAudience": "<who would buy this>",
      "suggestedPrice": "<price or 'free for lead gen'>",
      "estimatedRevenue": "<monthly revenue estimate>",
      "difficulty": "<easy|medium|hard>",
      "timeToCreate": "<estimated creation time>",
      "keySellingPoints": ["<selling point>"],
      "contentGaps": ["<what additional content is needed beyond the article>"],
      "conversionStrategy": "<how to convert article readers to buyers>"
    }
  ],
  "overallAssessment": "<assessment of monetization potential>",
  "recommendedFirst": "<which product to create first and why>"
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content || "";
      let data;
      try { data = JSON.parse(text); } catch { data = { opportunities: [] }; }

      return { success: true, data, usage: result.usage };
    }),

  // ─── Generate eBook from Article ──────────────────────────
  generateEbook: protectedProcedure
    .input(z.object({
      articleTitle: z.string(),
      articleContent: z.string(),
      productName: z.string().optional(),
      chapterCount: z.number().min(3).max(15).default(7),
      brandVoice: z.string().optional(),
      targetAudience: z.string().optional(),
      articleId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureArticleIdColumn();
      // Step 1: Generate eBook structure
      const structureResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are a bestselling non-fiction author and publishing strategist. Create compelling eBook structures that expand articles into comprehensive guides. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Create an eBook structure based on this article:

Article Title: ${input.articleTitle}
Article Content: ${input.articleContent.slice(0, 6000)}
${input.targetAudience ? `Target Audience: ${input.targetAudience}` : ""}
Number of Chapters: ${input.chapterCount}

Return JSON:
{
  "title": "<compelling eBook title>",
  "subtitle": "<subtitle>",
  "description": "<marketing description for the landing page>",
  "targetAudience": "<specific audience>",
  "chapters": [
    {
      "number": <chapter number>,
      "title": "<chapter title>",
      "summary": "<2-3 sentence chapter summary>",
      "keyTakeaways": ["<takeaway>"],
      "wordTarget": <estimated word count>,
      "basedOnArticle": <true if directly from article content, false if expanded>
    }
  ],
  "bonusMaterials": ["<bonus resource idea>"],
  "estimatedWordCount": <total estimated words>,
  "suggestedPrice": "<suggested price point>"
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const structText = structureResult.choices[0]?.message?.content || "";
      let structure;
      try { structure = JSON.parse(structText); } catch { structure = { title: input.articleTitle, chapters: [] }; }

      // Step 2: Generate Chapter 1 content (as preview)
      const ch1 = structure.chapters?.[0];
      let previewContent = "";
      
      if (ch1) {
        const contentResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a bestselling author. Write engaging, authoritative book content. ${input.brandVoice ? `Brand voice: ${input.brandVoice}` : ""} Write in a style that combines expertise with accessibility.`,
            },
            {
              role: "user",
              content: `Write Chapter 1 of this eBook:

eBook Title: ${structure.title || input.articleTitle}
Chapter 1: ${ch1.title}
Summary: ${ch1.summary}
Key Takeaways: ${(ch1.keyTakeaways || []).join(", ")}

Source Article (use as foundation):
${input.articleContent.slice(0, 4000)}

Write approximately ${ch1.wordTarget || 1500} words. Include:
- An engaging chapter opener
- Key insights with examples
- Actionable advice
- A bridge to Chapter 2

Format in markdown with appropriate subheadings.`,
            },
          ],
          maxTokens: 4096,
        });

        previewContent = contentResult.choices[0]?.message?.content || "";
      }

      // Save product to DB
      const db = await getDb();
      let productId: number | undefined;
      if (db) {
        const [res] = await db.insert(products).values({
          userId: ctx.user.id,
          brandId: null,
          articleId: input.articleId ?? null,
          name: structure.title || `${input.articleTitle} — eBook`,
          type: "ebook",
          price: structure.suggestedPrice || "19.99",
          description: structure.description || `eBook based on: ${input.articleTitle}`,
          status: "draft",
        }).returning({ id: products.id });
        productId = res.id;
      }

      return {
        success: true,
        productId,
        structure,
        previewChapter: previewContent,
        usage: {
          structureTokens: structureResult.usage?.total_tokens || 0,
          contentTokens: 0,
          totalTokens: (structureResult.usage?.total_tokens || 0),
        },
      };
    }),

  // ─── Generate Course from Article ─────────────────────────
  generateCourse: protectedProcedure
    .input(z.object({
      articleTitle: z.string(),
      articleContent: z.string(),
      moduleCount: z.number().min(3).max(12).default(6),
      courseType: z.enum(["video", "text", "hybrid"]).default("hybrid"),
      targetAudience: z.string().optional(),
      articleId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureArticleIdColumn();
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an instructional designer who creates premium online courses. Design courses that transform article insights into structured learning experiences. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Design an online course based on this article:

Article Title: ${input.articleTitle}
Article Content: ${input.articleContent.slice(0, 6000)}
Course Type: ${input.courseType}
Module Count: ${input.moduleCount}
${input.targetAudience ? `Target Audience: ${input.targetAudience}` : ""}

Return JSON:
{
  "title": "<course title>",
  "tagline": "<one-line tagline>",
  "description": "<marketing description>",
  "targetAudience": "<specific audience>",
  "learningOutcomes": ["<outcome>"],
  "modules": [
    {
      "number": <module number>,
      "title": "<module title>",
      "description": "<module description>",
      "lessons": [
        {
          "title": "<lesson title>",
          "type": "<video|text|exercise|quiz>",
          "duration": "<estimated duration>",
          "keyPoints": ["<point>"]
        }
      ],
      "assignment": "<practical assignment>",
      "deliverable": "<what student produces>"
    }
  ],
  "bonusResources": ["<bonus resource>"],
  "suggestedPrice": "<price>",
  "estimatedCompletionTime": "<total time>",
  "certificateTitle": "<certificate name>"
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content || "";
      let courseData;
      try { courseData = JSON.parse(text); } catch { courseData = { title: input.articleTitle, modules: [] }; }

      // Save to DB
      const db = await getDb();
      let productId: number | undefined;
      if (db) {
        const [res] = await db.insert(products).values({
          userId: ctx.user.id,
          brandId: null,
          articleId: input.articleId ?? null,
          name: courseData.title || `${input.articleTitle} — Course`,
          type: "course",
          price: courseData.suggestedPrice || "97.00",
          description: courseData.description || `Course based on: ${input.articleTitle}`,
          status: "draft",
        }).returning({ id: products.id });
        productId = res.id;
      }

      return { success: true, productId, course: courseData, usage: result.usage };
    }),

  // ─── Generate Lead Magnet ─────────────────────────────────
  generateLeadMagnet: protectedProcedure
    .input(z.object({
      articleTitle: z.string(),
      articleContent: z.string(),
      type: z.enum(["checklist", "template", "worksheet", "swipe_file", "toolkit", "cheat_sheet"]).default("checklist"),
      brandVoice: z.string().optional(),
      articleId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureArticleIdColumn();
      const typeDescriptions: Record<string, string> = {
        checklist: "a comprehensive, actionable checklist that readers can immediately use",
        template: "fill-in-the-blank templates that save readers hours of work",
        worksheet: "an interactive worksheet with exercises and reflection prompts",
        swipe_file: "a collection of proven examples, scripts, and copy they can adapt",
        toolkit: "a curated toolkit of resources, tools, and frameworks",
        cheat_sheet: "a one-page quick reference guide with the most critical information",
      };

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a conversion optimization expert who creates irresistible lead magnets. Create ${typeDescriptions[input.type]}. ${input.brandVoice ? `Brand voice: ${input.brandVoice}` : ""} Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Create a ${input.type} lead magnet based on this article:

Article Title: ${input.articleTitle}
Article Content: ${input.articleContent.slice(0, 6000)}

Return JSON:
{
  "title": "<compelling lead magnet title>",
  "subtitle": "<supporting subtitle>",
  "description": "<2-3 sentence marketing description>",
  "optInHeadline": "<headline for the opt-in form>",
  "optInSubtext": "<supporting text under the headline>",
  "content": {
    "sections": [
      {
        "heading": "<section heading>",
        "items": ["<item or step>"],
        "proTip": "<optional pro tip>"
      }
    ]
  },
  "ctaText": "<call-to-action button text>",
  "followUpEmailSubject": "<subject for the delivery email>",
  "followUpEmailBody": "<email body that delivers the lead magnet and sets up the relationship>"
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content || "";
      let leadMagnet;
      try { leadMagnet = JSON.parse(text); } catch { leadMagnet = { title: input.articleTitle, content: {} }; }

      // Save to DB
      const db = await getDb();
      let productId: number | undefined;
      if (db) {
        const [res] = await db.insert(products).values({
          userId: ctx.user.id,
          brandId: null,
          articleId: input.articleId ?? null,
          name: leadMagnet.title || `${input.articleTitle} — ${input.type}`,
          type: input.type,
          price: "0.00",
          description: leadMagnet.description || `Lead magnet: ${input.articleTitle}`,
          status: "draft",
        }).returning({ id: products.id });
        productId = res.id;
      }

      return { success: true, productId, leadMagnet, usage: result.usage };
    }),

  // ─── Generate Email Sequence ──────────────────────────────
  generateEmailSequence: protectedProcedure
    .input(z.object({
      articleTitle: z.string(),
      articleContent: z.string(),
      productName: z.string().optional(),
      emailCount: z.number().min(3).max(10).default(5),
      goal: z.enum(["nurture", "launch", "evergreen"]).default("nurture"),
    }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "You are an email marketing strategist who creates high-converting email sequences. Each email should build on the previous one, creating a natural progression toward the desired action. Return ONLY valid JSON.",
          },
          {
            role: "user",
            content: `Create a ${input.goal} email sequence based on this article:

Article Title: ${input.articleTitle}
Article Content: ${input.articleContent.slice(0, 4000)}
${input.productName ? `Product to Promote: ${input.productName}` : ""}
Number of Emails: ${input.emailCount}
Goal: ${input.goal}

Return JSON:
{
  "sequenceName": "<name>",
  "goal": "${input.goal}",
  "emails": [
    {
      "day": <day number>,
      "subject": "<subject line>",
      "previewText": "<preview text>",
      "body": "<full email body in markdown>",
      "cta": "<call to action>",
      "purpose": "<what this email accomplishes in the sequence>"
    }
  ],
  "expectedOpenRate": "<estimated open rate>",
  "expectedClickRate": "<estimated click rate>",
  "optimization_tips": ["<tip>"]
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text = result.choices[0]?.message?.content || "";
      let sequence;
      try { sequence = JSON.parse(text); } catch { sequence = { emails: [] }; }

      return { success: true, sequence, usage: result.usage };
    }),

  listByArticle: protectedProcedure
    .input(z.object({ articleId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select({ id: products.id, name: products.name, type: products.type, price: products.price, status: products.status })
        .from(products)
        .where(and(eq(products.userId, ctx.user.id), eq(products.articleId, input.articleId)))
        .orderBy(desc(products.updatedAt));
    }),
});
