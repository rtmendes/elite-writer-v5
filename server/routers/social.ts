/**
 * Social Content Engine Router — GistStack-inspired social media content creation
 * 
 * Features:
 * 1. AI-powered social post generation for X, LinkedIn, FB, Reddit, Threads
 * 2. Threaded post creation (X threads, Meta Threads)
 * 3. Brand context/lens integration for on-brand content
 * 4. Context control — choose specific "big ideas" from sources
 * 5. Multi-language content generation
 * 6. Webhook publishing for auto-distribution
 * 7. Post scoring (engagement potential, hook strength, platform fit)
 */
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { socialPosts, brandContexts, type InsertSocialPost } from "../../drizzle/schema";

// ─── Platform-specific constraints & prompts ──────────────
const PLATFORM_CONFIG: Record<string, { maxChars: number; features: string; bestPractices: string }> = {
  twitter: {
    maxChars: 280,
    features: "Hashtags, mentions, short URLs. Thread support (up to 25 tweets).",
    bestPractices: "Hook in first line. Use line breaks. 1-3 hashtags max. End with CTA or question. Threads: each tweet stands alone but builds narrative.",
  },
  linkedin: {
    maxChars: 3000,
    features: "Rich text, hashtags, mentions, document attachments, polls.",
    bestPractices: "Hook in first 2 lines (before 'see more'). Use short paragraphs. Storytelling format. 3-5 hashtags. End with engagement question.",
  },
  facebook: {
    maxChars: 63206,
    features: "Rich text, links, photos, videos, polls, events.",
    bestPractices: "Conversational tone. Ask questions. Use emojis sparingly. First sentence is the hook. Keep under 500 chars for best engagement.",
  },
  reddit: {
    maxChars: 40000,
    features: "Markdown, subreddit targeting, rich text editor.",
    bestPractices: "Match subreddit tone. Provide genuine value. No self-promotion. Use markdown formatting. Cite sources. Be authentic.",
  },
  threads: {
    maxChars: 500,
    features: "Text, images, links. Thread support (multiple connected posts).",
    bestPractices: "Casual, conversational tone. Short punchy statements. Thread format for longer ideas. Minimal hashtags.",
  },
  instagram: {
    maxChars: 2200,
    features: "Caption for posts/reels. Hashtags, mentions, emojis.",
    bestPractices: "Front-load the hook. Use line breaks. 20-30 relevant hashtags (in comment or caption). Include CTA.",
  },
};

export const socialRouter = router({
  // ─── Generate Social Post from Source ─────────────────────
  generate: protectedProcedure
    .input(z.object({
      platform: z.enum(["twitter", "linkedin", "facebook", "reddit", "threads", "instagram"]),
      postType: z.enum(["single", "thread", "carousel", "poll"]).default("single"),
      sourceContent: z.string().min(1, "Provide source content or topic"),
      sourceUrl: z.string().optional(),
      sourceTitle: z.string().optional(),
      contextIdeas: z.array(z.string()).optional(), // specific "big ideas" to focus on
      tone: z.string().optional(),
      language: z.string().default("en"),
      brandContextId: z.number().optional(),
      customInstructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const config = PLATFORM_CONFIG[input.platform];
      if (!config) throw new Error(`Unsupported platform: ${input.platform}`);

      // Load brand context if specified
      let brandLens = "";
      if (input.brandContextId) {
        const db = await getDb();
        if (db) {
          const [bc] = await db.select().from(brandContexts).where(
            and(eq(brandContexts.id, input.brandContextId), eq(brandContexts.userId, ctx.user.id))
          );
          if (bc) {
            brandLens = `\n\nBRAND CONTEXT (apply as lens to all content):
- Voice: ${bc.voice || "professional"}
- Tone: ${bc.tone || "authoritative"}
- Audience: ${bc.audience || "general"}
- Content Pillars: ${(bc.contentPillars || []).join(", ")}
- Keywords to include: ${(bc.keywords || []).join(", ")}
- Topics to AVOID: ${(bc.avoidTopics || []).join(", ")}`;
          }
        }
      }

      const contextControl = input.contextIdeas?.length
        ? `\n\nFOCUS on these specific ideas from the source:\n${input.contextIdeas.map((idea, i) => `${i + 1}. ${idea}`).join("\n")}`
        : "";

      const threadInstructions = input.postType === "thread"
        ? `\n\nCREATE A THREAD (multiple connected posts). Each post must:
- Stand alone as valuable content
- Build on the previous post
- Stay within ${config.maxChars} characters per post
- First post is the hook, last post is the CTA
Return as JSON array of strings, one per thread post.`
        : "";

      const languageInst = input.language !== "en"
        ? `\n\nWRITE IN: ${input.language} (maintain natural fluency, don't just translate)`
        : "";

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert social media content creator specializing in ${input.platform}.

PLATFORM: ${input.platform}
MAX CHARACTERS: ${config.maxChars}
FEATURES: ${config.features}
BEST PRACTICES: ${config.bestPractices}
${brandLens}${contextControl}${threadInstructions}${languageInst}

${input.customInstructions ? `CUSTOM INSTRUCTIONS: ${input.customInstructions}` : ""}

Generate a high-performing ${input.platform} ${input.postType === "thread" ? "thread" : "post"}.
${input.tone ? `Tone: ${input.tone}` : ""}

Return JSON:
{
  "content": "the main post text",
  "threadParts": ["part1", "part2", ...] (only for threads, null otherwise),
  "hashtags": ["tag1", "tag2"],
  "hookAnalysis": "why this hook works",
  "score": {
    "engagement_potential": 1-100,
    "hook_strength": 1-100,
    "cta_clarity": 1-100,
    "brand_alignment": 1-100,
    "platform_fit": 1-100
  },
  "imagePromptSuggestion": "suggested image prompt if visual would help"
}`,
          },
          {
            role: "user",
            content: `Create a ${input.platform} ${input.postType} from this source:\n\n${input.sourceTitle ? `Title: ${input.sourceTitle}\n` : ""}${input.sourceContent}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      });

      const text = result.choices[0]?.message?.content || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { content: text, hashtags: [], score: {} };
      }

      // Save to DB
      const db = await getDb();
      if (db) {
        const insertData: InsertSocialPost = {
          userId: ctx.user.id,
          brandId: input.brandContextId || null,
          platform: input.platform,
          postType: input.postType,
          content: parsed.content || text,
          threadParts: parsed.threadParts || null,
          hashtags: parsed.hashtags || [],
          imagePrompt: parsed.imagePromptSuggestion || null,
          sourceUrl: input.sourceUrl || null,
          sourceTitle: input.sourceTitle || null,
          tone: input.tone || null,
          language: input.language,
          score: parsed.score ? Math.round(
            ((parsed.score.engagement_potential || 0) +
              (parsed.score.hook_strength || 0) +
              (parsed.score.platform_fit || 0)) / 3
          ) : null,
          scoreData: parsed.score || null,
          status: "draft",
          metadata: {
            context_ideas: input.contextIdeas || [],
            brand_lens: brandLens ? "applied" : "none",
            source_insights: [],
          },
        };

        const [inserted] = await db.insert(socialPosts).values(insertData);
        return { id: inserted.insertId, ...parsed };
      }

      return parsed;
    }),

  // ─── List Social Posts ────────────────────────────────────
  list: protectedProcedure
    .input(z.object({
      platform: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions: any[] = [eq(socialPosts.userId, ctx.user.id)];
      if (input.platform) conditions.push(eq(socialPosts.platform, input.platform as any));
      if (input.status) conditions.push(eq(socialPosts.status, input.status as any));

      return db.select().from(socialPosts)
        .where(and(...conditions))
        .orderBy(desc(socialPosts.createdAt))
        .limit(input.limit);
    }),

  // ─── Update Social Post ───────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      content: z.string().optional(),
      threadParts: z.array(z.string()).optional(),
      hashtags: z.array(z.string()).optional(),
      status: z.enum(["draft", "approved", "scheduled", "published"]).optional(),
      scheduledAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { id, ...updates } = input;
      await db.update(socialPosts)
        .set({ ...updates, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined })
        .where(and(eq(socialPosts.id, id), eq(socialPosts.userId, ctx.user.id)));

      return { success: true };
    }),

  // ─── Delete Social Post ───────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(socialPosts).where(and(eq(socialPosts.id, input.id), eq(socialPosts.userId, ctx.user.id)));
      return { success: true };
    }),

  // ─── Publish via Webhook ──────────────────────────────────
  publish: protectedProcedure
    .input(z.object({
      postId: z.number(),
      webhookUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [post] = await db.select().from(socialPosts)
        .where(and(eq(socialPosts.id, input.postId), eq(socialPosts.userId, ctx.user.id)));

      if (!post) throw new Error("Post not found");

      // Send to webhook
      const payload = {
        platform: post.platform,
        content: post.content,
        threadParts: post.threadParts,
        hashtags: post.hashtags,
        imageUrl: post.imageUrl,
        postType: post.postType,
      };

      const resp = await fetch(input.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) throw new Error(`Webhook failed: ${resp.status}`);

      await db.update(socialPosts)
        .set({ status: "published", publishedAt: new Date(), webhookUrl: input.webhookUrl })
        .where(eq(socialPosts.id, input.postId));

      return { success: true, webhookResponse: await resp.text() };
    }),

  // ─── Batch Generate (multi-platform from one source) ─────
  batchGenerate: protectedProcedure
    .input(z.object({
      platforms: z.array(z.enum(["twitter", "linkedin", "facebook", "reddit", "threads", "instagram"])),
      sourceContent: z.string().min(1),
      sourceUrl: z.string().optional(),
      sourceTitle: z.string().optional(),
      tone: z.string().optional(),
      brandContextId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Load brand context once
      let brandLens = "";
      if (input.brandContextId) {
        const db = await getDb();
        if (db) {
          const [bc] = await db.select().from(brandContexts).where(
            and(eq(brandContexts.id, input.brandContextId), eq(brandContexts.userId, ctx.user.id))
          );
          if (bc) {
            brandLens = `Brand: ${bc.name}. Voice: ${bc.voice || "professional"}. Audience: ${bc.audience || "general"}.`;
          }
        }
      }

      const platformSpecs = input.platforms.map(p => {
        const cfg = PLATFORM_CONFIG[p];
        return `${p}: max ${cfg.maxChars} chars. ${cfg.bestPractices}`;
      }).join("\n");

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `Generate social media posts for MULTIPLE platforms from one source article.
${brandLens ? `\nBrand context: ${brandLens}` : ""}
${input.tone ? `Tone: ${input.tone}` : ""}

Platform specs:
${platformSpecs}

Return JSON object with platform name as key:
{
  "twitter": { "content": "...", "hashtags": ["..."], "score": 85 },
  "linkedin": { "content": "...", "hashtags": ["..."], "score": 90 },
  ...
}
Each post must be optimized for its specific platform. Don't just resize — reimagine for each audience.`,
          },
          {
            role: "user",
            content: `Source: ${input.sourceTitle || ""}\n\n${input.sourceContent}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      });

      const text = result.choices[0]?.message?.content || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {};
      }

      // Save all to DB
      const db = await getDb();
      const savedPosts: any[] = [];

      if (db) {
        for (const platform of input.platforms) {
          const post = parsed[platform];
          if (!post) continue;

          const [inserted] = await db.insert(socialPosts).values({
            userId: ctx.user.id,
            brandId: input.brandContextId || null,
            platform: platform as any,
            postType: "single",
            content: post.content || "",
            hashtags: post.hashtags || [],
            sourceUrl: input.sourceUrl || null,
            sourceTitle: input.sourceTitle || null,
            tone: input.tone || null,
            language: "en",
            score: post.score || null,
            status: "draft",
          });
          savedPosts.push({ id: inserted.insertId, platform, ...post });
        }
      }

      return { posts: savedPosts, raw: parsed };
    }),
});
