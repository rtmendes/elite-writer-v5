import { z } from "zod";
import { like } from "drizzle-orm";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { publications } from "../../drizzle/schema";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GAP #2 + #3: Publication SOP data for server-side AI scoring & drafting
// This is duplicated from client-side for server-side access.
// Key publication SOPs that affect AI-powered scoring and content generation.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PUBLICATION_INSTRUCTIONS: Record<string, { audience: string; format: string; tone: string; filters: string }> = {
  'forbes': {
    audience: 'Business leaders, entrepreneurs, investors. 150M+ monthly visitors.',
    format: 'Thought leadership, first-person "I" voice, 800-1500 words, data + personal experience hybrid. Clear subheadings every 200-300 words.',
    tone: 'Authoritative yet accessible. Expert positioning without academic jargon. Direct and actionable.',
    filters: 'REQUIRES: data_evidence ≥ 6 (add 2-3 stats), expertise_depth ≥ 6, hook_engagement ≥ 6.5',
  },
  'bloomberg': {
    audience: 'C-suite, institutional investors, policy makers. Terminal-level data literacy.',
    format: 'Investigative/analytical journalism. 3+ named sources required. 2000-4000 words. Original analysis only.',
    tone: 'Authoritative, measured. Financial terminology without definition. No superlatives without data.',
    filters: 'REQUIRES: data_evidence ≥ 7 (financial data), publication_fit ≥ 7, originality_angle ≥ 7',
  },
  'harvard-business-review': {
    audience: 'Senior leaders, MBA graduates, management consultants, researchers.',
    format: 'Research-backed analysis with case studies. 1500-3000 words. Clear framework/model. Evidence-based.',
    tone: 'Scholarly but accessible. Structured argumentation. Nuanced, acknowledge counterarguments.',
    filters: 'REQUIRES: data_evidence ≥ 7 (research citations), actionability ≥ 7 (practical framework)',
  },
  'wired': {
    audience: 'Tech-curious professionals, digital culture enthusiasts, long-form narrative readers.',
    format: 'Long-form narrative tech journalism. 2000-5000 words. Scene-setting and character development. No listicles.',
    tone: 'Narrative and literary. Scene-setting openings. Intellectual curiosity as default mode.',
    filters: 'REQUIRES: hook_engagement ≥ 7 (narrative hooks), originality_angle ≥ 7, voice_tone ≥ 6.5',
  },
  'the-atlantic': {
    audience: 'Educated general audience interested in ideas, policy, culture, society. Essay readers.',
    format: 'Essay-length arguments (2000-6000 words). Historical context required. Contrarian viewpoints welcome.',
    tone: 'Intellectual, measured. Historical awareness. Willingness to sit with complexity. Elegant prose.',
    filters: 'REQUIRES: expertise_depth ≥ 7, originality_angle ≥ 7.5, clarity_structure ≥ 7',
  },
  'fast-company': {
    audience: 'Innovation-focused professionals, designers, startup founders, creative leaders.',
    format: 'Innovation profiles + analysis. 1000-2000 words. Design thinking angle. Company/person profiles with broader lessons.',
    tone: 'Energetic and forward-looking. Optimistic about innovation but not naive. Design-aware.',
    filters: 'REQUIRES: originality_angle ≥ 6.5 (innovation angle)',
  },
  'vox': {
    audience: 'Curious general audience wanting to understand complex topics. Policy-interested.',
    format: 'Explainer format: "Everything you need to know about X." 1500-3000 words. Question-based subheadings.',
    tone: 'Accessible and explanatory. No assumed knowledge. Data-driven but conversational.',
    filters: 'REQUIRES: clarity_structure ≥ 7 (explainer format)',
  },
  'new-york-times': {
    audience: 'Educated general audience. Paper of record. Highest editorial standards.',
    format: 'Feature reporting, investigative journalism. 1500-5000 words. 5+ named sources. Original reporting required.',
    tone: 'Precise, authoritative, understated. "Show, don\'t tell" journalism.',
    filters: 'REQUIRES: data_evidence ≥ 8 (original reporting), clarity_structure ≥ 7.5',
  },
  'cosmopolitan': {
    audience: 'Young women (18-34). Relationships, career, wellness, beauty, pop culture.',
    format: 'Voice-driven. 800-1500 words. Trend-forward. Personal experience + reported elements. Listicle format welcome.',
    tone: 'Fun, confident, slightly irreverent. Best friend giving advice. Inclusive language.',
    filters: 'REQUIRES: voice_tone ≥ 6.5 (match Cosmo voice)',
  },
  'scientific-american': {
    audience: 'Science-literate general audience. Expect peer-reviewed research translation.',
    format: 'Research translation. 1500-3000 words. Must cite specific studies. Expert-authored preferred.',
    tone: 'Precise and measured. Scientific rigor without jargon overload.',
    filters: 'REQUIRES: data_evidence ≥ 7.5 (research citations), expertise_depth ≥ 7',
  },
};

function getPublicationInstructions(pubId: string): string {
  const pub = PUBLICATION_INSTRUCTIONS[pubId];
  if (!pub) return '';
  return `\n\n=== PUBLICATION-SPECIFIC INSTRUCTIONS: ${pubId.toUpperCase()} ===\nAudience: ${pub.audience}\nFormat Requirements: ${pub.format}\nTone: ${pub.tone}\nQuality Gates: ${pub.filters}\n===\n\nApply these publication-specific standards strictly when scoring and generating content.`;
}

export const aiRouter = router({
  // Score an article against publication standards
  score: publicProcedure
    .input(
      z.object({
        title: z.string(),
        content: z.string(),
        targetPublication: z.string().optional(),
        brandVoice: z.string().optional(),
        audienceAvatar: z.string().optional(),
        editorPreferences: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Reader avatar + editor preferences: explicit input wins, then the
      // publications table, then the static SOP audience entry, then inference.
      let audienceAvatar = input.audienceAvatar || "";
      let editorPreferences = input.editorPreferences || "";
      if (input.targetPublication && (!audienceAvatar || !editorPreferences)) {
        try {
          const db = await getDb();
          if (!db) throw new Error("no db");
          const rows = await db
            .select()
            .from(publications)
            .where(like(publications.name, `%${input.targetPublication}%`))
            .limit(1);
          const pub = rows[0];
          if (pub) {
            if (!audienceAvatar && pub.audienceAvatar) audienceAvatar = pub.audienceAvatar;
            if (!editorPreferences && pub.editorPreferences) editorPreferences = pub.editorPreferences;
          }
        } catch {
          /* publications lookup is best-effort */
        }
        if (!audienceAvatar) {
          const sop = PUBLICATION_INSTRUCTIONS[input.targetPublication.toLowerCase()];
          if (sop?.audience) audienceAvatar = sop.audience;
        }
      }
      const readerBlock = audienceAvatar
        ? `\n\nTHE READER (avatar — judge reader_resonance against THIS person):\n${audienceAvatar}`
        : "\n\nTHE READER: no avatar provided — infer the publication's typical reader and judge reader_resonance against that profile.";
      const editorBlock = editorPreferences
        ? `\n\nTHE EDITOR (the gatekeeper's documented preferences — judge editor_alignment against these):\n${editorPreferences}`
        : "\n\nTHE EDITOR: no preferences provided — infer what this publication's editors consistently accept and reject.";
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a Bloomberg-caliber editorial scoring engine. Score articles on 13 dimensions used by top-tier publications. Apply publication-specific standards when a target publication is specified. Return ONLY valid JSON with no markdown formatting.${input.targetPublication ? getPublicationInstructions(input.targetPublication) : ''}${readerBlock}${editorBlock}`,
          },
          {
            role: "user",
            content: `Score this article for publication readiness.

Title: ${input.title}
${input.targetPublication ? `Target Publication: ${input.targetPublication}` : ""}
${input.brandVoice ? `Brand Voice: ${input.brandVoice}` : ""}

Article Content:
${input.content.slice(0, 8000)}

Return JSON with this exact structure:
{
  "overall": <number 0-100>,
  "dimensions": {
    "originality": { "score": <0-100>, "feedback": "<specific feedback>" },
    "depth": { "score": <0-100>, "feedback": "<specific feedback>" },
    "clarity": { "score": <0-100>, "feedback": "<specific feedback>" },
    "structure": { "score": <0-100>, "feedback": "<specific feedback>" },
    "evidence": { "score": <0-100>, "feedback": "<specific feedback>" },
    "voice": { "score": <0-100>, "feedback": "<specific feedback>" },
    "hook": { "score": <0-100>, "feedback": "<specific feedback>" },
    "seo": { "score": <0-100>, "feedback": "<specific feedback>" },
    "actionability": { "score": <0-100>, "feedback": "<specific feedback>" },
    "timeliness": { "score": <0-100>, "feedback": "<specific feedback>" },
    "authority": { "score": <0-100>, "feedback": "<specific feedback>" },
    "reader_resonance": { "score": <0-100>, "feedback": "<does it speak to THE READER's role, pains, vocabulary, sophistication>" },
    "editor_alignment": { "score": <0-100>, "feedback": "<does it match THE EDITOR's documented preferences and avoid their pet peeves>" }
  },
  "summary": "<2-3 sentence editorial assessment>",
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "recommendedTier": "<Tier 1|Tier 2|Tier 3>",
  "publicationFit": "<which type of publications this would fit best>"
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        return {
          success: true,
          data: JSON.parse(text),
          usage: result.usage,
        };
      } catch {
        return { success: true, data: { overall: 0, summary: text }, usage: result.usage };
      }
    }),

  // Generate a draft article from a topic/outline
  draft: publicProcedure
    .input(
      z.object({
        topic: z.string(),
        template: z.string().optional(),
        brandVoice: z.string().optional(),
        targetPublication: z.string().optional(),
        outline: z.string().optional(),
        wordCount: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an elite journalist and content strategist who writes for top-tier publications like Bloomberg, Forbes, Harvard Business Review, and The Atlantic. Write in a professional, authoritative voice with data-driven insights, compelling narratives, and expert-level analysis.${input.brandVoice ? ` Write in this brand voice: ${input.brandVoice}` : ""}${input.targetPublication ? getPublicationInstructions(input.targetPublication) : ""}`,
          },
          {
            role: "user",
            content: `Write a complete article draft.

Topic: ${input.topic}
${input.template ? `Template/Style: ${input.template}` : ""}
${input.targetPublication ? `Target Publication: ${input.targetPublication}` : ""}
${input.outline ? `Outline:\n${input.outline}` : ""}
Target Word Count: ${input.wordCount || 1500}

Write a publication-ready article with:
- A compelling headline
- A strong hook/lede paragraph
- Well-structured sections with subheadings
- Data points and expert insights (cite sources where relevant)
- A powerful conclusion with a call to action
- SEO-optimized for the topic

Return the full article in markdown format.`,
          },
        ],
        maxTokens: 4096,
      });

      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      return { success: true, text, usage: result.usage };
    }),

  // Generate a pitch email for a specific publication
  pitch: publicProcedure
    .input(
      z.object({
        articleTitle: z.string(),
        articleSummary: z.string(),
        publicationName: z.string(),
        editorName: z.string().optional(),
        writerBio: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert pitch writer who has successfully placed articles in top-tier publications. Write concise, compelling pitch emails that editors actually respond to. Return ONLY valid JSON with no markdown formatting.${input.publicationName ? getPublicationInstructions(input.publicationName) : ''}`,
          },
          {
            role: "user",
            content: `Generate a pitch email for this article.

Article Title: ${input.articleTitle}
Article Summary: ${input.articleSummary}
Target Publication: ${input.publicationName}
${input.editorName ? `Editor: ${input.editorName}` : ""}
${input.writerBio ? `Writer Bio: ${input.writerBio}` : ""}

Return JSON:
{
  "subject": "<compelling email subject line>",
  "body": "<full pitch email body with greeting, hook, article summary, why it fits this publication, writer credentials, and professional sign-off>",
  "followUpDate": "<suggested follow-up date, e.g. '7 days'>",
  "tips": ["<tip 1 for improving acceptance>", "<tip 2>"]
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        return { success: true, data: JSON.parse(text), usage: result.usage };
      } catch {
        return { success: true, data: { subject: "", body: text }, usage: result.usage };
      }
    }),

  // Generate research brief for a topic
  research: publicProcedure
    .input(
      z.object({
        topic: z.string(),
        depth: z.enum(["quick", "standard", "deep"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a senior research analyst at a Bloomberg-caliber newsroom. Produce comprehensive research briefs with data points, expert sources, and trend analysis. Return ONLY valid JSON with no markdown formatting.`,
          },
          {
            role: "user",
            content: `Create a ${input.depth || "standard"} research brief on: ${input.topic}

Return JSON:
{
  "topic": "${input.topic}",
  "summary": "<executive summary, 2-3 sentences>",
  "keyFindings": ["<finding 1>", "<finding 2>", "<finding 3>", "<finding 4>", "<finding 5>"],
  "dataPoints": [
    { "stat": "<statistic>", "source": "<source name>", "year": "<year>" }
  ],
  "expertSources": [
    { "name": "<expert name>", "title": "<title>", "relevance": "<why they matter>" }
  ],
  "trendAnalysis": "<paragraph analyzing current trends>",
  "angles": ["<unique angle 1>", "<unique angle 2>", "<unique angle 3>"],
  "competitorContent": ["<what top publications have covered>"],
  "suggestedHeadlines": ["<headline 1>", "<headline 2>", "<headline 3>"]
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        return { success: true, data: JSON.parse(text), usage: result.usage };
      } catch {
        return { success: true, data: { summary: text }, usage: result.usage };
      }
    }),

  // Generate article ideas based on trends and publication targets
  ideas: publicProcedure
    .input(
      z.object({
        topics: z.array(z.string()).optional(),
        publications: z.array(z.string()).optional(),
        count: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const count = input.count || 5;
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a senior editorial strategist at a top media company. Generate article ideas that are timely, data-driven, and aligned with what top publications are actively seeking. Return ONLY valid JSON with no markdown formatting.`,
          },
          {
            role: "user",
            content: `Generate ${count} high-potential article ideas.

${input.topics?.length ? `Focus topics: ${input.topics.join(", ")}` : "Cover trending business, technology, health, and finance topics."}
${input.publications?.length ? `Target publications: ${input.publications.join(", ")}` : ""}

Return JSON:
{
  "ideas": [
    {
      "title": "<compelling article title>",
      "hook": "<1-2 sentence hook that would grab an editor's attention>",
      "angle": "<unique angle or data-driven approach>",
      "targetPublications": ["<pub 1>", "<pub 2>"],
      "estimatedPay": "<estimated payment range>",
      "difficulty": "<easy|medium|hard>",
      "timeliness": "<why this is timely right now>",
      "topics": ["<topic1>", "<topic2>"]
    }
  ]
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        return { success: true, data: JSON.parse(text), usage: result.usage };
      } catch {
        return { success: true, data: { ideas: [] }, usage: result.usage };
      }
    }),

  // Generate daily intelligence brief
  dailyBrief: publicProcedure
    .input(
      z.object({
        topics: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a senior intelligence analyst producing a daily editorial brief for a premium content team. Focus on trending stories, data releases, and emerging narratives that present article opportunities. Return ONLY valid JSON with no markdown formatting.`,
          },
          {
            role: "user",
            content: `Generate today's intelligence brief for a content team.

${input.topics?.length ? `Priority topics: ${input.topics.join(", ")}` : "Cover business, technology, health, finance, and culture."}
Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}

Return JSON:
{
  "date": "${new Date().toISOString().split("T")[0]}",
  "headline": "<main editorial opportunity headline>",
  "summary": "<3-4 sentence overview of today's content landscape>",
  "topStories": [
    {
      "title": "<story title>",
      "summary": "<2-3 sentence summary>",
      "articleOpportunity": "<how to turn this into a paid article>",
      "suggestedAngle": "<unique angle>",
      "urgency": "<high|medium|low>"
    }
  ],
  "dataReleases": ["<upcoming data release or report>"],
  "trendingTopics": ["<trending topic 1>", "<trending topic 2>"],
  "actionItems": ["<specific action for the content team>"]
}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      try {
        return { success: true, data: JSON.parse(text), usage: result.usage };
      } catch {
        return { success: true, data: { summary: text }, usage: result.usage };
      }
    }),

  // Summarize content (for Giststack intelligence feed)
  summarize: publicProcedure
    .input(z.object({ text: z.string(), style: z.string().optional() }))
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a concise editorial summarizer. Produce ${input.style || "executive"} summaries that capture key insights and actionable takeaways.`,
          },
          {
            role: "user",
            content: `Summarize this content:\n\n${input.text.slice(0, 6000)}`,
          },
        ],
      });

      const text =
        typeof result.choices[0]?.message?.content === "string"
          ? result.choices[0].message.content
          : "";
      return { success: true, text, usage: result.usage };
    }),
});
