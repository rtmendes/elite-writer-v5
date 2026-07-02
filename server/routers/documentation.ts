/**
 * Documentation AI — ports the old app's 1,285-line doc generator into v5.
 * Generates structured product docs & SOPs with a free model, stores them in
 * kb_items (category "Documentation"), and lists/reads them back. Doc types
 * mirror the old module: how-to guide, SOP, API/reference, FAQ, onboarding.
 */
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM, TIER } from "../_core/llm";
import { getDb } from "../db";
import { kbItems } from "../../drizzle/schema";

const CATEGORY = "Documentation";

const DOC_TYPES: Record<string, { label: string; spec: string }> = {
  howto: { label: "How-to guide", spec: "Step-by-step guide. Structure: overview → prerequisites → numbered steps (each with the action and the expected result) → troubleshooting → next steps. 9th-grade reading level." },
  sop: { label: "SOP", spec: "Standard operating procedure. Structure: purpose → scope → roles/responsibilities → step-by-step procedure (numbered, imperative) → quality checks → escalation. Include a one-line 'definition of done'." },
  reference: { label: "API / reference", spec: "Technical reference. Structure: summary → parameters/fields table (markdown) → return/output → examples (code fenced) → errors & edge cases → notes." },
  faq: { label: "FAQ", spec: "FAQ document. 8-15 real questions a user would ask, each with a concise, complete answer. Group by theme with headers." },
  onboarding: { label: "Onboarding", spec: "Onboarding doc for a new operator/teammate. Structure: what this is → why it matters → first-day checklist → key concepts → where things live → who to ask. Warm, practical." },
};

export const documentationRouter = router({
  docTypes: protectedProcedure.query(() => Object.entries(DOC_TYPES).map(([id, d]) => ({ id, label: d.label }))),

  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(kbItems)
      .where(and(eq(kbItems.userId, ctx.user.id), eq(kbItems.category, CATEGORY)))
      .orderBy(desc(kbItems.id));
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const [row] = await db.select().from(kbItems)
      .where(and(eq(kbItems.id, input.id), eq(kbItems.userId, ctx.user.id)));
    return row ?? null;
  }),

  generate: protectedProcedure
    .input(z.object({
      docType: z.enum(["howto", "sop", "reference", "faq", "onboarding"]),
      title: z.string().min(1),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const t = DOC_TYPES[input.docType];
      const res = await invokeLLM({
        model: TIER.freeBig,
        maxTokens: 5000,
        messages: [
          { role: "system", content: `You are a senior technical writer. Produce a complete ${t.label} in clean Markdown.\n${t.spec}\nUS English. No filler, no AI-tell phrases. Start with an H1 title. Return ONLY the document.` },
          { role: "user", content: `Title: ${input.title}${input.context ? `\n\nContext / source material:\n${input.context}` : ""}` },
        ],
      });
      return { markdown: res.choices?.[0]?.message?.content ?? "", docType: input.docType };
    }),

  save: protectedProcedure
    .input(z.object({ title: z.string().min(1), content: z.string(), docType: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [r] = await db.insert(kbItems).values({
        userId: ctx.user.id,
        title: input.title,
        content: input.content,
        category: CATEGORY,
        subcategory: input.docType ?? null,
        source: "Documentation AI",
      }).returning({ id: kbItems.id });
      return { id: r.id };
    }),

  remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");
    await db.delete(kbItems).where(and(eq(kbItems.id, input.id), eq(kbItems.userId, ctx.user.id)));
    return { ok: true };
  }),
});
