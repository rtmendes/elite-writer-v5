/** Health-claims compliance scoring for ingest + scorecard (0–100). */

export const HEALTH_CLAIMS_SAFETY_THRESHOLD = 80;

export const BANNED_HEALTH_CLAIM_TOKENS =
  /\b(cure|cures|treat|treats|prevent|prevents|reverse|reverses|guarantee|guarantees|eliminate|eliminates|diagnose|diagnoses)\b/gi;

const BENEFIT_VERB =
  /\b(helps?|reduces?|improves?|supports?|relieves?|eases?|lowers?|boosts?|strengthens?)\b/i;

const CONDITION_NOUN =
  /\b(pain|insomnia|anxiety|depression|symptoms?|disease|inflammation|cholesterol|blood pressure|menopause|weight|fatigue|hot flashes?|migraines?|arthritis|diabetes|cancer|heart disease|osteoporosis|hormones?|mood swings?|brain fog|joint pain|bloating|cramping)\b/i;

const ATTRIBUTION =
  /\b(research|study|studies|scientists?|doctors?|experts?|source|according to|published|journal|clinical trial)\b|https?:\/\/|\[[^\]]+\]\([^)]+\)/i;

const HEDGE = /\b(may|might|could|some|many|often|sometimes|possibly|potentially)\b/i;

export interface HealthClaimsSafetyResult {
  score: number;
  flaggedPhrases: string[];
  hasBannedTokens: boolean;
  unattributedBenefits: string[];
}

function splitSentences(text: string): string[] {
  return text
    .replace(/<[^>]+>/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

function findBannedMatches(text: string): string[] {
  const matches = new Set<string>();
  const re = new RegExp(BANNED_HEALTH_CLAIM_TOKENS.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.add(m[0].toLowerCase());
  }
  return [...matches];
}

function findUnattributedBenefits(text: string): string[] {
  const sentences = splitSentences(text);
  const flagged: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (!BENEFIT_VERB.test(sentence) || !CONDITION_NOUN.test(sentence)) continue;

    const window = [sentences[i - 1], sentence, sentences[i + 1]]
      .filter(Boolean)
      .join(" ");

    if (ATTRIBUTION.test(window) || HEDGE.test(window)) continue;
    flagged.push(sentence.slice(0, 160));
  }

  return flagged;
}

export function hasComplianceFlag(text: string): boolean {
  BANNED_HEALTH_CLAIM_TOKENS.lastIndex = 0;
  return BANNED_HEALTH_CLAIM_TOKENS.test(text);
}

/** Score 0–100; 100 = clean. Penalizes banned tokens and unattributed health benefits. */
export function scoreHealthClaimsSafety(
  markdown: string,
  html?: string | null
): HealthClaimsSafetyResult {
  const combined = [markdown, html].filter(Boolean).join("\n");
  const banned = findBannedMatches(combined);
  const unattributed = findUnattributedBenefits(combined);

  let score = 100;
  score -= Math.min(60, banned.length * 25);
  score -= Math.min(50, unattributed.length * 30);

  const flaggedPhrases = [
    ...banned.map((t) => `Banned claim word: "${t}"`),
    ...unattributed.map((s) => `Unattributed benefit: "${s}"`),
  ];

  return {
    score: Math.max(0, score),
    flaggedPhrases,
    hasBannedTokens: banned.length > 0,
    unattributedBenefits: unattributed,
  };
}

export function blocksApproval(score: number, threshold = HEALTH_CLAIMS_SAFETY_THRESHOLD): boolean {
  return score < threshold;
}
