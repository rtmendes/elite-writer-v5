import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { ENV } from "./env";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      }).optional()
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Returns server-side API keys so the client Settings page can auto-populate
  getServerKeys: publicProcedure.query(() => {
    return {
      openai_key: ENV.openaiApiKey || "",
      anthropic_key: ENV.anthropicApiKey || "",
      openrouter_key: ENV.openrouterApiKey || "",
      gemini_key: ENV.geminiApiKey || "",
      newsapi_key: ENV.newsapiKey || "",
      gnews_key: ENV.gnewsKey || "",
      mediastack_key: ENV.mediastackKey || "",
      perplexity_key: ENV.perplexityApiKey || "",
      youtube_key: ENV.youtubeApiKey || "",
      google_client_id: ENV.googleClientId || "",
    };
  }),
});
