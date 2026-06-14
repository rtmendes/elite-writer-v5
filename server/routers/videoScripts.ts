/**
 * Video Scripts — ports the old app's video-script generator into v5, expanded
 * to the operator's standing content formats: VSL (Fladlien/Kern), TikTok/short
 * (<30s), YouTube long-form, explainer, and UGC ad. Free-model generation with
 * format-specific structure baked into each preset.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM, TIER } from "../_core/llm";

const HOUSE = `US English. No AI-tell phrases ("delve", "in today's world", "game-changer", "unlock", "leverage" as a verb). Concrete, spoken-aloud cadence — write for the ear, not the page. Return ONLY the script in the requested structure, no preamble.`;

export const VIDEO_FORMATS = {
  vsl: {
    label: "VSL (Fladlien / Kern)",
    maxTokens: 6000,
    spec: `Long-form video sales letter in the Jon Benson / Frank Kern lineage. Structure: PATTERN INTERRUPT hook → callout of the avatar → the big promise → the problem & false solutions → unique mechanism → proof/credibility → the offer → stack & value → risk reversal/guarantee → scarcity → CTA. Conversational, one-idea-per-line, [B-ROLL] and [ON-SCREEN TEXT] cues. Mark each act with a header.`,
  },
  tiktok: {
    label: "TikTok / Short (<30s)",
    maxTokens: 1200,
    spec: `Under 30 seconds (~70-90 spoken words). Structure: 0-3s scroll-stopping hook → rapid value/story → single payoff → soft CTA. Native, punchy, no intro. Include [VISUAL] cues and an on-screen-text hook line.`,
  },
  youtube: {
    label: "YouTube long-form",
    maxTokens: 5000,
    spec: `8-12 minute YouTube script. Structure: cold-open hook (first 15s earns the click) → intro/promise → 3-5 value segments with [B-ROLL] cues → mid-roll retention hook → payoff → CTA + next-video tease. Section headers with rough timestamps.`,
  },
  explainer: {
    label: "Explainer",
    maxTokens: 2500,
    spec: `60-120s explainer. Structure: problem → "what if" → how-it-works in 3 steps → benefit → CTA. Clear, friendly narrator voice with [VISUAL]/[ANIMATION] cues.`,
  },
  ugc: {
    label: "UGC ad",
    maxTokens: 1500,
    spec: `Authentic creator-style UGC ad (~30-45s). First-person, unpolished, "I was skeptical but…" arc: hook → relatable problem → discovery → demo → result → casual CTA. Include [SHOT] direction (selfie, product close-up, etc.).`,
  },
} as const;

export const videoScriptsRouter = router({
  formats: protectedProcedure.query(() =>
    Object.entries(VIDEO_FORMATS).map(([id, f]) => ({ id, label: f.label }))),

  generate: protectedProcedure
    .input(z.object({
      format: z.enum(["vsl", "tiktok", "youtube", "explainer", "ugc"]),
      topic: z.string().min(1),
      audience: z.string().optional(),
      offer: z.string().optional(),
      brandVoice: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const f = VIDEO_FORMATS[input.format];
      const res = await invokeLLM({
        model: TIER.freeBig,
        maxTokens: f.maxTokens,
        messages: [
          { role: "system", content: `You are an elite direct-response video scriptwriter.\nFORMAT: ${f.label}.\n${f.spec}\n${HOUSE}` },
          { role: "user", content: `Topic: ${input.topic}${input.audience ? `\nAudience: ${input.audience}` : ""}${input.offer ? `\nOffer to drive to: ${input.offer}` : ""}${input.brandVoice ? `\nBrand voice: ${input.brandVoice}` : ""}\n\nWrite the complete ${f.label} script.` },
        ],
      });
      const script = res.choices?.[0]?.message?.content ?? "";
      return { script, format: input.format, model: res.model };
    }),
});
