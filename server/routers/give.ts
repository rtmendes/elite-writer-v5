/**
 * GIVE Engine Router — Data Visualization via GIVE API
 * 
 * Proxies to https://give.insightprofit.live for:
 * 1. Interactive visualization generation (4-agent pipeline)
 * 2. Embed URL generation for article insertion
 * 3. Quality scoring of generated visualizations
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";

const GIVE_API_BASE = "https://give.insightprofit.live";

export const giveRouter = router({
  // ─── Generate Interactive Visualization ────────────────────
  visualize: protectedProcedure
    .input(z.object({
      prompt: z.string().min(1, "Describe the visualization you want"),
      data: z.any().optional(),
      parameters: z.record(z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      const startTime = Date.now();

      const res = await fetch(`${GIVE_API_BASE}/api/visualize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input.prompt,
          data: input.data || {},
          parameters: input.parameters || {},
        }),
        signal: AbortSignal.timeout(60000), // 60s timeout for 4-agent pipeline
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`GIVE API error (${res.status}): ${errorText}`);
      }

      const result = await res.json() as any;
      const elapsed = Date.now() - startTime;

      return {
        success: result.success ?? false,
        code: result.code ?? null,
        decision: result.decision ?? null,
        metadata: {
          ...result.metadata,
          totalTime: elapsed,
        },
        error: result.error ?? null,
      };
    }),

  // ─── Generate Embed URL ───────────────────────────────────
  embed: protectedProcedure
    .input(z.object({
      code: z.string().min(1, "Visualization code is required"),
      data: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const res = await fetch(`${GIVE_API_BASE}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: input.code,
          data: input.data,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`GIVE embed error (${res.status}): ${errorText}`);
      }

      const result = await res.json() as any;

      return {
        success: result.success ?? false,
        embedUrl: result.embedUrl ?? null,
        iframeCode: result.iframeCode ?? null,
        codeLength: result.codeLength ?? 0,
      };
    }),

  // ─── Score a Visualization ────────────────────────────────
  score: protectedProcedure
    .input(z.object({
      code: z.string(),
      prompt: z.string(),
      data: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      const res = await fetch(`${GIVE_API_BASE}/api/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: input.code,
          prompt: input.prompt,
          data: input.data || {},
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        throw new Error(`GIVE score error (${res.status}): ${errorText}`);
      }

      return await res.json() as any;
    }),

  // ─── Health Check ─────────────────────────────────────────
  health: protectedProcedure
    .query(async () => {
      try {
        const res = await fetch(`${GIVE_API_BASE}/api/health`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return { healthy: false, error: `Status ${res.status}` };
        const data = await res.json() as any;
        return { healthy: true, ...data };
      } catch (err: any) {
        return { healthy: false, error: err.message };
      }
    }),
});
