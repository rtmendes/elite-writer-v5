/**
 * Agent Skills & SOPs — expert-level best practices injected into every agent
 * call so free-model output stays at professional grade. The SOPs live in the
 * workspace database "Agent Skills & SOPs" (auto-created, one row per agent):
 * the operator edits a row's SOP field in the app and the very next agent call
 * uses the edited text. Seeding is per-row idempotent — operator edits are
 * never overwritten; new skills added here appear as new rows.
 *
 * Self-contained DB access (no imports from proactiveAgents/routers) to keep
 * the module cycle-free: skills is imported BY the routers and agents.
 */
import { nanoid } from "nanoid";
import { sql } from "drizzle-orm";
import { getDb } from "../db";

const uid = () => nanoid(12);

interface WsSelectOption { id: string; name: string; color: string }
interface WsField { id: string; name: string; type: string; options?: WsSelectOption[]; width?: number }
interface WsDatabase { id: string; name: string; icon: string; fields: WsField[]; views: unknown[]; createdAt: number; updatedAt: number; description?: string }
interface WsRow { id: string; dbId: string; values: Record<string, unknown>; sortOrder: number; createdAt: number; updatedAt: number }

async function dbExec(query: string): Promise<Array<Record<string, unknown>>> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(sql.raw(query));
  return ((result as unknown as [Array<Record<string, unknown>>])[0] ?? []);
}

const parse = <T,>(raw: unknown): T => (typeof raw === "string" ? JSON.parse(raw) : raw) as T;

const STAGES = ["Discover", "Research", "Plan", "Draft", "Edit", "Verify", "Optimize", "Visuals", "Govern"] as const;
type Stage = (typeof STAGES)[number];

/** Shared anti-slop charter — referenced verbatim inside the prose-facing SOPs. */
const BAN_LIST = `BANNED (instant tells of machine writing — never use): "delve", "dive into", "tapestry", metaphorical "landscape"/"navigate", "unlock", "unleash", "leverage" as a verb, "game-changer", "revolutionize", "seamless", "robust", "in today's fast-paced/digital world", "it's important to note", "moreover"/"furthermore" as sentence openers, "not just X, but Y" constructions, "whether you're a X or a Y", stacked adjective triads ("clear, concise, and compelling"), more than one em-dash per paragraph, "at the end of the day".`;

export interface SkillSeed { key: string; agent: string; stage: Stage; title: string; sop: string }

export const SKILL_SEEDS: SkillSeed[] = [
  {
    key: "scout", agent: "Thomas Fischer", stage: "Discover", title: "Story Scouting — News-Pegged Idea Standards",
    sop: `Newsworthiness = recency × audience size × tension. Every idea must have a news peg dated within ~72 hours and the "why now" stated in ONE sentence. US audience only. Each idea names the target outlet, the section, and a working headline a busy editor would actually open. Reject evergreen topics without a peg, anything the outlet covered in the last 30 days, and anything outside the operator's beats. Rank ideas by acceptance likelihood × realistic fee. Attach the news-peg link to every idea. Specificity test before filing: would a named editor reply to this within a day? If not, sharpen or discard.`,
  },
  {
    key: "researcher", agent: "Maya Chen", stage: "Research", title: "Research Sourcing Standards",
    sop: `Source hierarchy, strictly: primary documents and datasets > .gov/.edu and peer-reviewed > top-tier journalism (WSJ/NYT/Reuters/Bloomberg/AP) > reputable trade press. Never content farms, SEO listicles, or unattributed aggregators. Every statistic carries source, year, and link; prefer data under 24 months old and flag anything older. Triangulate every surprising claim with two independent sources. Experts are quoted with full name, title, and organization. Distinguish correlation from causation explicitly; note methodology and sample size for any survey. Deliver: Key Findings → Data Points (number, source, year) → Expert Voices → Counter-Evidence → Gaps marked [TK].`,
  },
  {
    key: "deepresearch", agent: "Arjun Krishnamurthy", stage: "Research", title: "Deep Research — Evidence Methodology",
    sop: `State the method first: search strategy and inclusion criteria in two lines. Evidence hierarchy: meta-analyses > randomized trials > cohort/longitudinal > case studies > expert opinion — label each finding's tier. Report effect sizes and absolute numbers, not just "significant". Present conflicting evidence honestly, then give a weight-of-evidence verdict with a confidence level (high/medium/low) and what new evidence would change it. Primary sources only for load-bearing claims. Structure: Question → Method → Findings (each cited) → Conflicts → Verdict & Confidence → Open Questions. No claim without a path to verification.`,
  },
  {
    key: "analyst", agent: "Catherine Sterling", stage: "Research", title: "Intelligence Analysis Standards",
    sop: `Every recommendation = data point + benchmark + implication + action; never present opinion as finding. Competitor scans cover positioning, publishing cadence, and the gaps we can own. Demand signals come from search volume, community chatter, and publication activity — segment by persona before averaging anything. Flag confidence (high/medium/low) and what would change it. One-page brief format: Situation (3 lines) → 3 Insights (each with its number) → 3 Moves ranked by effort-to-ROI. Match every publication recommendation to the enriched Publications data (style, editor preferences, pay).`,
  },
  {
    key: "outliner", agent: "Marcus Johnson", stage: "Plan", title: "Outline Architecture Standards",
    sop: `One promise per piece; the working headline states a specific benefit or tension (a number when honest). Offer three hook options: a scene, a stat, or a contrarian claim. Nut graf by paragraph three: the stakes and the roadmap. H2s are assertions, not labels — "Why most pilots fail the checkride" beats "Background". Every section follows claim → evidence → example → takeaway, and any section that doesn't serve the headline promise gets cut. One narrative thread start to finish; end on payoff, not summary. Mirror the target outlet's structure conventions from the Publications enrichment (word count, listicle vs essay, service sidebar).`,
  },
  {
    key: "drafter", agent: "Sofia Andersson", stage: "Draft", title: "Drafting — Anti-Slop Prose Charter",
    sop: `${BAN_LIST}
Open in a scene, a number, or a tension — never a question, never a definition. Concrete beats abstract: names, numbers, dates, places in every section. Sentence lengths vary 5–25 words; active voice in at least 9 of 10 sentences. One idea per paragraph, four sentences max. Every claim earns its evidence in the same paragraph or gets [TK: verify]. Write to ONE specific reader, in US English, AP style. Quotes and anecdotes carry the argument; adjectives don't. End sections on substance, never on a recap. Read the final draft aloud in your head — anything you'd never say to a colleague gets rewritten.`,
  },
  {
    key: "continuator", agent: "Zara Williams", stage: "Draft", title: "Seamless Continuation Standards",
    sop: `Before writing, profile the last 300 words: tense, person, sentence rhythm, vocabulary register, paragraph length, formatting habits. List every open thread and promise made earlier and resolve them in order. No re-introductions, no "as mentioned above", no summarizing what's already said. The first new sentence must read like the same breath — same voice, same energy. Keep established terminology exactly (never swap synonyms for defined terms). If the existing structure implies remaining sections, follow the implied outline rather than inventing a new one.`,
  },
  {
    key: "appbuilder", agent: "Nia Thompson", stage: "Draft", title: "Embeddable Mini-App Standards",
    sop: `Single-file embeddable: inline CSS/JS, zero external dependencies, under 50KB, no layout shift. One job per widget — a calculator computes exactly one decision. Mobile-first with touch targets ≥44px; instant visual feedback on every interaction. Validate all inputs with specific, helpful error messages. Accessible: labeled controls, 4.5:1 contrast, full keyboard navigation. Brand palette and system font stack. End with a soft call-to-action tied to the article's offer. Test mentally: does it work with keyboard only, on a 360px screen, with garbage input?`,
  },
  {
    key: "editor", agent: "Carlos Mendez", stage: "Edit", title: "Enhancement Editing — Pass Order & Standards",
    sop: `Edit in passes, big to small: structure → argument → evidence → paragraph → sentence → word. Cut 10–15% on principle; the first 100 words must earn the next 900. Verify the piece keeps its headline promise. Kill hedges (very, really, quite, arguably, perhaps) and replace abstractions with specifics. Transitions must be causal, not additive — "because/so/which is why" beat "additionally/also". Preserve the author's voice: edit like a surgeon, not a rewriter. Flag unsupported claims as [TK: source] rather than deleting. Final pass: sweep for every item on the drafter's ban list. ${BAN_LIST}`,
  },
  {
    key: "rewriter", agent: "Amara Okafor", stage: "Edit", title: "Voice Transformation Standards",
    sop: `First extract a target voice spec from the publication's enrichment data or sample: sentence-length distribution, vocabulary register, person (first/second/third), idiom level, paragraph rhythm, humor tolerance. Map each source paragraph into the target register — preserve every fact, name, number, and quote exactly; never add claims while rewriting. Keep the author's signature anecdotes. Run the read-aloud rhythm test on the result. Deliver a three-line change log naming the register shifts made (e.g., "shortened sentences ~30%, moved to second person, cut idioms"). ${BAN_LIST}`,
  },
  {
    key: "factchecker", agent: "Raj Patel", stage: "Verify", title: "Fact-Checking Protocol",
    sop: `Triage claims by risk: statistics, superlatives, named attributions, dates, causal claims. Verification ladder: primary source → official data → two independent reputable outlets. Check the number AND its frame: per-capita vs absolute, nominal vs real, survey sample size and sponsor. Date-check every statistic; flag anything over 24 months. Verdicts only from this set: VERIFIED (with source + link), NEEDS SOURCE, DISPUTED (state both sides), FALSE (with correction). Never pass a superlative — "first", "only", "biggest" — without exhaustive confirmation. Check every quote against its original context for fairness.`,
  },
  {
    key: "proofreader", agent: "Isabella Reyes", stage: "Verify", title: "Proofreading — US English & AP Style",
    sop: `US English exclusively: -ize endings, "color/behavior", periods and commas inside quotation marks. AP style: spell out numbers under 10, numerals with %, no Oxford comma unless clarity demands it, dates as "June 12, 2026". Mechanical sweep: double spaces, hyphen/en/em dash misuse, straight-vs-curly quotes, its/it's, their/there. Grammar sweep: subject-verb agreement around collective nouns, dangling modifiers, broken parallelism. AI-tell sweep against the ban list, plus robotic parallel constructions and uniform sentence lengths. ${BAN_LIST}
Output: corrected text first, then a bulleted change list.`,
  },
  {
    key: "seo", agent: "Kenji Tanaka", stage: "Optimize", title: "Search & AI-Engine Optimization Standards",
    sop: `One primary keyword plus 3–5 semantic variants, placed naturally: title, H1, first 100 words, one H2, meta description. Title ≤60 characters carrying the benefit; meta 140–155 with the payoff. For AI engines: answer-first paragraphs — a 40–60 word direct answer immediately after each question-style H2. Add an FAQ block when search intent splits. 3–5 internal links with descriptive anchors (never "click here"). Suggest schema (Article, FAQ, HowTo) where it fits. Readability beats keyword density every single time — if a sentence reads worse with the keyword, drop the keyword.`,
  },
  {
    key: "artdirector", agent: "David Osei", stage: "Visuals", title: "Art Direction Standards",
    sop: `The hero image encodes the article's tension — it never merely decorates. Demographics in imagery must be exactly congruent with the audience described (age, profession, setting). Zero AI-slop tells: no malformed hands, melted text, generic corporate handshakes, or sterile stock-photo energy. Every brief specifies: subject, setting, action, mood, lighting, palette (brand-matched), camera angle. Format 16:9 with the upper third calm for a headline overlay. Photorealistic and technically accurate for professional/technical audiences — precision builds trust, cartoonishness destroys it. Provide alt text using the primary keyword naturally.`,
  },
  {
    key: "imagecreator", agent: "Mei Lin", stage: "Visuals", title: "Image Prompt Engineering Standards",
    sop: `Prompt anatomy, one vivid paragraph: subject + action + environment + lighting + lens/style + palette + composition. Always state the negatives: no text, no logos, no watermarks, no extra limbs. For photorealism, name the camera behavior ("85mm portrait, shallow depth of field, soft window light"). People are specific: age range, attire, expression — congruent with the article's audience. Honor the brand palette. When a layout needs headline space, explicitly demand negative space in that region. 16:9 default unless the platform dictates otherwise.`,
  },
  {
    key: "infographic", agent: "Omar Hassan", stage: "Visuals", title: "Data Visualization Standards",
    sop: `Chart by claim type: comparison → bar, trend → line, part-of-whole → stacked bar (pie only ≤5 slices), distribution → histogram, relationship → scatter. One message per graphic, stated in the title as the takeaway: "Checkride pass rates doubled since 2024", never "Pass rates over time". Label data directly; kill the legend when there are ≤4 series. Source and year under every chart. Bar axes start at zero, always. Brand palette, color-blind safe. Round numbers honestly — 47%, not 47.3286%.`,
  },
  {
    key: "scorer", agent: "Priya Sharma", stage: "Govern", title: "Scoring Calibration Standards",
    sop: `Score every dimension 1–10 with a one-line, evidence-based justification — no dimension ships with an empty rationale. Calibration anchors: 5 = publishable on a mid-tier blog, 7 = solid trade outlet, 9 = top-tier ready (Forbes/HBR/BI). Mandatory penalties: unsupported claims −2 accuracy; ban-list AI-tell phrasing −2 voice; generic examples −1 originality. The verdict always ends with the three highest-leverage fixes, ranked by effort-to-impact. Score the piece in front of you, not the idea of it.`,
  },
  {
    key: "quality", agent: "Elena Vasquez", stage: "Govern", title: "Final Quality Gate — 8-Point Checklist",
    sop: `APPROVED only when ALL eight pass: (1) headline promise kept by the body; (2) every statistic sourced and under 24 months; (3) zero ban-list AI-tells; (4) US English + AP style throughout; (5) target outlet's style honored per the Publications enrichment; (6) claims safety — no health claims in perimenopause content (relief/framework language only, never "prescription"), no unverifiable superlatives; (7) all links live and pointing where they claim; (8) imagery congruent with audience and alt text present. Otherwise BLOCKED, listing the failing items with exact fixes. Never approve with caveats — caveats mean BLOCKED. ${BAN_LIST}`,
  },
];

const DB_NAME = "Agent Skills & SOPs";
const STAGE_COLORS = ["#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#14b8a6", "#ec4899", "#a3a3a3"];

async function loadDatabases(): Promise<WsDatabase[]> {
  const rows = await dbExec("SELECT data FROM `wsDatabases` WHERE deleted = FALSE");
  return rows.map((r) => parse<WsDatabase>(r.data));
}

async function loadRowsFor(dbId: string): Promise<WsRow[]> {
  try {
    const rows = await dbExec(`SELECT data FROM \`wsRows\` WHERE deleted = FALSE AND dbId = ${JSON.stringify(dbId)}`);
    return rows.map((r) => parse<WsRow>(r.data));
  } catch {
    const rows = await dbExec("SELECT data FROM `wsRows` WHERE deleted = FALSE");
    return rows.map((r) => parse<WsRow>(r.data)).filter((r) => r.dbId === dbId);
  }
}

async function save(table: "wsDatabases" | "wsRows", record: { id: string } & Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  record.updatedAt = Date.now();
  await db.execute(sql`
    INSERT INTO ${sql.raw(table)} (id, data, updatedAt, deleted)
    VALUES (${record.id}, ${JSON.stringify(record)}, ${record.updatedAt}, FALSE)
    ON DUPLICATE KEY UPDATE data = VALUES(data), updatedAt = VALUES(updatedAt), deleted = FALSE
  `);
}

/** Create the Skills database if missing and seed any skill rows not yet present.
 *  Existing rows (operator-edited) are never touched. */
async function ensureSkillsDb(): Promise<{ db: WsDatabase; rows: WsRow[] } | null> {
  const databases = await loadDatabases();
  let skillsDb = databases.find((d) => d.name === DB_NAME);
  const now = Date.now();
  if (!skillsDb) {
    skillsDb = {
      id: uid(),
      name: DB_NAME,
      icon: "🎓",
      description: "Expert-level best practices injected into every AI agent call. Edit a row's SOP and the very next agent run uses your wording — this is the operator's control panel for output quality on the free-model fleet.",
      fields: [
        { id: uid(), name: "Skill", type: "text", width: 300 },
        { id: uid(), name: "Stage", type: "select", width: 130, options: STAGES.map((s, i) => ({ id: uid(), name: s, color: STAGE_COLORS[i % STAGE_COLORS.length] })) },
        { id: uid(), name: "Agent", type: "text", width: 170 },
        { id: uid(), name: "Key", type: "text", width: 110 },
        { id: uid(), name: "SOP", type: "longtext", width: 560 },
      ],
      views: [{ id: uid(), name: "All", type: "table", filters: [], sorts: [] }],
      createdAt: now,
      updatedAt: now,
    } as unknown as WsDatabase;
    await save("wsDatabases", skillsDb as unknown as { id: string } & Record<string, unknown>);
  }
  const field = (n: string) => skillsDb!.fields.find((f) => f.name === n);
  const fSkill = field("Skill"), fStage = field("Stage"), fAgent = field("Agent"), fKey = field("Key"), fSop = field("SOP");
  if (!fSkill || !fKey || !fSop) return null;
  const rows = await loadRowsFor(skillsDb.id);
  const existingKeys = new Set(rows.map((r) => String(r.values[fKey.id] ?? "")));
  let order = rows.length;
  for (const seed of SKILL_SEEDS) {
    if (existingKeys.has(seed.key)) continue;
    const stageOption = fStage?.options?.find((o) => o.name === seed.stage);
    const row: WsRow = {
      id: uid(),
      dbId: skillsDb.id,
      values: {
        [fSkill.id]: seed.title,
        ...(fStage && stageOption ? { [fStage.id]: stageOption.id } : {}),
        ...(fAgent ? { [fAgent.id]: `${seed.agent} (${seed.key})` } : {}),
        [fKey.id]: seed.key,
        [fSop.id]: seed.sop,
      },
      sortOrder: order++,
      createdAt: now,
      updatedAt: now,
    };
    await save("wsRows", row as unknown as { id: string } & Record<string, unknown>);
    rows.push(row);
  }
  return { db: skillsDb, rows };
}

// 5-minute cache so chat loops don't hammer MySQL; operator edits go live fast.
let cache: { at: number; map: Record<string, string> } | null = null;
const CACHE_MS = 5 * 60_000;

async function skillMap(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.map;
  const map: Record<string, string> = {};
  try {
    const ensured = await ensureSkillsDb();
    if (ensured) {
      const fKey = ensured.db.fields.find((f) => f.name === "Key");
      const fSop = ensured.db.fields.find((f) => f.name === "SOP");
      if (fKey && fSop) {
        for (const r of ensured.rows) {
          const k = String(r.values[fKey.id] ?? "").trim();
          const sop = String(r.values[fSop.id] ?? "").trim();
          if (k && sop) map[k] = sop;
        }
      }
    }
  } catch (err) {
    console.warn("[skills] load failed (continuing without SOPs):", err instanceof Error ? err.message : err);
  }
  // Seeds as fallback for anything missing (e.g. DB unreachable)
  for (const seed of SKILL_SEEDS) if (!map[seed.key]) map[seed.key] = seed.sop;
  cache = { at: Date.now(), map };
  return map;
}

/** System-prompt block for one agent. Empty string if nothing found. */
export async function skillBlockFor(personaKey: string): Promise<string> {
  const map = await skillMap();
  const sop = map[personaKey];
  if (!sop) return "";
  return `\n\nEXPERT SOP — your non-negotiable working standards (operator-editable in "${DB_NAME}"):\n${sop}`;
}
