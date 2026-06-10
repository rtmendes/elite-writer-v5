/**
 * Agents Router — Interactive AI agent profiles, chat, and assignments
 * 
 * Features:
 * 1. Agent chat (1-on-1 and group meetings with LLM-powered personas)
 * 2. KB-augmented responses — agents search knowledge base before responding
 * 3. Persistent agent memory — facts extracted and recalled across sessions
 * 4. Article/project context — agents can access user's content
 * 5. Agent assignments (assign agents to articles/projects)
 * 6. Chat history persistence
 * 
 * v3 UPGRADE:
 * - Full KB integration — every agent response is RAG-augmented
 * - Agent memory system — auto-extract facts, recall per-agent memories
 * - Article context injection — agents see relevant articles/ideas/research
 * - Brand context awareness — agents know the user's brands and voice
 * - System-wide context — agents understand the enterprise platform
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import { getDb } from "../db";
import {
  agentChats, agentMessages, agentAssignments, agentMemories,
  kbItems, articles, ideas, researchNotes, brands,
} from "../../drizzle/schema";
import { eq, and, desc, sql, like, or } from "drizzle-orm";

// ─── Agent Registry (server-side mirror of client agents.ts) ─────

export const AGENT_PERSONAS: Record<string, { name: string; role: string; systemPrompt: string; defaultModel: string }> = {
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
  "claude-sonnet": "anthropic/claude-sonnet-4",
  "claude-opus": "anthropic/claude-opus-4",
  "gpt-4o": "openai/gpt-4o",
  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gemini-flash": "google/gemini-2.5-flash",
  "gemini-pro": "google/gemini-2.5-pro",
  "deepseek-r1": "deepseek/deepseek-r1",
  "llama-70b": "meta-llama/llama-3.3-70b-instruct",
  "qwen-72b": "qwen/qwen-2.5-72b-instruct",
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

// ─── Helper: Search KB for relevant context ─────────────

async function searchKBForContext(userId: number, query: string, limit: number = 5): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";

    // Keyword-based search across KB items
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (queryWords.length === 0) return "";

    const allKB = await db.select({
      title: kbItems.title,
      content: kbItems.content,
      category: kbItems.category,
      tags: kbItems.tags,
    }).from(kbItems)
      .where(eq(kbItems.userId, userId))
      .limit(200);

    if (allKB.length === 0) return "";

    // Score and rank by keyword relevance
    const scored = allKB
      .map(item => {
        const searchText = `${item.title || ""} ${item.content || ""} ${JSON.stringify(item.tags || [])}`.toLowerCase();
        const matches = queryWords.filter(w => searchText.includes(w)).length;
        return { ...item, score: matches / queryWords.length };
      })
      .filter(item => item.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (scored.length === 0) return "";

    const kbContext = scored.map(item =>
      `• ${item.title}${item.category ? ` [${item.category}]` : ""}: ${(item.content || "").slice(0, 400)}`
    ).join("\n");

    return `\n\n--- KNOWLEDGE BASE CONTEXT ---\nRelevant knowledge items found:\n${kbContext}\n--- END KB CONTEXT ---`;
  } catch (err) {
    console.error("[agents.searchKB] Error:", err);
    return "";
  }
}

// ─── Helper: Get agent memories ─────────────────────────

async function getAgentMemories(userId: number, agentId: string, limit: number = 15): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";

    const memories = await db.select({
      fact: agentMemories.fact,
      category: agentMemories.category,
      importance: agentMemories.importance,
    }).from(agentMemories)
      .where(and(
        eq(agentMemories.userId, userId),
        eq(agentMemories.agentId, agentId)
      ))
      .orderBy(desc(agentMemories.importance))
      .limit(limit);

    if (memories.length === 0) return "";

    const memoryText = memories.map(m =>
      `• ${m.category ? `[${m.category}] ` : ""}${m.fact}`
    ).join("\n");

    return `\n\n--- YOUR MEMORIES ABOUT THIS USER ---\n${memoryText}\n--- END MEMORIES ---`;
  } catch (err) {
    console.error("[agents.getMemories] Error:", err);
    return "";
  }
}

// ─── Helper: Get relevant articles/ideas context ────────

async function getContentContext(userId: number, query: string, limit: number = 5): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";

    const parts: string[] = [];

    // Recent articles
    const recentArticles = await db.select({
      title: articles.title,
      status: articles.status,
      wordCount: articles.wordCount,
      overallScore: articles.overallScore,
      targetPublication: articles.targetPublication,
      content: articles.content,
    }).from(articles)
      .where(eq(articles.userId, userId))
      .orderBy(desc(articles.updatedAt))
      .limit(limit);

    if (recentArticles.length > 0) {
      const articleSummary = recentArticles.map(a =>
        `• "${a.title}" — ${a.status}${a.wordCount ? `, ${a.wordCount} words` : ""}${a.overallScore ? `, score: ${a.overallScore}` : ""}${a.targetPublication ? `, target: ${a.targetPublication}` : ""}`
      ).join("\n");
      parts.push(`Recent Articles:\n${articleSummary}`);
    }

    // Active ideas
    const activeIdeas = await db.select({
      title: ideas.title,
      angle: ideas.angle,
      status: ideas.status,
      category: ideas.category,
    }).from(ideas)
      .where(and(eq(ideas.userId, userId)))
      .orderBy(desc(ideas.updatedAt))
      .limit(limit);

    if (activeIdeas.length > 0) {
      const ideaSummary = activeIdeas.map(i =>
        `• "${i.title}" — ${i.status}${i.category ? ` [${i.category}]` : ""}${i.angle ? `: ${i.angle.slice(0, 100)}` : ""}`
      ).join("\n");
      parts.push(`Active Ideas:\n${ideaSummary}`);
    }

    // Research notes
    const notes = await db.select({
      title: researchNotes.title,
      content: researchNotes.content,
    }).from(researchNotes)
      .where(eq(researchNotes.userId, userId))
      .orderBy(desc(researchNotes.updatedAt))
      .limit(3);

    if (notes.length > 0) {
      const noteSummary = notes.map(n =>
        `• "${n.title}": ${(n.content || "").slice(0, 200)}`
      ).join("\n");
      parts.push(`Research Notes:\n${noteSummary}`);
    }

    // Brands
    const userBrands = await db.select({
      name: brands.name,
      niche: brands.niche,
      description: brands.description,
    }).from(brands)
      .where(eq(brands.userId, userId))
      .limit(5);

    if (userBrands.length > 0) {
      const brandSummary = userBrands.map(b =>
        `• ${b.name}${b.niche ? ` (${b.niche})` : ""}${b.description ? `: ${b.description.slice(0, 100)}` : ""}`
      ).join("\n");
      parts.push(`Brands:\n${brandSummary}`);
    }

    if (parts.length === 0) return "";

    return `\n\n--- USER'S CONTENT & PROJECTS ---\n${parts.join("\n\n")}\n--- END CONTENT CONTEXT ---`;
  } catch (err) {
    console.error("[agents.getContentContext] Error:", err);
    return "";
  }
}

// ─── Helper: Extract memories from conversation ─────────

async function extractAndSaveMemories(
  userId: number,
  agentId: string,
  chatId: number,
  userMessage: string,
  agentResponse: string
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Use LLM to extract facts worth remembering
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You extract important facts from conversations that an AI agent should remember for future interactions. Focus on:
- User preferences (writing style, topics of interest, target publications)
- Project details (deadlines, goals, specific requirements)
- Feedback patterns (what the user liked/disliked)
- Personal context (role, expertise, brand focus)

Return ONLY valid JSON. If nothing important to remember, return {"facts":[]}.`,
        },
        {
          role: "user",
          content: `User said: "${userMessage.slice(0, 1000)}"\n\nAgent responded: "${agentResponse.slice(0, 1000)}"\n\nExtract important facts to remember. Return JSON:\n{"facts":[{"fact":"<concise fact>","category":"<preference|project|style|feedback|context>","importance":<1-10>}]}`,
        },
      ],
      maxTokens: 512,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const text = result.choices?.[0]?.message?.content || "{}";
    let parsed: { facts?: Array<{ fact: string; category?: string; importance?: number }> };
    try { parsed = JSON.parse(text); } catch { return; }

    if (!parsed.facts || parsed.facts.length === 0) return;

    // Only save high-importance facts (≥ 5)
    const validFacts = parsed.facts.filter(f => f.fact && (f.importance || 5) >= 5);

    for (const fact of validFacts.slice(0, 3)) { // Max 3 per message
      try {
        await db.insert(agentMemories).values({
          userId,
          agentId,
          fact: fact.fact.slice(0, 1000),
          category: fact.category || "context",
          importance: Math.min(10, Math.max(1, fact.importance || 5)),
          sourceChatId: chatId,
        });
      } catch { /* skip duplicates or errors */ }
    }
  } catch (err) {
    // Memory extraction is non-critical — never block the response
    console.error("[agents.extractMemories] Error:", err);
  }
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

  // Send message in chat — returns KB-augmented agent response(s)
  sendMessage: protectedProcedure
    .input(z.object({
      chatId: z.number(),
      content: z.string().min(1).max(10000),
      agentIds: z.array(z.string().max(50)).min(1).max(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const isOwner = await verifyChatOwner(input.chatId, ctx.user.id);
      if (!isOwner) throw new Error("Chat not found or unauthorized");

      const validAgentIds = input.agentIds.filter(id => AGENT_PERSONAS[id]);
      if (validAgentIds.length === 0) throw new Error("No valid agent IDs");

      // Save user message
      await db.insert(agentMessages).values({
        chatId: input.chatId,
        role: "user",
        agentId: null,
        content: input.content,
      });

      // Get conversation history (last 30 messages)
      const history = await db
        .select()
        .from(agentMessages)
        .where(eq(agentMessages.chatId, input.chatId))
        .orderBy(desc(agentMessages.createdAt))
        .limit(30);
      history.reverse();

      // ═══ RAG: Gather contextual intelligence ═══
      // Run KB search, memory retrieval, and content context in parallel
      const [kbContext, contentContext] = await Promise.all([
        searchKBForContext(ctx.user.id, input.content, 5),
        getContentContext(ctx.user.id, input.content, 5),
      ]);

      const responses: Array<{ agentId: string; name: string; content: string; model: string; tokens: number }> = [];

      // Each agent responds in sequence
      for (const agentId of validAgentIds) {
        const persona = AGENT_PERSONAS[agentId];
        if (!persona) continue;

        // Get per-agent memories (in sequence to avoid overwhelming the DB)
        const agentMemoryContext = await getAgentMemories(ctx.user.id, agentId, 15);

        // Build RAG-augmented system prompt
        const contextBlock = [kbContext, agentMemoryContext, contentContext].filter(Boolean).join("");

        const isGroup = validAgentIds.length > 1;
        const systemContent = `${persona.systemPrompt}

You are in a ${isGroup ? 'group conversation with other AI agents and a human editor' : 'one-on-one conversation with a human editor'}.

CAPABILITIES:
- You have access to the user's Knowledge Base with relevant context injected below
- You remember facts from previous conversations with this user
- You can see the user's recent articles, ideas, research notes, and brands
- Use this context naturally — don't announce "I found in the KB" unless specifically relevant

RESPONSE GUIDELINES:
- Respond naturally, concisely, and in character
- Keep responses focused and actionable — typically 2-4 paragraphs unless more detail is specifically requested
- Reference specific articles, ideas, or KB items when relevant
- If other agents have responded in this conversation, build on their points
${contextBlock}`;

        // Build message history for LLM
        const llmMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemContent },
        ];

        for (const msg of history) {
          if (msg.role === "user") {
            llmMessages.push({ role: "user", content: msg.content });
          } else if (msg.agentId === agentId) {
            llmMessages.push({ role: "assistant", content: msg.content });
          } else if (msg.agentId) {
            const otherName = AGENT_PERSONAS[msg.agentId]?.name || msg.agentId;
            llmMessages.push({ role: "user", content: `[${otherName} (${AGENT_PERSONAS[msg.agentId]?.role || 'Agent'})]: ${msg.content}` });
          }
        }

        // Add prior responses from this turn (group chat)
        for (const prev of responses) {
          llmMessages.push({
            role: "user",
            content: `[${prev.name} (${AGENT_PERSONAS[prev.agentId]?.role || 'Agent'})]: ${prev.content}`,
          });
        }

        try {
          const modelId = OPENROUTER_MODELS[persona.defaultModel] || "anthropic/claude-sonnet-4";
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

          // Extract memories in the background (non-blocking)
          extractAndSaveMemories(ctx.user.id, agentId, input.chatId, input.content, content).catch(() => {});
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

      // Update chat metadata
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

  // ─── Memory Management ────────────────────────────────

  // List memories for a specific agent
  listMemories: protectedProcedure
    .input(z.object({
      agentId: z.string().max(50).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const db = await getDb();
        if (!db) return [];

        const conditions = [eq(agentMemories.userId, ctx.user.id)];
        if (input.agentId) conditions.push(eq(agentMemories.agentId, input.agentId));

        return db.select()
          .from(agentMemories)
          .where(and(...conditions))
          .orderBy(desc(agentMemories.importance))
          .limit(input.limit);
      } catch (err) {
        console.error("[agents.listMemories] Error:", err);
        return [];
      }
    }),

  // Manually add a memory for an agent
  addMemory: protectedProcedure
    .input(z.object({
      agentId: z.string().max(50),
      fact: z.string().min(1).max(2000),
      category: z.string().max(100).optional(),
      importance: z.number().min(1).max(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (!AGENT_PERSONAS[input.agentId]) throw new Error("Invalid agent ID");

      const [result] = await db.insert(agentMemories).values({
        userId: ctx.user.id,
        agentId: input.agentId,
        fact: input.fact,
        category: input.category || "context",
        importance: input.importance || 7,
      });
      const insertId = (result as any)?.insertId ?? (result as any)?.id ?? 0;
      return { id: insertId, success: true };
    }),

  // Delete a memory
  deleteMemory: protectedProcedure
    .input(z.object({ memoryId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(agentMemories)
        .where(and(eq(agentMemories.id, input.memoryId), eq(agentMemories.userId, ctx.user.id)));
      return { success: true };
    }),

  // Clear all memories for an agent
  clearMemories: protectedProcedure
    .input(z.object({ agentId: z.string().max(50) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(agentMemories)
        .where(and(eq(agentMemories.userId, ctx.user.id), eq(agentMemories.agentId, input.agentId)));
      return { success: true };
    }),

  // ─── Context Status (for UI indicators) ───────────────

  getContextStatus: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) return { kbItems: 0, memories: 0, articles: 0, ideas: 0, brands: 0 };

      const [kbCount] = await db.select({ count: sql<number>`count(*)` }).from(kbItems).where(eq(kbItems.userId, ctx.user.id));
      const [memCount] = await db.select({ count: sql<number>`count(*)` }).from(agentMemories).where(eq(agentMemories.userId, ctx.user.id));
      const [artCount] = await db.select({ count: sql<number>`count(*)` }).from(articles).where(eq(articles.userId, ctx.user.id));
      const [ideaCount] = await db.select({ count: sql<number>`count(*)` }).from(ideas).where(eq(ideas.userId, ctx.user.id));
      const [brandCount] = await db.select({ count: sql<number>`count(*)` }).from(brands).where(eq(brands.userId, ctx.user.id));

      return {
        kbItems: kbCount?.count || 0,
        memories: memCount?.count || 0,
        articles: artCount?.count || 0,
        ideas: ideaCount?.count || 0,
        brands: brandCount?.count || 0,
      };
    } catch (err) {
      console.error("[agents.getContextStatus] Error:", err);
      return { kbItems: 0, memories: 0, articles: 0, ideas: 0, brands: 0 };
    }
  }),

  // ─── Assignment Endpoints ──────────────────────────────

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
