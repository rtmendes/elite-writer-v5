import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { aiInterviews } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const TOPIC_PACKS: Record<string, Array<{ question: string }>> = {
  brand_foundations: [
    { question: "What is the core mission of your brand?" },
    { question: "What problem does your product/service solve?" },
    { question: "Who is your ideal customer? Describe them in detail." },
    { question: "What makes you different from competitors?" },
    { question: "What values drive your business decisions?" },
    { question: "How do you want customers to feel when interacting with your brand?" },
    { question: "What's your brand's origin story?" },
    { question: "If your brand were a person, how would you describe their personality?" },
  ],
  content_strategy: [
    { question: "What topics does your audience care most about?" },
    { question: "Which platforms drive the most engagement for you?" },
    { question: "What content format resonates best with your audience?" },
    { question: "What's your current content publishing cadence?" },
    { question: "What content from competitors do you admire?" },
    { question: "What are the top 3 questions your customers ask?" },
    { question: "What content has performed best for you historically?" },
    { question: "What's your content quality bar — what's non-negotiable?" },
  ],
  audience_deep_dive: [
    { question: "Where does your target audience spend time online?" },
    { question: "What frustrations does your audience have with existing solutions?" },
    { question: "What aspirations drive your audience's purchasing decisions?" },
    { question: "How does your audience discover new products/services like yours?" },
    { question: "What language and terminology does your audience use?" },
    { question: "What objections do they have before purchasing?" },
    { question: "What triggers a purchase decision for your audience?" },
    { question: "Describe your most loyal customer and what keeps them coming back." },
  ],
};

export const interviewsRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      brandId: z.number().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = [eq(aiInterviews.userId, ctx.user.id)];
      if (input?.status) {
        conditions.push(sql`${aiInterviews.status} = ${input.status}`);
      }
      if (input?.brandId) {
        conditions.push(eq(aiInterviews.brandId, input.brandId));
      }
      return db.select().from(aiInterviews)
        .where(and(...conditions))
        .orderBy(desc(aiInterviews.updatedAt))
        .limit(input?.limit ?? 50);
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      topic: z.string().optional(),
      topicPack: z.enum(["brand_foundations", "content_strategy", "audience_deep_dive", "custom"]).default("custom"),
      brandId: z.number().optional(),
      customQuestions: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let questions: Array<{ id: string; question: string; answer: string | null; order: number }>;

      if (input.topicPack === "custom" && input.customQuestions?.length) {
        questions = input.customQuestions.map((q, i) => ({
          id: randomUUID(),
          question: q,
          answer: null,
          order: i,
        }));
      } else {
        const pack = TOPIC_PACKS[input.topicPack] || TOPIC_PACKS.brand_foundations;
        questions = pack.map((q, i) => ({
          id: randomUUID(),
          question: q.question,
          answer: null,
          order: i,
        }));
      }

      const [result] = await db.insert(aiInterviews).values({
        userId: ctx.user.id,
        title: input.title,
        topic: input.topic,
        topicPack: input.topicPack,
        brandId: input.brandId,
        questions,
        status: "not_started",
        completeness: 0,
      } as any);
      return { id: result.insertId };
    }),

  answerQuestion: protectedProcedure
    .input(z.object({
      interviewId: z.number(),
      questionId: z.string(),
      answer: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [interview] = await db.select().from(aiInterviews)
        .where(and(eq(aiInterviews.id, input.interviewId), eq(aiInterviews.userId, ctx.user.id)));

      if (!interview) throw new Error("Interview not found");

      const questions = (interview.questions as any[]) || [];
      const updated = questions.map(q =>
        q.id === input.questionId ? { ...q, answer: input.answer } : q
      );
      const answered = updated.filter(q => q.answer).length;
      const completeness = Math.round((answered / updated.length) * 100);
      const status = completeness === 100 ? "completed" : completeness > 0 ? "in_progress" : "not_started";

      await db.update(aiInterviews).set({
        questions: updated,
        completeness,
        status,
      } as any).where(eq(aiInterviews.id, input.interviewId));

      return { success: true, completeness, status };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      topic: z.string().optional(),
      extractedInsights: z.array(z.string()).optional(),
      status: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      await db.update(aiInterviews)
        .set(data as any)
        .where(and(eq(aiInterviews.id, id), eq(aiInterviews.userId, ctx.user.id)));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(aiInterviews)
        .where(and(eq(aiInterviews.id, input.id), eq(aiInterviews.userId, ctx.user.id)));
      return { success: true };
    }),

  getTopicPacks: protectedProcedure.query(() => {
    return Object.entries(TOPIC_PACKS).map(([key, questions]) => ({
      id: key,
      name: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      questionCount: questions.length,
      questions: questions.map(q => q.question),
    }));
  }),
});
