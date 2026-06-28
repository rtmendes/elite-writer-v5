/**
 * Publication style knowledge — ported from legacy publication-knowledge-base.js (dist).
 * Used by Writer scorecard + pitch generation for publication-fit context.
 */
export type PublicationStyleGuide = {
  name: string;
  reading_level?: number;
  word_count?: { min: number; max: number };
  tone?: string;
  voice?: string;
  headline_style?: string;
  pitch_requirements?: string;
  preferred_angles?: string[];
  avoid_topics?: string[];
};

/** Tier-1 style guides harvested from elite-writer-app dist */
export const PUBLICATION_STYLE_GUIDES: Record<string, PublicationStyleGuide> = {
  "business-insider": {
    name: "Business Insider",
    reading_level: 10,
    word_count: { min: 800, max: 1200 },
    tone: "conversational but authoritative",
    voice: "third-person, occasionally first-person for personal essays",
    headline_style: "clickable but credible - use numbers, provocative angles",
    pitch_requirements: "Why now, why you, what you'll deliver, similar articles they've published",
    preferred_angles: ["contrarian perspectives", "data-driven insights", "breaking trends", "workplace dynamics"],
    avoid_topics: ["overly academic tone", "outdated trends without new angle"],
  },
  forbes: {
    name: "Forbes",
    reading_level: 11,
    word_count: { min: 600, max: 1000 },
    tone: "authoritative thought leadership",
    pitch_requirements: "Unique expertise angle + timely hook",
    preferred_angles: ["entrepreneurship", "leadership", "innovation"],
  },
  wired: {
    name: "Wired",
    reading_level: 12,
    word_count: { min: 1200, max: 2500 },
    tone: "smart, skeptical, future-focused",
    pitch_requirements: "Deep tech expertise + cultural implications",
    preferred_angles: ["technology culture", "security", "AI ethics"],
  },
  "harvard-business-review": {
    name: "Harvard Business Review",
    reading_level: 13,
    word_count: { min: 1500, max: 2500 },
    tone: "research-backed, executive audience",
    pitch_requirements: "Evidence-based management insight with actionable framework",
    preferred_angles: ["leadership", "strategy", "organizational behavior"],
  },
};

export function getPublicationStyleGuide(publicationIdOrSlug: string): PublicationStyleGuide | null {
  const key = publicationIdOrSlug.toLowerCase().replace(/\s+/g, "-");
  return PUBLICATION_STYLE_GUIDES[key] ?? null;
}

export function publicationFitHints(publicationIdOrSlug: string): string {
  const g = getPublicationStyleGuide(publicationIdOrSlug);
  if (!g) return "";
  const parts = [
    g.tone ? `Tone: ${g.tone}` : "",
    g.word_count ? `Target length: ${g.word_count.min}-${g.word_count.max} words` : "",
    g.pitch_requirements ? `Pitch: ${g.pitch_requirements}` : "",
    g.preferred_angles?.length ? `Angles: ${g.preferred_angles.join(", ")}` : "",
  ].filter(Boolean);
  return parts.join(". ");
}
