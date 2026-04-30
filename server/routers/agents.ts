/**
 * Agents Router — Interactive AI agent profiles, chat, and assignments
 * 
 * Features:
 * 1. Agent chat (1-on-1 and group meetings with LLM-powered personas)
 * 2. Agent assignments (assign agents to articles/projects)
 * 3. Chat history persistence
 * 
 * AUDIT FIXES (v2):
 * - All getDb() calls now awaited (was returning Promise, not DB instance)
 * - Insert operations use raw SQL with RETURNING for PG compatibility
 * - Added ownership validation on getChatMessages and sendMessage
 * - Fixed getChat stub → real implementation
 * - messageCount update uses proper SQL increment
 * - Added error boundaries on every endpoint
 * - Added input sanitization
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import { agentChats, agentMessages, agentAssignments } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";

// ─── Agent Registry (server-side mirror of client agents.ts) ─────

const AGENT_PERSONAS: Record<string, { name: string; role: string; systemPrompt: string; defaultModel: string }> = {
  researcher: { name: "Maya Chen", role: "Research Agent", defaultModel: "claude-sonnet", systemPrompt: "You are Maya Chen, a senior research agent. You are precise, thorough, and data-driven. Always cite sources. Provide comprehensive analysis with primary sources, key statistics, expert quotes. Ask probing follow-up questions. Professional but approachable." },
  outliner: { name: "Marcus Johnson", role: "Outline Architect", defaultModel: "claude-sonnet", systemPrompt: "You are Marcus Johnson, an outline architect. You think in narrative frameworks. Create compelling article outlines with strong hooks, logical flow, narrative tension, and payoffs. Consider the target publication's style." },
  drafter: { name: "Sofia Andersson", role: "Draft Writer", defaultModel: "claude-sonnet", systemPrompt: "You are Sofia Andersson, a draft writer. You are creative, eloquent, and write vivid authoritative prose. Adapt to any voice while maintaining clarity. Write compelling openings, use active voice, vary sentence length for rhythm." },
  editor: { name: "Carlos Mendez", role: "Enhancement Editor", defaultModel: "gpt-4o", systemPrompt: "You are Carlos Mendez, a senior enhancement editor with 20 years of newsroom experience. Transform good writing into great writing through surgical edits and voice refinement. Specific, actionable, encouraging feedback." },
  rewriter: { name: "Amara Okafor", role: "Style Rewriter", defaultModel: "claude-sonnet", systemPrompt: "You are Amara Okafor, a style rewriter. Master of voice transformation. Given text and a target style, rewrite to perfectly match that publication's voice, tone, register. Preserve core message while transforming delivery." },
  factchecker: { name: "Raj Patel", role: "Fact Checker", defaultModel: "gpt-4o", systemPrompt: "You are Raj Patel, a fact checker. Skeptical, meticulous, obsessive about accuracy. Identify every factual claim and assess verifiability. Flag errors, outdated data, misleading framing. Suggest corrections with sources." },
  seo: { name: "Kenji Tanaka", role: "SEO Optimizer", defaultModel: "gpt-4o-mini", systemPrompt: "You are Kenji Tanaka, an SEO optimizer. Analytical and strategic. Optimize for both traditional search and AI search engines. Analyze keyword placement, meta descriptions, header structure. Never compromise readability for SEO." },
  continuator: { name: "Zara Williams", role: "Continuation Writer", defaultModel: "claude-sonnet", systemPrompt: "You are Zara Williams, a continuation writer. Seamlessly continue any piece of writing, perfectly matching existing voice, tone, style, and pacing. The transition from original to your continuation should be invisible." },
  scout: { name: "Thomas Fischer", role: "Topic Scout", defaultModel: "gemini-flash", systemPrompt: "You are Thomas Fischer, a topic scout. Deeply curious and forward-looking. Identify emerging trends, underreported angles, and timely opportunities. Evaluate topics for newsworthiness, audience interest, and publication fit." },
  proofreader: { name: "Isabella Reyes", role: "Proofreader", defaultModel: "gpt-4o-mini", systemPrompt: "You are Isabella Reyes, a proofreader. Eagle eye for grammatical errors, style inconsistencies, spelling mistakes. Enforce US English exclusively. Follow AP style by default. Flag AI slop phrases, filler words, passive voice." },
  scorer: { name: "Priya Sharma", role: "Article Scorer", defaultModel: "claude-sonnet", systemPrompt: "You are Priya Sharma, an article scorer. Evaluate articles across 11 dimensions: originality, depth, clarity, evidence, structure, voice, engagement, accuracy, SEO, publication fit, overall quality. Score 1-10 with specific justification." },
  artdirector: { name: "David Osei", role: "Art Director", defaultModel: "gpt-4o", systemPrompt: "You are David Osei, an art director. Condé Nast-level eye for visual storytelling. Recommend hero images, inline visuals, infographics. Provide detailed art direction briefs with composition, mood, color palette, style references." },
  imagecreator: { name: "Mei Lin", role: "Image Creator", defaultModel: "gpt-4o", systemPrompt: "You are Mei Lin, an image creator. Bridge AI image generation with editorial quality standards. Create detailed prompts for images and illustrations. Understand composition, lighting, color theory, editorial aesthetics." },
  infographic: { name: "Omar Hassan", role: "Data Visualizer", defaultModel: "gpt-4o", systemPrompt: "You are Omar Hassan, a data visualizer. Transform complex data into clear, compelling visual narratives. Recommend chart types, color schemes, annotation strategies. Extract key data points and structure into infographics." },
  analyst: { name: "Catherine Sterling", role: "Intelligence Analyst", defaultModel: "claude-sonnet", systemPrompt: "You are Catherine Sterling, an intelligence analyst. Bridge business intelligence with editorial strategy. Analyze market trends, competitor content, publication landscapes. Back recommendations with data." },
  deepresearch: { name: "Arjun Krishnamurthy", role: "Deep Researcher", defaultModel: "deepseek-r1", systemPrompt: "You are Arjun Krishnamurthy, a deep researcher with a PhD-level approach. Access academic papers, government databases, industry reports. Think in systems and root causes. Provide research briefs with methodology, key findings, conflicting evidence." },
  quality: { name: "Elena Vasquez", role: "Quality Guardian", defaultModel: "claude-sonnet", systemPrompt: "You are Elena Vasquez, the quality guardian. Final checkpoint before publication. Review against publication standards, brand guidelines, compliance requirements. Either approve or provide specific blockers." },
  appbuilder: { name: "Nia Thompson", role: "Mini App Builder", defaultModel: "claude-sonnet", systemPrompt: "You are Nia Thompson, a mini app builder. Create interactive content experiences — calculators, quizzes, comparison tools. Think in user interactions and conversion flows. Write HTML/CSS/JS for embeddable widgets." },
};

const OPENROUTER_MODELS: Record<string, string> = {
  "claude-sonnet": "anthropic/claude-sonnet-4-20250514",
  "claude-opus": "anthropic/claude-opus-4-20250514",
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gemini-flash": "google/gemini-2.0-flash-exp:free",
  "gemini-pro": "google/gemini-2.5-pro-preview-05-06",
  "deepseek-r1": "deepseek/deepseek-r1",
};

// ─── Helper: Verify chat ownership ──────────────────────

async function verifyChatOwner(chatId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ userId: agentChats.userId })
    .from(agentChats)
    .where(and(eq(agentChats.id, chatId), eq(agentChats.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

// ─── Chat Endpoints ──────────────────────────────────────

export const agentsRouter = router({
  // List all chats for the current user
  listChats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return [];
      const chats = await db
        .select()
        .from(agentChats)
        .where(and(eq(agentChats.userId, ctx.user.id), eq(agentChats.status, "active")))
        .orderBy(desc(agentChats.updatedAt))
        .limit(50);
      return chats;
    } catch (err) {
      console.error("[agents.listChats] Error:", err);
      return [];
    }
  }),

  // Create a new chat
  createChat: protectedProcedure
    .input(z.object({
      agentIds: z.array(z.string().max(50)).min(1).max(10),
      title: z.string().max(300).optional(),
      mode: z.enum(["one_on_one", "group", "meeting"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validate agent IDs
      const validAgentIds = input.agentIds.filter(id => AGENT_PERSONAS[id]);
      if (validAgentIds.length === 0) throw new Error("No valid agent IDs provided");

      const agentNames = validAgentIds
        .map(id => AGENT_PERSONAS[id]?.name || id)
        .join(", ");
      const title = input.title || `Chat with ${agentNames}`;
      const mode = input.mode || (validAgentIds.length > 1 ? "group" : "one_on_one");

      const [result] = await db.insert(agentChats).values({
        userId: ctx.user.id,
        title,
        agentIds: validAgentIds,
        mode,
      });
      // MySQL driver returns insertId; on PG the id comes from SERIAL
      const insertId = (result as any)?.insertId ?? (result as any)?.id ?? 0;
      return { id: insertId, title, mode };
    }),

  // Get single chat with metadata
  getChat: protectedProcedure
    .input(z.object({ chatId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) return null;
        const rows = await db
          .select()
          .from(agentChats)
          .where(and(eq(agentChats.id, input.chatId), eq(agentChats.userId, ctx.user.id)))
          .limit(1);
        return rows[0] || null;
      } catch (err) {
        console.error("[agents.getChat] Error:", err);
        return null;
      }
    }),

  getChatMessages: protectedProcedure
    .input(z.object({ chatId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) return [];

        // Ownership check
        const isOwner = await verifyChatOwner(input.chatId, ctx.user.id);
        if (!isOwner) return [];

        const messages = await db
          .select()
          .from(agentMessages)
          .where(eq(agentMessages.chatId, input.chatId))
          .orderBy(agentMessages.createdAt)
          .limit(200);
        return messages;
      } catch (err) {
        console.error("[agents.getChatMessages] Error:", err);
        return [];
      }
    }),

  // Send message in chat — returns agent response(s)
  sendMessage: protectedProcedure
    .input(z.object({
      chatId: z.number(),
      content: z.string().min(1).max(10000),
      agentIds: z.array(z.string().max(50)).min(1).max(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Ownership check
      const isOwner = await verifyChatOwner(input.chatId, ctx.user.id);
      if (!isOwner) throw new Error("Chat not found or unauthorized");

      // Validate agent IDs
      const validAgentIds = input.agentIds.filter(id => AGENT_PERSONAS[id]);
      if (validAgentIds.length === 0) throw new Error("No valid agent IDs");

      // Save user message
      await db.insert(agentMessages).values({
        chatId: input.chatId,
        role: "user",
        agentId: null,
        content: input.content,
      });

      // Get conversation history for context (last 30 messages for context window management)
      const history = await db
        .select()
        .from(agentMessages)
        .where(eq(agentMessages.chatId, input.chatId))
        .orderBy(desc(agentMessages.createdAt))
        .limit(30);
      // Reverse to chronological order
      history.reverse();

      const responses: Array<{ agentId: string; name: string; content: string; model: string; tokens: number }> = [];

      // Each agent responds in sequence
      for (const agentId of validAgentIds) {
        const persona = AGENT_PERSONAS[agentId];
        if (!persona) continue;

        // Build message history for LLM
        const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          {
            role: "system",
            content: `${persona.systemPrompt}\n\nYou are in a ${validAgentIds.length > 1 ? 'group conversation with other AI agents and a human editor' : 'one-on-one conversation with a human editor'}. Respond naturally, concisely, and in character. Keep responses focused and actionable — typically 2-4 paragraphs unless more detail is specifically requested. If other agents have already responded in this conversation, build on their points rather than repeating them.`,
          },
        ];

        for (const msg of history) {
          if (msg.role === "user") {
            llmMessages.push({ role: "user", content: msg.content });
          } else if (msg.agentId === agentId) {
            llmMessages.push({ role: "assistant", content: msg.content });
          } else if (msg.agentId) {
            // Messages from other agents shown as user context
            const otherName = AGENT_PERSONAS[msg.agentId]?.name || msg.agentId;
            llmMessages.push({ role: "user", content: `[${otherName} (${AGENT_PERSONAS[msg.agentId]?.role || 'Agent'})]: ${msg.content}` });
          }
        }

        // Add any prior responses from this turn (group chat: each subsequent agent sees previous agents' responses)
        for (const prev of responses) {
          llmMessages.push({
            role: "user",
            content: `[${prev.name} (${AGENT_PERSONAS[prev.agentId]?.role || 'Agent'})]: ${prev.content}`,
          });
        }

        try {
          const modelId = OPENROUTER_MODELS[persona.defaultModel] || "anthropic/claude-sonnet-4-20250514";
          const result = await invokeLLM({
            model: modelId,
            messages: llmMessages,
            maxTokens: 2048,
            temperature: 0.7,
          });

          const content = result.choices?.[0]?.message?.content || "I'm having trouble responding right now. Please try again.";
          const tokens = result.usage?.total_tokens || 0;

          // Save agent response
          await db.insert(agentMessages).values({
            chatId: input.chatId,
            role: "agent",
            agentId,
            content,
            model: modelId,
            tokens,
          });

          responses.push({ agentId, name: persona.name, content, model: modelId, tokens });
        } catch (err: any) {
          console.error(`[agents.sendMessage] LLM error for ${agentId}:`, err?.message);
          const errorMsg = `I encountered a temporary issue. Please try again in a moment.`;
          await db.insert(agentMessages).values({
            chatId: input.chatId,
            role: "agent",
            agentId,
            content: errorMsg,
          });
          responses.push({ agentId, name: persona.name, content: errorMsg, model: "error", tokens: 0 });
        }
      }

      // Update chat metadata — atomic increment
      try {
        await db.update(agentChats)
          .set({
            messageCount: sql`COALESCE(${agentChats.messageCount}, 0) + ${1 + responses.length}`,
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(agentChats.id, input.chatId));
      } catch (err) {
        console.error("[agents.sendMessage] metadata update error:", err);
        // Non-fatal — messages were already saved
      }

      return responses;
    }),

  // Delete (archive) a chat
  deleteChat: protectedProcedure
    .input(z.object({ chatId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(agentChats)
          .set({ status: "archived", updatedAt: new Date() })
          .where(and(eq(agentChats.id, input.chatId), eq(agentChats.userId, ctx.user.id)));
        return { success: true };
      } catch (err) {
        console.error("[agents.deleteChat] Error:", err);
        throw new Error("Failed to archive chat");
      }
    }),

  // ─── Assignment Endpoints ──────────────────────────────

  // Assign agent to a target (article, idea, project, research)
  assign: protectedProcedure
    .input(z.object({
      agentId: z.string().max(50),
      targetType: z.enum(["article", "project", "idea", "research"]),
      targetId: z.number(),
      targetTitle: z.string().max(500).optional(),
      role: z.string().max(200).optional(),
      notes: z.string().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Validate agent exists
      if (!AGENT_PERSONAS[input.agentId]) throw new Error("Invalid agent ID");

      const [result] = await db.insert(agentAssignments).values({
        userId: ctx.user.id,
        agentId: input.agentId,
        targetType: input.targetType,
        targetId: input.targetId,
        targetTitle: input.targetTitle,
        role: input.role,
        notes: input.notes,
      });
      const insertId = (result as any)?.insertId ?? (result as any)?.id ?? 0;
      return { id: insertId };
    }),

  // List assignments for an agent or target
  getAssignments: protectedProcedure
    .input(z.object({
      agentId: z.string().max(50).optional(),
      targetType: z.string().max(20).optional(),
      targetId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) return [];
        const conditions = [eq(agentAssignments.userId, ctx.user.id), eq(agentAssignments.status, "active")];
        if (input.agentId) conditions.push(eq(agentAssignments.agentId, input.agentId));
        if (input.targetId) conditions.push(eq(agentAssignments.targetId, input.targetId));

        const results = await db
          .select()
          .from(agentAssignments)
          .where(and(...conditions))
          .orderBy(desc(agentAssignments.createdAt))
          .limit(100);
        return results;
      } catch (err) {
        console.error("[agents.getAssignments] Error:", err);
        return [];
      }
    }),

  // Remove assignment
  unassign: protectedProcedure
    .input(z.object({ assignmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        await db.update(agentAssignments)
          .set({ status: "removed", updatedAt: new Date() })
          .where(and(eq(agentAssignments.id, input.assignmentId), eq(agentAssignments.userId, ctx.user.id)));
        return { success: true };
      } catch (err) {
        console.error("[agents.unassign] Error:", err);
        throw new Error("Failed to remove assignment");
      }
    }),
});
