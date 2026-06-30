/**
 * Template SOPs router
 * CRUD + seeding for writing template Standard Operating Procedures.
 * The Drafter injects the chosen SOP into its system prompt so output
 * follows the section order, word targets, evidence rules, and visual slots
 * defined per template — not a generic blob of text.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { templateSops } from "../../drizzle/schema";

// ── Seeded SOPs for the 8 core journalist templates ──────────────────────────

const SEED_SOPS = [
  {
    templateId: "data-journalism",
    name: "Data Journalism Feature",
    purpose: "Evidence-first investigative piece for readers who trust data over opinion. Reader: educated adult, skeptical, wants to understand 'what does this number mean for me?'",
    sections: [
      { heading: "Lede with the striking stat", h_level: 2, wordTarget: 150, notes: "Lead with the single most surprising/counterintuitive data point. Contextualise immediately." },
      { heading: "Context & why it matters now", h_level: 2, wordTarget: 200, notes: "Brief background: what changed, who is affected, why the data set is credible." },
      { heading: "Methodology note", h_level: 3, wordTarget: 100, notes: "Callout box: data source, date range, sample size, any caveats. Required for credibility." },
      { heading: "Deep data analysis", h_level: 2, wordTarget: 400, notes: "Walk through 2–3 key findings. Each finding: stat → what it shows → comparison or trend." },
      { heading: "Expert interpretation", h_level: 2, wordTarget: 250, notes: "1–2 expert quotes that explain WHY the numbers look like this, not just restate them." },
      { heading: "Implications & what it means", h_level: 2, wordTarget: 200, notes: "Who wins, who loses, what changes. Concrete and specific." },
      { heading: "What to watch next", h_level: 2, wordTarget: 100, notes: "One forward-looking paragraph with a specific data point or event to track." },
    ],
    tone: "Authoritative, precise, neutral. No hyperbole. Every adjective earns its place. Short declarative sentences. Active voice.",
    hookPattern: "Open with a single data point that violates the reader's prior belief. E.g.: 'Despite [assumption], the data shows X — a finding that [implication].'",
    evidenceRules: "Every factual claim must cite a source inline (Author, Year) or (Publication, Date). Minimum 2 charts or data visualisations referenced. No unsourced statistics.",
    visualSlots: [
      { afterSection: "Lede with the striking stat", type: "chart", description: "Key trend chart showing the headline stat over time or by category" },
      { afterSection: "Deep data analysis", type: "chart", description: "Supporting data breakdown — second key finding" },
    ],
    ctaClose: "End with a question the data raises but does not answer — invites reader engagement and follow-up research.",
    seoPattern: "Primary keyword in H1 and first 100 words. One H2 containing the keyword. Meta description summarises the key stat.",
    publicationFit: "Bloomberg, FiveThirtyEight, The Atlantic Data Desk, Vox, ProPublica, The Guardian datablog.",
  },
  {
    templateId: "investigative",
    name: "Investigative Deep Dive",
    purpose: "Multi-source investigation exposing a problem, pattern, or wrongdoing. Reader: engaged citizen wanting accountability and full context.",
    sections: [
      { heading: "The revelation", h_level: 2, wordTarget: 200, notes: "Open with the most important finding. What did you discover? Put it first." },
      { heading: "How we got here: timeline", h_level: 2, wordTarget: 250, notes: "Chronological arc — when did this start, how did it escalate?" },
      { heading: "Key evidence", h_level: 2, wordTarget: 400, notes: "Documents, data, interviews. Each piece of evidence: what it shows and why it matters." },
      { heading: "Who is affected and how", h_level: 2, wordTarget: 250, notes: "Humanise with a specific person or community. Concrete, not abstract impact." },
      { heading: "Expert analysis", h_level: 2, wordTarget: 200, notes: "Independent expert quotes — not affiliated with the subject of investigation." },
      { heading: "Response from the subject", h_level: 2, wordTarget: 100, notes: "Include the subject's response or note that they declined to comment." },
      { heading: "What happens next", h_level: 2, wordTarget: 150, notes: "Pending actions, legal implications, policy changes expected." },
      { heading: "Call for accountability", h_level: 2, wordTarget: 100, notes: "Clear, non-editorialising close — what has been established by the evidence." },
    ],
    tone: "Serious, measured, precise. No loaded adjectives unless directly supported by evidence. Moral urgency is conveyed through facts, not rhetoric.",
    hookPattern: "The revelatory opening: name the key finding in the first sentence. Establish stakes in sentence two.",
    evidenceRules: "Every factual allegation must have a named source, document reference, or data point. Anonymous sources must be described by role. Minimum 3 independent sources per key claim.",
    visualSlots: [
      { afterSection: "How we got here: timeline", type: "image", description: "Timeline graphic of key events" },
      { afterSection: "Key evidence", type: "image", description: "Document excerpt or data table showing key evidence" },
    ],
    ctaClose: "Close with what the evidence establishes — not a verdict, but a clear statement of what has been documented. Avoid calls to action that imply guilt.",
    seoPattern: "Event/person/organisation name as primary keyword. Who-what-when in H1. Question-form H2 matching likely search intent.",
    publicationFit: "NYT, The Atlantic, Wired, ProPublica, The Guardian, Vanity Fair, The New Yorker.",
  },
  {
    templateId: "explainer",
    name: "Explainer / Deep Dive",
    purpose: "Make a complex topic accessible to an intelligent non-expert. Reader: curious adult who has heard of the topic but doesn't understand it.",
    sections: [
      { heading: "Why you should care", h_level: 2, wordTarget: 150, notes: "Stakes paragraph: what changes in the reader's life or world if they understand this." },
      { heading: "The basics (plain English)", h_level: 2, wordTarget: 250, notes: "Core concept in one or two paragraphs. No jargon. Use analogy." },
      { heading: "How it actually works", h_level: 2, wordTarget: 350, notes: "Mechanism, step by step. Can use a numbered list here." },
      { heading: "The nuances most people miss", h_level: 2, wordTarget: 300, notes: "Common misconception corrected. Expert insight that surprises." },
      { heading: "Real-world examples", h_level: 2, wordTarget: 250, notes: "Two to three concrete examples: a company, event, or person that illustrates the concept." },
      { heading: "What to watch for next", h_level: 2, wordTarget: 150, notes: "What is coming: policy changes, technological shifts, or upcoming decisions that will test this concept." },
    ],
    tone: "Warm, curious, authoritative without being condescending. Conversational but precise. Never dumbed-down — just clear.",
    hookPattern: "Start with a scenario the reader can imagine themselves in, then name the concept it illustrates.",
    evidenceRules: "At least one expert source per major claim. Data points are welcome but must be in plain English ('1 in 5 Americans' not '20% of the US population'). Cite analogies' limits.",
    visualSlots: [
      { afterSection: "How it actually works", type: "chart", description: "Simple diagram or flowchart showing the mechanism" },
    ],
    ctaClose: "End with one actionable thing the reader can do, check, or watch — something concrete they can take from the article.",
    seoPattern: "Question-form H1 ('What is X?' / 'How does X work?'). Answer the question in the first paragraph for featured-snippet eligibility.",
    publicationFit: "Vox, The Verge, Wired, The Atlantic, Axios, CNBC Explain.",
  },
  {
    templateId: "trend-analysis",
    name: "Trend Analysis / Market Report",
    purpose: "Forward-looking analysis of an emerging pattern — who is driving it, what it means, where it goes. Reader: business leader, investor, or senior professional who needs strategic context.",
    sections: [
      { heading: "The trend in one sentence", h_level: 2, wordTarget: 150, notes: "Name the trend precisely. State the scale and speed of the shift." },
      { heading: "Evidence it is real", h_level: 2, wordTarget: 250, notes: "Three or more data points from different sources proving the trend is not noise." },
      { heading: "Who is driving it", h_level: 2, wordTarget: 200, notes: "Demand side (demographics, behaviour change) and supply side (companies, technology)." },
      { heading: "Market implications", h_level: 2, wordTarget: 250, notes: "Revenue at stake. Which sectors, geographies, and value chains are affected." },
      { heading: "Winners and losers", h_level: 2, wordTarget: 200, notes: "Specific named companies or categories. Concrete — not 'some companies may benefit'." },
      { heading: "Timeline predictions", h_level: 2, wordTarget: 150, notes: "Near-term (12 months), medium-term (3 years), long-term (5+ years) with a named trigger for each inflection." },
      { heading: "How to position yourself", h_level: 2, wordTarget: 150, notes: "Practical takeaway — one paragraph, actionable for the target reader." },
    ],
    tone: "Analytical, confident, forward-looking. Makes calls, not hedges. Avoids 'could', 'might', 'some experts say'. Backs predictions with named evidence.",
    hookPattern: "Open with the inflection point: the specific moment, data point, or event that signals the trend has crossed from emerging to established.",
    evidenceRules: "Quantitative data required for every trend claim. Name the source and date. Analyst or industry source quotes for predictions. No unnamed reports.",
    visualSlots: [
      { afterSection: "Evidence it is real", type: "chart", description: "Trend line showing the growth/shift over time" },
      { afterSection: "Market implications", type: "chart", description: "Market size or revenue impact projection" },
    ],
    ctaClose: "Close with the single most important thing the reader should do or watch in the next 90 days.",
    seoPattern: "Primary keyword: '[Topic] trends [Year]' or '[Topic] market analysis'. Include year in H1 for freshness signal.",
    publicationFit: "Bloomberg, Fortune, Wired, The Verge, Business Insider, McKinsey Quarterly.",
  },
  {
    templateId: "opinion",
    name: "Op-Ed / Opinion",
    purpose: "Make a persuasive argument — one clear position, backed by evidence, that challenges the conventional view. Reader: engaged citizen who may disagree but will read if the argument is sharp.",
    sections: [
      { heading: "The bold thesis", h_level: 2, wordTarget: 150, notes: "State your position clearly in the first two sentences. No wind-up. Make the claim." },
      { heading: "Why the conventional wisdom is wrong", h_level: 2, wordTarget: 200, notes: "Name what most people believe and explain the flaw in that view." },
      { heading: "Evidence point 1", h_level: 2, wordTarget: 200, notes: "First supporting argument with data or example. Strongest evidence first." },
      { heading: "Evidence point 2", h_level: 2, wordTarget: 200, notes: "Second supporting argument — different type of evidence from point 1." },
      { heading: "The counterargument and rebuttal", h_level: 2, wordTarget: 200, notes: "State the strongest objection to your view honestly, then explain why it does not defeat the thesis." },
      { heading: "What should change", h_level: 2, wordTarget: 150, notes: "Concrete recommendation or call for a specific action or policy change." },
      { heading: "The close", h_level: 2, wordTarget: 100, notes: "Echo the opening thesis with the weight of the argument behind it. Leave the reader with one unforgettable line." },
    ],
    tone: "Direct, urgent, persuasive — without being strident. Argue with evidence not emotion. First-person is appropriate. No hedging: this is advocacy.",
    hookPattern: "Open with the moment that crystallised the argument for you, or with the data point that broke the conventional assumption.",
    evidenceRules: "Every factual claim cited. No 'research shows' without naming the research. Personal experience can be evidence but must be contextualised with data.",
    visualSlots: [
      { afterSection: "Evidence point 1", type: "chart", description: "Data supporting the primary argument" },
    ],
    ctaClose: "End with a single clear call to action — what the reader should think, do, or demand. Make it specific.",
    seoPattern: "Opinion on [topic]: use the topic keyword plus a strong stance verb ('Why X Is Wrong', 'The Case Against Y'). Under 65 chars for the H1.",
    publicationFit: "NYT Opinion, TIME Ideas, The Atlantic, Slate, Foreign Policy, The Guardian Opinion.",
  },
  {
    templateId: "listicle",
    name: "High-Tier Listicle",
    purpose: "A numbered-list article where each item has depth — not a lazy list of bullets but a mini-argument per item. Reader: professional or enthusiast who wants to scan and then read the items that apply.",
    sections: [
      { heading: "Why this matters now", h_level: 2, wordTarget: 150, notes: "The intro earns the list: what changed, why now, what the reader will take away." },
      { heading: "Items (repeat per item)", h_level: 2, wordTarget: 150, notes: "Each item: bold item name → one-sentence thesis → 100–150 words of supporting evidence + example. Vary item types: data, story, expert, counterintuitive." },
      { heading: "The unexpected item", h_level: 2, wordTarget: 150, notes: "One item that violates the reader's expectation — provides the 'I didn't know that' moment." },
      { heading: "How to use these insights", h_level: 2, wordTarget: 150, notes: "Practical close: how a reader applies at least one of the items to their situation." },
    ],
    tone: "Energetic, confident, scannable. Short sentences in item intros. Deep enough per item to justify the read. No filler.",
    hookPattern: "Open with the number and a reason: 'Here are [N] things about X that most people in [industry] get wrong.'",
    evidenceRules: "Each item needs at least one data point or named source. Avoid anecdata without substantiation.",
    visualSlots: [
      { afterSection: "Items (repeat per item)", type: "image", description: "Optional: relevant image for the most visual item" },
    ],
    ctaClose: "Close with a synthesis: what the list reveals as a whole pattern, not just a sum of items.",
    seoPattern: "'[Number] [Adjective] [Topic] [Year]' — include the number in H1. Target 'best X', 'top X' long-tail keywords.",
    publicationFit: "Forbes, Inc., Fast Company, Business Insider, Entrepreneur, HubSpot Blog.",
  },
  {
    templateId: "case-study",
    name: "Case Study / Profile",
    purpose: "Deep analysis of one specific example — company, person, campaign, or event — that illustrates a broader principle. Reader: practitioner who wants to learn from a real example.",
    sections: [
      { heading: "The subject and the stakes", h_level: 2, wordTarget: 200, notes: "Who or what is the subject? What problem were they facing? Why does it matter beyond this case?" },
      { heading: "Background and context", h_level: 2, wordTarget: 200, notes: "Timeline of how the situation developed. Market or personal context." },
      { heading: "The approach", h_level: 2, wordTarget: 250, notes: "What did they actually do? Specific decisions, actions, and the reasoning behind them." },
      { heading: "Execution details", h_level: 2, wordTarget: 250, notes: "How was it implemented? Resources, timeline, obstacles faced." },
      { heading: "Results", h_level: 2, wordTarget: 200, notes: "Quantified outcomes. Before/after comparison. Be precise — avoid 'significantly improved'." },
      { heading: "What went wrong", h_level: 2, wordTarget: 150, notes: "Honest assessment of failures, missteps, or what they would do differently." },
      { heading: "Lessons and how to apply them", h_level: 2, wordTarget: 200, notes: "Three to five transferable lessons. One paragraph each, directly actionable." },
    ],
    tone: "Narrative and analytical in equal parts. Storytelling in the background sections; precise and data-driven in results and lessons.",
    hookPattern: "Open with the moment of highest tension or the most striking result — then step back to explain how they got there.",
    evidenceRules: "Primary source (interview, public filings, press releases) preferred. Every quantitative result needs a source and date.",
    visualSlots: [
      { afterSection: "Results", type: "chart", description: "Before/after metric comparison chart" },
    ],
    ctaClose: "End with the single most transferable lesson — the one insight a reader can apply this week.",
    seoPattern: "'[Company/Person] case study' or '[Topic] example'. Named entity as primary keyword.",
    publicationFit: "HBR, Fast Company, Inc., Forbes, Entrepreneur, Stanford Social Innovation Review.",
  },
  {
    templateId: "expert-roundup",
    name: "Expert Roundup",
    purpose: "Aggregate expert perspectives on one precise question. Reader: professional who wants to understand the range of credible opinion on a topic before forming their own view.",
    sections: [
      { heading: "The question at hand", h_level: 2, wordTarget: 150, notes: "State the question precisely. Explain why it is contested or timely. Do not telegraph the answer." },
      { heading: "Expert perspectives (repeat per expert)", h_level: 2, wordTarget: 200, notes: "Each expert: name, title, organisation (one sentence bio) → their direct response → why their view matters. 3–5 experts minimum." },
      { heading: "Points of consensus", h_level: 2, wordTarget: 150, notes: "What all or most experts agree on — the common ground." },
      { heading: "Points of disagreement", h_level: 2, wordTarget: 150, notes: "Where experts diverge and why — what causes the disagreement?" },
      { heading: "What this means for the reader", h_level: 2, wordTarget: 150, notes: "Synthesis: given the expert views, what is the most defensible position, and what should the reader do?" },
    ],
    tone: "Curatorial and analytical. The writer's voice frames and synthesises — does not dominate. Quote experts generously and accurately.",
    hookPattern: "Open with the question as a genuine puzzle: state what is known, then the gap or disagreement that makes expert opinion valuable.",
    evidenceRules: "All expert quotes must be directly attributed, with full name and current title. No paraphrasing presented as quotes. Experts must be credentialed or demonstrably experienced.",
    visualSlots: [
      { afterSection: "Points of disagreement", type: "chart", description: "Expert opinion spectrum or comparison table" },
    ],
    ctaClose: "End with the most actionable synthesis — what a practitioner should take from the expert debate.",
    seoPattern: "'[Topic]: experts on [question]' or 'What experts say about [topic]'. Include 'experts', 'opinion', or 'views' in H1.",
    publicationFit: "Forbes, Inc., Psychology Today, Fast Company, Harvard Business Review, Scientific American.",
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

let seeded = false;

async function ensureSeeded() {
  if (seeded) return;
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ templateId: templateSops.templateId }).from(templateSops);
  const existingIds = new Set(existing.map((r) => r.templateId));
  const toInsert = SEED_SOPS.filter((s) => !existingIds.has(s.templateId));
  if (toInsert.length > 0) {
    await db.insert(templateSops).values(
      toInsert.map((s) => ({
        ...s,
        sections: s.sections as unknown as object,
        visualSlots: s.visualSlots as unknown as object,
        isSeeded: true,
      }))
    );
  }
  seeded = true;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const templateSopsRouter = router({
  /** List all SOPs (seeded + custom). No auth required — SOPs are not user-specific. */
  list: publicProcedure.query(async () => {
    await ensureSeeded();
    const db = await getDb();
    if (!db) return [];
    return db.select().from(templateSops).orderBy(templateSops.name);
  }),

  /** Get a single SOP by templateId. */
  get: publicProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ input }) => {
      await ensureSeeded();
      const db = await getDb();
      if (!db) return null;
      const rows = await db
        .select()
        .from(templateSops)
        .where(eq(templateSops.templateId, input.templateId))
        .limit(1);
      return rows[0] ?? null;
    }),

  /** Create or update a SOP (in-app editing). */
  upsert: protectedProcedure
    .input(
      z.object({
        templateId: z.string().min(1).max(80),
        name: z.string().min(1).max(200),
        purpose: z.string().optional(),
        sections: z.array(z.object({
          heading: z.string(),
          h_level: z.number().int().min(2).max(6),
          wordTarget: z.number().int().optional(),
          notes: z.string().optional(),
        })).optional(),
        tone: z.string().optional(),
        hookPattern: z.string().optional(),
        evidenceRules: z.string().optional(),
        visualSlots: z.array(z.object({
          afterSection: z.string(),
          type: z.enum(["chart", "image", "infographic"]),
          description: z.string(),
        })).optional(),
        ctaClose: z.string().optional(),
        seoPattern: z.string().optional(),
        publicationFit: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await ensureSeeded();
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { templateId, ...rest } = input;
      await db
        .insert(templateSops)
        .values({
          templateId,
          ...rest,
          sections: (rest.sections ?? null) as unknown as object,
          visualSlots: (rest.visualSlots ?? null) as unknown as object,
          isSeeded: false,
        })
        .onDuplicateKeyUpdate({
          set: {
            ...rest,
            sections: (rest.sections ?? null) as unknown as object,
            visualSlots: (rest.visualSlots ?? null) as unknown as object,
            isSeeded: false,
          },
        });
      const rows = await db
        .select()
        .from(templateSops)
        .where(eq(templateSops.templateId, templateId))
        .limit(1);
      return rows[0];
    }),
});

// ── Helper exported for use in ai.draft and generateArticle ──────────────────

export async function getSopPromptBlock(templateId: string | undefined): Promise<string> {
  if (!templateId) return "";
  try {
    await ensureSeeded();
    const db = await getDb();
    if (!db) return "";
    const rows = await db
      .select()
      .from(templateSops)
      .where(eq(templateSops.templateId, templateId))
      .limit(1);
    const sop = rows[0];
    if (!sop) return "";
    const sections = (sop.sections as Array<{ heading: string; h_level: number; wordTarget?: number; notes?: string }> | null) ?? [];
    const visualSlots = (sop.visualSlots as Array<{ afterSection: string; type: string; description: string }> | null) ?? [];
    return `

TEMPLATE SOP — ${sop.name}
PURPOSE: ${sop.purpose ?? ""}
TONE: ${sop.tone ?? ""}
HOOK PATTERN: ${sop.hookPattern ?? ""}
EVIDENCE RULES: ${sop.evidenceRules ?? ""}
SEO PATTERN: ${sop.seoPattern ?? ""}
PUBLICATION FIT: ${sop.publicationFit ?? ""}
CTA/CLOSE: ${sop.ctaClose ?? ""}

REQUIRED SECTIONS (follow this order exactly):
${sections.map((s, i) =>
  `${i + 1}. ${"#".repeat(s.h_level)} ${s.heading}${s.wordTarget ? ` (~${s.wordTarget} words)` : ""}${s.notes ? ` — ${s.notes}` : ""}`
).join("\n")}

VISUAL SLOTS (insert image/chart placeholder at these positions):
${visualSlots.map((v) => `• After "${v.afterSection}": [${v.type.toUpperCase()}: ${v.description}]`).join("\n")}
`;
  } catch {
    return "";
  }
}
