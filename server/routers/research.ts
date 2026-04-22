/**
 * Research & Utility Router — 4 endpoints ported from elite-writer-app
 * Covers: perplexity-research, scrape-url, youtube-search, status
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";

export const researchRouter = router({
  // Perplexity deep research
  perplexity: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      model: z.string().default("sonar"),
      focusArea: z.string().optional(),
      maxTokens: z.number().default(4000),
    }))
    .mutation(async ({ input }) => {
      if (!ENV.perplexityApiKey) throw new Error("PERPLEXITY_API_KEY not configured");

      const systemPrompt = input.focusArea
        ? `You are a research assistant specializing in ${input.focusArea}. Provide comprehensive, well-sourced analysis.`
        : "You are a research assistant. Provide comprehensive, well-sourced analysis with specific data points, quotes, and citations.";

      const resp = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.perplexityApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.query },
          ],
          max_tokens: input.maxTokens,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Perplexity error (${resp.status}): ${body.slice(0, 200)}`);
      }

      const data = await resp.json() as any;
      return {
        success: true,
        content: data.choices?.[0]?.message?.content || "",
        citations: data.citations || [],
        model: data.model,
        usage: data.usage,
      };
    }),

  // Scrape URL content
  scrapeUrl: protectedProcedure
    .input(z.object({
      url: z.string().url(),
      extractText: z.boolean().default(true),
      includeMetadata: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      let html: string;
      let status: number;

      try {
        const resp = await fetch(input.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
        });
        status = resp.status;
        html = await resp.text();
      } catch (e) {
        throw new Error(`Failed to fetch URL: ${(e as Error).message}`);
      }

      // Extract metadata
      const metadata: Record<string, string> = {};
      if (input.includeMetadata) {
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
        const ogTitle = html.match(/property="og:title"\s+content="(.*?)"/is);
        const ogDesc = html.match(/property="og:description"\s+content="(.*?)"/is);
        const ogImage = html.match(/property="og:image"\s+content="(.*?)"/is);
        const metaDesc = html.match(/name="description"\s+content="(.*?)"/is);
        const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="(.*?)"/is);

        metadata.title = ogTitle?.[1] || titleMatch?.[1] || "";
        metadata.description = ogDesc?.[1] || metaDesc?.[1] || "";
        metadata.image = ogImage?.[1] || "";
        metadata.canonical = canonical?.[1] || input.url;
      }

      // Extract text content
      let textContent = "";
      if (input.extractText) {
        textContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 15000);
      }

      return {
        success: true,
        url: input.url,
        status,
        metadata,
        textContent,
        wordCount: textContent.split(/\s+/).length,
        htmlLength: html.length,
      };
    }),

  // YouTube search
  youtubeSearch: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      maxResults: z.number().default(5),
    }))
    .mutation(async ({ input }) => {
      if (!ENV.youtubeApiKey) throw new Error("YOUTUBE_API_KEY not configured");

      const params = new URLSearchParams({
        part: "snippet",
        q: input.query,
        maxResults: String(input.maxResults),
        type: "video",
        key: ENV.youtubeApiKey,
      });

      const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`YouTube API error (${resp.status}): ${body.slice(0, 200)}`);
      }

      const data = await resp.json() as any;
      return {
        success: true,
        results: (data.items || []).map((item: any) => ({
          videoId: item.id?.videoId,
          title: item.snippet?.title,
          description: item.snippet?.description,
          thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
          channelTitle: item.snippet?.channelTitle,
          publishedAt: item.snippet?.publishedAt,
          watchUrl: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
        })),
        totalResults: data.pageInfo?.totalResults || 0,
      };
    }),

  // System status
  status: publicProcedure.query(() => ({
    ok: true,
    version: "5.1.0",
    timestamp: new Date().toISOString(),
    apis: {
      anthropic: !!ENV.anthropicApiKey,
      openai: !!ENV.openaiApiKey,
      openrouter: !!ENV.openrouterApiKey,
      gemini: !!ENV.geminiApiKey,
      perplexity: !!ENV.perplexityApiKey,
      stabilityAi: !!ENV.stabilityAiKey,
      newsapi: !!ENV.newsapiKey,
      gnews: !!ENV.gnewsKey,
      mediastack: !!ENV.mediastackKey,
      newsdata: !!ENV.newsdataKey,
      piapi: !!ENV.piapiKey,
      kie: !!ENV.kieApiKey,
      google: !!(ENV.googleClientId && ENV.googleClientSecret),
      youtube: !!ENV.youtubeApiKey,
    },
    database: true,
  })),
});
