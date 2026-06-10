/**
 * Research & Utility Router — 5 endpoints
 * Covers: academic-search, perplexity-research, scrape-url, youtube-search, status
 */
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import { academicSearch, formatForLLM, type AcademicResult } from "../lib/academic-search";

export const researchRouter = router({

  // ── Academic Multi-Source Search (OpenAlex + CrossRef + Semantic Scholar + PubMed) ──
  // No API keys needed — free academic databases queried in parallel
  academicSearch: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      maxPerSource: z.number().min(1).max(20).default(5),
      includePubMed: z.boolean().default(false),
      sources: z.array(z.enum(["openalex", "crossref", "semantic_scholar", "pubmed"])).optional(),
      format: z.enum(["json", "llm"]).default("json"),
    }))
    .mutation(async ({ input }) => {
      const results = await academicSearch(input.query, {
        maxPerSource: input.maxPerSource,
        includePubMed: input.includePubMed,
        sources: input.sources,
      });

      return {
        success: true,
        query: input.query,
        totalResults: results.length,
        results: input.format === "llm" ? undefined : results,
        formatted: input.format === "llm" ? formatForLLM(results) : undefined,
        sources: [...new Set(results.map(r => r.source))],
      };
    }),

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

  // Brave Search — direct web search (no LLM overhead, real-time results)
  braveSearch: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      count: z.number().min(1).max(20).default(10),
      freshness: z.enum(["day", "week", "month", "year", "all"]).default("week"),
    }))
    .mutation(async ({ input }) => {
      if (!ENV.braveApiKey) throw new Error("BRAVE_API_KEY not configured — add it in Settings or .env");

      const params = new URLSearchParams({
        q: input.query,
        count: String(input.count),
        freshness: input.freshness === "all" ? "" : `p${input.freshness[0]}`, // pd, pw, pm, py
        text_decorations: "false",
        result_filter: "web",
      });
      // Remove empty freshness param
      if (input.freshness === "all") params.delete("freshness");

      const resp = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": ENV.braveApiKey,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Brave Search error (${resp.status}): ${body.slice(0, 200)}`);
      }

      const data = await resp.json() as any;
      const results = (data.web?.results || []).map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        description: r.description || "",
        age: r.age || "",
        thumbnail: r.thumbnail?.src || r.profile?.img || "",
        siteName: r.meta_url?.hostname || new URL(r.url || "https://example.com").hostname,
        publishedDate: r.page_age || "",
      }));

      return {
        success: true,
        query: data.query?.original || input.query,
        totalResults: data.web?.total_count || results.length,
        results,
        news: (data.news?.results || []).slice(0, 5).map((n: any) => ({
          title: n.title || "",
          url: n.url || "",
          description: n.description || "",
          age: n.age || "",
          thumbnail: n.thumbnail?.src || "",
          source: n.meta_url?.hostname || "",
        })),
      };
    }),

  // ActivePieces webhook — fire events to external automations
  triggerWebhook: protectedProcedure
    .input(z.object({
      event: z.enum(["article_published", "article_scored", "research_complete", "pitch_sent", "custom"]),
      payload: z.record(z.string(), z.any()),
    }))
    .mutation(async ({ input }) => {
      if (!ENV.activepiecesWebhook) throw new Error("ACTIVEPIECES_WEBHOOK_URL not configured");

      const resp = await fetch(ENV.activepiecesWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: input.event,
          timestamp: new Date().toISOString(),
          ...input.payload,
        }),
        signal: AbortSignal.timeout(10000),
      });

      return {
        success: resp.ok,
        status: resp.status,
        message: resp.ok ? "Webhook delivered" : `Webhook failed (${resp.status})`,
      };
    }),

  // System status
  status: publicProcedure.query(() => ({
    ok: true,
    version: "5.2.0",
    timestamp: new Date().toISOString(),
    apis: {
      anthropic: !!ENV.anthropicApiKey,
      openai: !!ENV.openaiApiKey,
      openrouter: !!ENV.openrouterApiKey,
      gemini: !!ENV.geminiApiKey,
      perplexity: !!ENV.perplexityApiKey,
      brave: !!ENV.braveApiKey,
      activepieces: !!ENV.activepiecesWebhook,
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

    imageProviders: {
      "gpt-image-2": !!ENV.openaiApiKey,
      "gpt-image-1": !!ENV.openaiApiKey,
      "dall-e-3": !!ENV.openaiApiKey,
      gemini: !!ENV.geminiApiKey,
      piapi: !!ENV.piapiKey,
      openrouterEnhance: !!ENV.openrouterApiKey,
    },
  })),
});
