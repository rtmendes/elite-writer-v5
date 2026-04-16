// Elite Writer V5 — 11-Dimension Scoring Engine
// Provides local heuristic scoring when no API key is available,
// and AI-powered scoring when OpenAI key is configured.

import type { ArticleScores } from './store';

const DIMENSIONS = [
  'clarity_structure', 'hook_engagement', 'voice_tone', 'data_evidence',
  'originality_angle', 'publication_fit', 'timeliness', 'actionability',
  'expertise_depth', 'readability', 'conclusion_cta'
] as const;

const DIMENSION_LABELS: Record<string, string> = {
  clarity_structure: 'Clarity & Structure',
  hook_engagement: 'Hook & Engagement',
  voice_tone: 'Voice & Tone',
  data_evidence: 'Data & Evidence',
  originality_angle: 'Originality & Angle',
  publication_fit: 'Publication Fit',
  timeliness: 'Timeliness',
  actionability: 'Actionability',
  expertise_depth: 'Expertise & Depth',
  readability: 'Readability',
  conclusion_cta: 'Conclusion & CTA',
};

export { DIMENSIONS, DIMENSION_LABELS };

// Heuristic scoring — runs locally without API
export function scoreArticleLocally(content: string, targetPublication?: string): ArticleScores {
  const words = content.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const hasHeadings = /^#{1,3}\s/m.test(content) || /<h[1-3]/i.test(content);
  const hasData = /\d+%|\$[\d,]+|million|billion|according to|study|research|report/gi.test(content);
  const dataMatches = content.match(/\d+%|\$[\d,]+|million|billion/gi) || [];
  const hasQuotes = /"[^"]{20,}"/.test(content) || /said|according to|noted|explained/i.test(content);
  const hasLinks = /\[.*?\]\(.*?\)|https?:\/\//.test(content);
  const hasCTA = /subscribe|download|sign up|learn more|get started|click|join|try/i.test(content);
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 0;
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const lexicalDiversity = uniqueWords.size / Math.max(wordCount, 1);

  // Clarity & Structure
  let clarity = 5;
  if (hasHeadings) clarity += 1.5;
  if (paragraphs.length >= 5) clarity += 1;
  if (wordCount >= 800) clarity += 1;
  if (avgSentenceLength < 25 && avgSentenceLength > 8) clarity += 1;
  clarity = Math.min(10, clarity);

  // Hook & Engagement
  let hook = 5;
  const firstSentence = sentences[0]?.trim() || '';
  if (firstSentence.length > 10 && firstSentence.length < 150) hook += 1;
  if (/\?|!|imagine|picture this|what if/i.test(firstSentence)) hook += 1.5;
  if (wordCount > 500) hook += 1;
  if (hasData) hook += 0.5;
  hook = Math.min(10, hook);

  // Voice & Tone
  let voice = 5.5;
  if (lexicalDiversity > 0.5) voice += 1;
  if (avgSentenceLength > 10 && avgSentenceLength < 22) voice += 1;
  if (!/very |really |just |basically |literally /i.test(content)) voice += 1;
  voice = Math.min(10, voice);

  // Data & Evidence
  let data = 4;
  data += Math.min(3, dataMatches.length * 0.5);
  if (hasQuotes) data += 1.5;
  if (hasLinks) data += 1;
  data = Math.min(10, data);

  // Originality
  let originality = 5.5;
  if (lexicalDiversity > 0.55) originality += 1;
  if (wordCount > 1000) originality += 0.5;
  if (hasData && hasQuotes) originality += 1;
  originality = Math.min(10, originality);

  // Publication Fit
  let pubFit = targetPublication ? 6.5 : 5;
  if (wordCount >= 1000 && wordCount <= 3000) pubFit += 1;
  if (hasHeadings && hasData) pubFit += 1;
  pubFit = Math.min(10, pubFit);

  // Timeliness
  let timeliness = 5;
  if (/2025|2026|recent|latest|new|this year|this month|today/i.test(content)) timeliness += 2;
  if (/trend|emerging|breaking|just released/i.test(content)) timeliness += 1;
  timeliness = Math.min(10, timeliness);

  // Actionability
  let actionability = 5;
  if (/step \d|how to|tip|strategy|framework|checklist/i.test(content)) actionability += 2;
  if (hasCTA) actionability += 1;
  if (/\d\.\s/.test(content)) actionability += 1;
  actionability = Math.min(10, actionability);

  // Expertise
  let expertise = 5;
  if (hasData) expertise += 1;
  if (hasQuotes) expertise += 1;
  if (wordCount > 1500) expertise += 1;
  if (hasLinks) expertise += 0.5;
  expertise = Math.min(10, expertise);

  // Readability
  let readability = 6;
  if (avgSentenceLength < 20) readability += 1;
  if (paragraphs.length >= 5 && paragraphs.length <= 20) readability += 1;
  if (hasHeadings) readability += 1;
  readability = Math.min(10, readability);

  // Conclusion
  let conclusion = 5;
  const lastParagraph = paragraphs[paragraphs.length - 1] || '';
  if (lastParagraph.length > 50) conclusion += 1;
  if (hasCTA) conclusion += 1.5;
  if (/in conclusion|ultimately|the bottom line|looking ahead/i.test(lastParagraph)) conclusion += 1;
  conclusion = Math.min(10, conclusion);

  const scores: ArticleScores = {
    overall: 0,
    clarity_structure: Math.round(clarity * 10) / 10,
    hook_engagement: Math.round(hook * 10) / 10,
    voice_tone: Math.round(voice * 10) / 10,
    data_evidence: Math.round(data * 10) / 10,
    originality_angle: Math.round(originality * 10) / 10,
    publication_fit: Math.round(pubFit * 10) / 10,
    timeliness: Math.round(timeliness * 10) / 10,
    actionability: Math.round(actionability * 10) / 10,
    expertise_depth: Math.round(expertise * 10) / 10,
    readability: Math.round(readability * 10) / 10,
    conclusion_cta: Math.round(conclusion * 10) / 10,
  };

  // Calculate overall as weighted average
  const weights: Record<string, number> = {
    clarity_structure: 1, hook_engagement: 1.2, voice_tone: 1, data_evidence: 1.3,
    originality_angle: 1.1, publication_fit: 1.2, timeliness: 0.8, actionability: 0.9,
    expertise_depth: 1.1, readability: 1, conclusion_cta: 0.8,
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const dim of DIMENSIONS) {
    const w = weights[dim] ?? 1;
    weightedSum += scores[dim] * w;
    totalWeight += w;
  }
  scores.overall = Math.round((weightedSum / totalWeight) * 10) / 10;

  return scores;
}

export function getScoreColor(score: number): string {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6.5) return 'text-amber-400';
  return 'text-red-400';
}

export function getScoreBgColor(score: number): string {
  if (score >= 8) return 'bg-emerald-500/20 border-emerald-500/30';
  if (score >= 6.5) return 'bg-amber-500/20 border-amber-500/30';
  return 'bg-red-500/20 border-red-500/30';
}

export function getTierFromScore(score: number): string {
  if (score >= 8) return 'Tier 1';
  if (score >= 6.5) return 'Tier 2';
  return 'Tier 3';
}
