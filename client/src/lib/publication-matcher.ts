// Elite Writer V5 — Publication Match Intelligence
// Maps article topics + news pegs to best-fit publications with reasoning
// Used by FeedItemCard and ArticleDetailModal for instant publication recommendations

import { PUBLICATIONS, type Publication, getPublicationTier, matchPublications } from './publications-data';
import { getPublicationSOP, type PublicationSOP } from './publication-sops';
import { CURATED_FEEDS, type CuratedFeed } from './curated-feeds';

export interface PublicationMatch {
  publication: Publication;
  tier: string;
  matchScore: number;         // 0-100
  whyItFits: string;          // human-readable reasoning
  topicAlignment: string[];   // matched topic keywords
  suggestedAngle: string;     // tailored angle for this pub
  payRange: string;           // formatted pay range
  acceptanceRate: string;     // formatted acceptance rate
  newsPegStrength: 'strong' | 'moderate' | 'weak';
  hasSOP: boolean;            // whether we have detailed SOP
}

// ── Topic keyword extraction ──
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','could','should','may','might','can','shall',
  'this','that','these','those','it','its','i','you','he','she','we','they',
  'me','him','her','us','them','my','your','his','our','their','what','which',
  'who','whom','when','where','why','how','all','each','every','both','few',
  'more','most','other','some','such','no','not','only','same','so','than',
  'too','very','just','about','above','after','again','also','any','as','back',
  'because','before','between','come','even','first','get','go','here','if',
  'into','know','last','like','long','look','make','many','much','new','now',
  'off','old','one','out','over','own','part','say','see','still','take',
  'tell','think','through','time','two','up','use','want','way','well','work',
]);

function extractTopicKeywords(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i); // dedupe
}

// ── News peg strength detector ──
function assessNewsPegStrength(title: string, summary: string): 'strong' | 'moderate' | 'weak' {
  const text = (title + ' ' + summary).toLowerCase();
  const strongSignals = [
    /breaking/i, /just (released|announced|launched|published)/i, /new (report|study|data|research)/i,
    /\d{4}/, /today|yesterday|this week|this month/i, /according to/i, /latest/i,
    /exclusive/i, /first time/i, /record/i, /unprecedented/i, /billion|million/i,
    /\d+%/, /\$[\d,]+/, /survey|poll|census/i, /lawsuit|ruling|regulation/i,
  ];
  const hits = strongSignals.filter(r => r.test(text)).length;
  if (hits >= 3) return 'strong';
  if (hits >= 1) return 'moderate';
  return 'weak';
}

// ── Generate human-readable reasoning ──
function generateWhyItFits(
  pub: Publication,
  topicHits: string[],
  category: string,
  newsPeg: 'strong' | 'moderate' | 'weak',
  sop: PublicationSOP | null,
): string {
  const reasons: string[] = [];
  
  if (topicHits.length >= 3) {
    reasons.push(`Strong topic alignment (${topicHits.slice(0, 3).join(', ')})`);
  } else if (topicHits.length > 0) {
    reasons.push(`Topic match: ${topicHits.join(', ')}`);
  }
  
  if (pub.category.toLowerCase() === category.toLowerCase() || pub.category === 'All Topics') {
    reasons.push(`${pub.name} covers ${category} content`);
  }
  
  if (newsPeg === 'strong') {
    reasons.push('Strong news peg increases pitch urgency');
  }
  
  if ((pub.acceptance_rate ?? 0) >= 15) {
    reasons.push(`${pub.acceptance_rate}% acceptance rate — accessible`);
  }
  
  if ((pub.pay_max ?? 0) >= 2000) {
    reasons.push(`High pay potential (${pub.pay_structure})`);
  }
  
  if (sop) {
    reasons.push(`Detailed editorial SOP available`);
  }
  
  if (pub.traffic_monthly) {
    reasons.push(`${pub.traffic_monthly} monthly readers`);
  }
  
  return reasons.slice(0, 3).join(' · ') || `${pub.name} accepts ${category} pitches`;
}

// ── Generate angle suggestion tailored to specific publication ──
function suggestAngle(
  title: string,
  pub: Publication,
  sop: PublicationSOP | null,
): string {
  if (sop && sop.exampleAngles.length > 0) {
    // Pick the most relevant example angle pattern and adapt it
    const shortTitle = title.length > 60 ? title.slice(0, 57) + '...' : title;
    const pattern = sop.exampleAngles[0];
    // Extract the pattern structure
    if (pattern.includes('[')) {
      return `${sop.toneGuidelines.split('.')[0]}. Pitch as: "${pattern.replace(/\[.*?\]/g, '…')}" format`;
    }
    return `${sop.toneGuidelines.split('.')[0]}. Model after: "${pattern.slice(0, 60)}…"`;
  }
  
  // Generic angle based on pub type
  const tier = getPublicationTier(pub);
  if (tier === 'Tier 1') {
    return `Lead with data + expert source. ${pub.name} wants original analysis, not opinion.`;
  } else if (tier === 'Tier 2') {
    return `Actionable how-to angle works best. Include personal experience or case study.`;
  }
  return `Personal essay or listicle format. ${pub.name} values accessible, relatable content.`;
}

// ── Main matching function ──
export function matchArticleToPublications(
  title: string,
  summary: string,
  category: string,
  feedSource?: string,
  relevanceScore?: number,
): PublicationMatch[] {
  const fullText = title + ' ' + summary;
  const keywords = extractTopicKeywords(fullText);
  const newsPeg = assessNewsPegStrength(title, summary);
  
  // Get feed-to-publication mapping
  const feedPubs = new Set<string>();
  if (feedSource) {
    const matchedFeed = CURATED_FEEDS.find(f => 
      f.name.toLowerCase().includes(feedSource.toLowerCase()) ||
      feedSource.toLowerCase().includes(f.name.toLowerCase().split(' ')[0])
    );
    if (matchedFeed) {
      matchedFeed.publications.forEach(p => feedPubs.add(p));
    }
  }
  
  return PUBLICATIONS.map(pub => {
    let matchScore = 0;
    const pubTopics = (pub.topics + ' ' + pub.category + ' ' + pub.name).toLowerCase();
    const topicHits = keywords.filter(w => pubTopics.includes(w));
    const sop = getPublicationSOP(pub.id);
    
    // 1. Topic keyword alignment (0-35 pts)
    matchScore += Math.min(35, topicHits.length * 8);
    
    // 2. Category match (0-20 pts)
    if (pub.category.toLowerCase() === category.toLowerCase()) {
      matchScore += 20;
    } else if (pub.category === 'All Topics') {
      matchScore += 12;
    } else {
      // Fuzzy category match
      const catWords = category.toLowerCase().split(/[\s&,]+/);
      const pubCatWords = pub.category.toLowerCase().split(/[\s&,]+/);
      if (catWords.some(w => pubCatWords.includes(w))) matchScore += 10;
    }
    
    // 3. Feed-to-publication mapping (0-15 pts)
    if (feedPubs.has(pub.id)) {
      matchScore += 15;
    }
    
    // 4. News peg alignment (0-10 pts)
    if (newsPeg === 'strong') matchScore += 10;
    else if (newsPeg === 'moderate') matchScore += 5;
    
    // 5. Has SOP = better pitch prep (0-10 pts)
    if (sop) matchScore += 10;
    
    // 6. Pay-adjusted bonus (0-10 pts) — higher pay = more worth targeting
    if ((pub.pay_max ?? 0) >= 3000) matchScore += 10;
    else if ((pub.pay_max ?? 0) >= 1500) matchScore += 6;
    else if ((pub.pay_max ?? 0) >= 500) matchScore += 3;
    
    return {
      publication: pub,
      tier: getPublicationTier(pub),
      matchScore: Math.min(100, matchScore),
      whyItFits: generateWhyItFits(pub, topicHits, category, newsPeg, sop),
      topicAlignment: topicHits.slice(0, 5),
      suggestedAngle: suggestAngle(title, pub, sop),
      payRange: pub.pay_structure || 'Unlisted',
      acceptanceRate: pub.acceptance_rate ? `${pub.acceptance_rate}%` : 'N/A',
      newsPegStrength: newsPeg,
      hasSOP: !!sop,
    };
  })
  .filter(m => m.matchScore >= 20) // minimum threshold
  .sort((a, b) => b.matchScore - a.matchScore);
}

// ── Quick match for card view (top 3) ──
export function quickMatchPublications(
  title: string,
  summary: string,
  category: string,
  feedSource?: string,
): Pick<PublicationMatch, 'publication' | 'matchScore' | 'tier' | 'payRange' | 'whyItFits' | 'newsPegStrength'>[] {
  return matchArticleToPublications(title, summary, category, feedSource)
    .slice(0, 3)
    .map(({ publication, matchScore, tier, payRange, whyItFits, newsPegStrength }) => ({
      publication, matchScore, tier, payRange, whyItFits, newsPegStrength,
    }));
}
