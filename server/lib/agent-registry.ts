/**
 * Agent registry SSOT bridge — editorial personas sync to gb.agents + ai_agents.
 * Local SEED_AGENT_PERSONAS holds prompts; registry holds canonical identity rows.
 * MySQL agent_chats/assignments remain operational — not a second persona registry.
 */
import { ENV } from "../_core/env";
import { createHash } from "node:crypto";

export type AgentPersona = {
  name: string;
  role: string;
  systemPrompt: string;
  defaultModel: string;
};

/** Seed prompts — used when registry row lacks prompt metadata */
export const SEED_AGENT_PERSONAS: Record<string, AgentPersona> = {
  researcher: { name: "Maya Chen", role: "Research Agent", defaultModel: "free-big", systemPrompt: "You are Maya Chen, a senior research agent. You are precise, thorough, and data-driven. Always cite sources. Provide comprehensive analysis with primary sources, key statistics, expert quotes. Ask probing follow-up questions. Professional but approachable." },
  outliner: { name: "Marcus Johnson", role: "Outline Architect", defaultModel: "free", systemPrompt: "You are Marcus Johnson, an outline architect. You think in narrative frameworks. Create compelling article outlines with strong hooks, logical flow, narrative tension, and payoffs. Consider the target publication's style." },
  drafter: { name: "Sofia Andersson", role: "Draft Writer", defaultModel: "free-big", systemPrompt: "You are Sofia Andersson, a draft writer. You are creative, eloquent, and write vivid authoritative prose. Adapt to any voice while maintaining clarity. Write compelling openings, use active voice, vary sentence length for rhythm." },
  editor: { name: "Carlos Mendez", role: "Enhancement Editor", defaultModel: "free-big", systemPrompt: "You are Carlos Mendez, a senior enhancement editor with 20 years of newsroom experience. Transform good writing into great writing through surgical edits and voice refinement. Specific, actionable, encouraging feedback." },
  rewriter: { name: "Amara Okafor", role: "Style Rewriter", defaultModel: "free-big", systemPrompt: "You are Amara Okafor, a style rewriter. Master of voice transformation. Given text and a target style, rewrite to perfectly match that publication's voice, tone, register. Preserve core message while transforming delivery." },
  factchecker: { name: "Raj Patel", role: "Fact Checker", defaultModel: "free-big", systemPrompt: "You are Raj Patel, a fact checker. Skeptical, meticulous, obsessive about accuracy. Identify every factual claim and assess verifiability. Flag errors, outdated data, misleading framing. Suggest corrections with sources." },
  seo: { name: "Kenji Tanaka", role: "SEO Optimizer", defaultModel: "free", systemPrompt: "You are Kenji Tanaka, an SEO optimizer. Analytical and strategic. Optimize for both traditional search and AI search engines. Analyze keyword placement, meta descriptions, header structure. Never compromise readability for SEO." },
  continuator: { name: "Zara Williams", role: "Continuation Writer", defaultModel: "free-big", systemPrompt: "You are Zara Williams, a continuation writer. Seamlessly continue any piece of writing, perfectly matching existing voice, tone, style, and pacing. The transition from original to your continuation should be invisible." },
  scout: { name: "Thomas Fischer", role: "Topic Scout", defaultModel: "free", systemPrompt: "You are Thomas Fischer, a topic scout. Deeply curious and forward-looking. Identify emerging trends, underreported angles, and timely opportunities. Evaluate topics for newsworthiness, audience interest, and publication fit." },
  proofreader: { name: "Isabella Reyes", role: "Proofreader", defaultModel: "free", systemPrompt: "You are Isabella Reyes, a proofreader. Eagle eye for grammatical errors, style inconsistencies, spelling mistakes. Enforce US English exclusively. Follow AP style by default. Flag AI slop phrases, filler words, passive voice." },
  scorer: { name: "Priya Sharma", role: "Article Scorer", defaultModel: "free", systemPrompt: "You are Priya Sharma, an article scorer. Evaluate articles across 11 dimensions: originality, depth, clarity, evidence, structure, voice, engagement, accuracy, SEO, publication fit, overall quality. Score 1-10 with specific justification." },
  artdirector: { name: "David Osei", role: "Art Director", defaultModel: "free", systemPrompt: "You are David Osei, an art director. Condé Nast-level eye for visual storytelling. Recommend hero images, inline visuals, infographics. Provide detailed art direction briefs with composition, mood, color palette, style references." },
  imagecreator: { name: "Mei Lin", role: "Image Creator", defaultModel: "free", systemPrompt: "You are Mei Lin, an image creator. Bridge AI image generation with editorial quality standards. Create detailed prompts for images and illustrations. Understand composition, lighting, color theory, editorial aesthetics." },
  infographic: { name: "Omar Hassan", role: "Data Visualizer", defaultModel: "free", systemPrompt: "You are Omar Hassan, a data visualizer. Transform complex data into clear, compelling visual narratives. Recommend chart types, color schemes, annotation strategies. Extract key data points and structure into infographics." },
  analyst: { name: "Catherine Sterling", role: "Intelligence Analyst", defaultModel: "free", systemPrompt: "You are Catherine Sterling, an intelligence analyst. Bridge business intelligence with editorial strategy. Analyze market trends, competitor content, publication landscapes. Back recommendations with data." },
  deepresearch: { name: "Arjun Krishnamurthy", role: "Deep Researcher", defaultModel: "free-big", systemPrompt: "You are Arjun Krishnamurthy, a deep researcher with a PhD-level approach. Access academic papers, government databases, industry reports. Think in systems and root causes. Provide research briefs with methodology, key findings, conflicting evidence." },
  quality: { name: "Elena Vasquez", role: "Quality Guardian", defaultModel: "free-big", systemPrompt: "You are Elena Vasquez, the quality guardian. Final checkpoint before publication. Review against publication standards, brand guidelines, compliance requirements. Either approve or provide specific blockers." },
  appbuilder: { name: "Nia Thompson", role: "Mini App Builder", defaultModel: "free-big", systemPrompt: "You are Nia Thompson, a mini app builder. Create interactive content experiences — calculators, quizzes, comparison tools. Think in user interactions and conversion flows. Write HTML/CSS/JS for embeddable widgets." },
};

/** Resolved personas — registry metadata merged with seed prompts */
export let AGENT_PERSONAS: Record<string, AgentPersona> = { ...SEED_AGENT_PERSONAS };

const REGISTRY_PREFIX = "ew-";

function ewAgentId(personaKey: string): string {
  return createHash("sha256").update(`elite-writer-v5:${personaKey}`).digest("hex").slice(0, 12);
}

function sbKey(): string {
  return ENV.supabaseServiceKey || ENV.supabaseAnonKey;
}

function gbHeaders(write = false): Record<string, string> {
  const k = sbKey();
  return {
    apikey: k,
    Authorization: `Bearer ${k}`,
    "Accept-Profile": "gb",
    ...(write ? { "Content-Profile": "gb", "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" } : {}),
  };
}

function publicHeaders(write = false): Record<string, string> {
  const k = sbKey();
  return {
    apikey: k,
    Authorization: `Bearer ${k}`,
    ...(write ? { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" } : {}),
  };
}

export type RegistrySyncResult = {
  configured: boolean;
  gbUpserted: number;
  aiAgentsUpserted: number;
  editorialCount: number;
  platformTotal: number | null;
  error: string | null;
};

/** Upsert editorial personas to gb.agents + ai_agents (SSOT) */
export async function syncEditorialAgentsToRegistry(): Promise<RegistrySyncResult> {
  if (!ENV.supabaseUrl || !sbKey()) {
    return { configured: false, gbUpserted: 0, aiAgentsUpserted: 0, editorialCount: Object.keys(SEED_AGENT_PERSONAS).length, platformTotal: null, error: "Supabase not configured" };
  }

  let gbUpserted = 0;
  let aiAgentsUpserted = 0;

  try {
    const gbRows = Object.entries(SEED_AGENT_PERSONAS).map(([key, p]) => ({
      agent_id: `${REGISTRY_PREFIX}${key}`,
      persona_name: p.name,
      role_title: p.role,
      type: "agent",
      agent_status: "active",
      source: "elite-writer-v5",
      division: null,
      department: ["Content", "Elite Writer"],
      notes: JSON.stringify({ ew_persona_key: key, default_model: p.defaultModel, registry: "gb.agents" }),
      key_skills: p.role,
    }));

    const gbRes = await fetch(`${ENV.supabaseUrl}/rest/v1/agents?on_conflict=agent_id`, {
      method: "POST",
      headers: gbHeaders(true),
      body: JSON.stringify(gbRows),
    });
    if (!gbRes.ok) throw new Error(`gb.agents upsert ${gbRes.status}: ${(await gbRes.text()).slice(0, 200)}`);
    gbUpserted = gbRows.length;

    const serviceKey = sbKey();
    for (const [personaKey, p] of Object.entries(SEED_AGENT_PERSONAS)) {
      const platform = `elite-writer-v5:${personaKey}`;
      const row = {
        id: ewAgentId(personaKey),
        name: p.name,
        source: "elite-writer-v5",
        role_type: "agent",
        status: "active",
        platform,
        category: "ai_agent",
        metadata: JSON.stringify({ ew_persona_key: personaKey, role: p.role, agent_id: `${REGISTRY_PREFIX}${personaKey}` }),
      };
      const existing = await fetch(
        `${ENV.supabaseUrl}/rest/v1/ai_agents?select=id&platform=eq.${encodeURIComponent(platform)}&limit=1`,
        { headers: publicHeaders(false) },
      );
      const existingRows = existing.ok ? ((await existing.json()) as Array<{ id: string }>) : [];
      const writeRes =
        existingRows.length > 0
          ? await fetch(`${ENV.supabaseUrl}/rest/v1/ai_agents?id=eq.${existingRows[0].id}`, {
              method: "PATCH",
              headers: publicHeaders(true),
              body: JSON.stringify(row),
            })
          : await fetch(`${ENV.supabaseUrl}/rest/v1/ai_agents`, {
              method: "POST",
              headers: publicHeaders(true),
              body: JSON.stringify(row),
            });
      if (!writeRes.ok) throw new Error(`ai_agents ${personaKey} ${writeRes.status}: ${(await writeRes.text()).slice(0, 200)}`);
      aiAgentsUpserted++;
    }

    return { configured: true, gbUpserted, aiAgentsUpserted, editorialCount: gbRows.length, platformTotal: null, error: null };
  } catch (err) {
    return {
      configured: true,
      gbUpserted,
      aiAgentsUpserted,
      editorialCount: Object.keys(SEED_AGENT_PERSONAS).length,
      platformTotal: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Load editorial persona metadata from gb.agents; merge with seed prompts */
export async function refreshAgentPersonasFromRegistry(): Promise<number> {
  if (!ENV.supabaseUrl || !sbKey()) return 0;

  try {
    const res = await fetch(
      `${ENV.supabaseUrl}/rest/v1/agents?select=agent_id,persona_name,role_title,notes&agent_id=like.ew-*&order=agent_id.asc`,
      { headers: gbHeaders(false) },
    );
    if (!res.ok) return 0;
    const rows = (await res.json()) as Array<{ agent_id: string; persona_name: string; role_title: string | null; notes: string | null }>;
    let merged = 0;
    for (const row of rows) {
      const key = row.agent_id.replace(/^ew-/, "");
      const seed = SEED_AGENT_PERSONAS[key];
      if (!seed) continue;
      AGENT_PERSONAS[key] = {
        ...seed,
        name: row.persona_name || seed.name,
        role: row.role_title || seed.role,
      };
      merged++;
    }
    return merged;
  } catch {
    return 0;
  }
}

export async function getRegistryCounts(): Promise<{ editorial: number; platformAgents: number }> {
  let editorial = Object.keys(AGENT_PERSONAS).length;
  let platformAgents = 0;
  if (!ENV.supabaseUrl || !sbKey()) return { editorial, platformAgents };

  try {
    const [ewRes, platRes] = await Promise.all([
      fetch(`${ENV.supabaseUrl}/rest/v1/agents?select=agent_id&agent_id=like.ew-*`, {
        headers: { ...gbHeaders(false), Prefer: "count=exact" },
      }),
      fetch(`${ENV.supabaseUrl}/rest/v1/ai_agents?select=name&category=eq.ai_agent`, {
        headers: { ...publicHeaders(false), Prefer: "count=exact" },
      }),
    ]);
    const ewCr = ewRes.headers.get("content-range");
    const platCr = platRes.headers.get("content-range");
    if (ewCr?.includes("/")) editorial = Number(ewCr.split("/")[1]) || editorial;
    if (platCr?.includes("/")) platformAgents = Number(platCr.split("/")[1]) || 0;
  } catch {
    /* degrade */
  }
  return { editorial, platformAgents };
}

let initPromise: Promise<RegistrySyncResult> | null = null;

/** Idempotent startup: sync + refresh editorial personas from gb.agents */
export function initAgentRegistry(): Promise<RegistrySyncResult> {
  if (!initPromise) {
    initPromise = (async () => {
      const sync = await syncEditorialAgentsToRegistry();
      await refreshAgentPersonasFromRegistry();
      return sync;
    })();
  }
  return initPromise;
}
