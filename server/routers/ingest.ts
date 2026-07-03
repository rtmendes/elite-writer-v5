import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { ingestZimmwriterArticle } from "../lib/zimmwriter-ingest";

export const zimmwriterPayloadSchema = z.object({
  webhook_name: z.string().min(1),
  title: z.string().min(1),
  markdown: z.string(),
  html: z.string(),
  excerpt: z.union([z.string(), z.literal(false)]).optional(),
  category: z.union([z.string(), z.literal(false)]).optional(),
  slug: z.union([z.string(), z.literal(false)]).optional(),
  tags: z.union([z.array(z.string()), z.literal(false)]).optional(),
  image_url: z.union([z.string(), z.literal(false)]).optional(),
  image_base64: z.union([z.string(), z.literal(false)]).optional(),
});

export const ingestRouter = router({
  zimmwriter: publicProcedure
    .input(zimmwriterPayloadSchema)
    .mutation(async ({ input }) => ingestZimmwriterArticle(input)),
});
