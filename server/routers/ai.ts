import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

export const aiRouter = router({
  // Score an article against publication standards
  score: publicProcedure
    .input(
      z.object({
        title: z.string(),
        content: z.string(),
        targetPublication: z.string().optional(),
        brandVoice: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a Bloomberg-caliber editorial scoring engine. Score articles on 11 dimensions used by top-tier publications. Return ONLY valid JSON with no markdown formatting.`,
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
    "authority": { "score": <0-100>, "feedback": "<specific feedback>" }
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
            content: `You are an elite journalist and content strategist who writes for top-tier publications like Bloomberg, Forbes, Harvard Business Review, and The Atlantic. Write in a professional, authoritative voice with data-driven insights, compelling narratives, and expert-level analysis.${input.brandVoice ? ` Write in this brand voice: ${input.brandVoice}` : ""}`,
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
            content: `You are an expert pitch writer who has successfully placed articles in top-tier publications. Write concise, compelling pitch emails that editors actually respond to. Return ONLY valid JSON with no markdown formatting.`,
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
