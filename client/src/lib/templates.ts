// Elite Writer V5 — Writing Templates & Brand Voices

export interface WritingTemplate {
  id: string;
  name: string;
  category: 'article' | 'marketing' | 'social';
  description: string;
  structure: string[];
  wordCountRange: [number, number];
  bestFor: string[];
}

export interface BrandVoice {
  id: string;
  name: string;
  audience: string;
  voice: string;
  focus: string;
  tabooTopics: string[];
  redFlagPhrases: string[];
  keywordClusters: Record<string, string[]>;
}

export const TEMPLATES: WritingTemplate[] = [
  // Article Templates
  { id: 'data-journalism', name: 'Data Journalism Feature', category: 'article', description: 'Data-driven investigative piece with charts and analysis', structure: ['Compelling data hook (surprising statistic)', 'Context & background', 'Data analysis section with visualizations', 'Expert commentary', 'Implications & what it means', 'Methodology note'], wordCountRange: [1500, 3000], bestFor: ['Bloomberg', 'FiveThirtyEight', 'The Atlantic', 'Vox'] },
  { id: 'personal-narrative', name: 'Personal Narrative Essay', category: 'article', description: 'First-person story with universal takeaways', structure: ['Scene-setting opening', 'The inciting incident', 'Rising tension / complications', 'The turning point', 'Reflection & insight', 'Universal takeaway'], wordCountRange: [1200, 2500], bestFor: ['HuffPost', 'NYT Modern Love', 'The Atlantic', 'Esquire'] },
  { id: 'investigative', name: 'Investigative Deep Dive', category: 'article', description: 'Multi-source investigation with evidence trail', structure: ['Shocking revelation or finding', 'How we got here (timeline)', 'Key evidence & documents', 'Affected parties & impact', 'Expert analysis', 'What happens next', 'Call for accountability'], wordCountRange: [2500, 5000], bestFor: ['NYT', 'The Atlantic', 'Wired', 'Vanity Fair'] },
  { id: 'listicle', name: 'High-Tier Listicle', category: 'article', description: 'Numbered list with depth and authority', structure: ['Why this matters now (intro)', 'Item 1 with data + example', 'Item 2 with data + example', '...continue pattern...', 'Bonus/unexpected item', 'How to apply these insights'], wordCountRange: [1000, 2500], bestFor: ['Forbes', 'Inc.', 'Fast Company', 'Business Insider'] },
  { id: 'how-to', name: 'How-To / Tutorial Guide', category: 'article', description: 'Step-by-step actionable guide', structure: ['What you will learn + why it matters', 'Prerequisites / what you need', 'Step 1 with details', 'Step 2 with details', '...continue steps...', 'Common mistakes to avoid', 'Expected results & next steps'], wordCountRange: [1200, 3000], bestFor: ['CNBC Make It', "Men's Health", 'Well+Good', 'Psychology Today'] },
  { id: 'opinion', name: 'Opinion / Op-Ed', category: 'article', description: 'Persuasive argument with evidence', structure: ['Bold thesis statement', 'Why the conventional wisdom is wrong', 'Evidence point 1', 'Evidence point 2', 'Counterargument & rebuttal', 'What should change', 'Call to action'], wordCountRange: [800, 1500], bestFor: ['NYT Opinion', 'TIME Ideas', 'The Atlantic', 'Slate'] },
  { id: 'expert-roundup', name: 'Expert Roundup', category: 'article', description: 'Multiple expert perspectives on one topic', structure: ['The question or trend at hand', 'Expert 1: perspective + bio', 'Expert 2: perspective + bio', 'Expert 3: perspective + bio', 'Synthesis: where experts agree/disagree', 'What this means for readers'], wordCountRange: [1500, 2500], bestFor: ['Forbes', 'Inc.', 'Psychology Today', 'Fast Company'] },
  { id: 'case-study', name: 'Case Study', category: 'article', description: 'Deep analysis of a specific example', structure: ['The challenge / problem', 'Background & context', 'The approach / solution', 'Implementation details', 'Results with data', 'Lessons learned', 'How to apply this'], wordCountRange: [1500, 3000], bestFor: ['HBR', 'Fast Company', 'Inc.', 'Forbes'] },
  { id: 'trend-analysis', name: 'Trend Analysis / Market Report', category: 'article', description: 'Forward-looking analysis of emerging trends', structure: ['The trend in one sentence', 'Evidence it is real (data)', 'Who is driving it', 'Market implications', 'Winners and losers', 'Timeline predictions', 'How to position yourself'], wordCountRange: [1500, 3000], bestFor: ['Bloomberg', 'Fortune', 'Wired', 'The Verge'] },
  { id: 'explainer', name: 'Explainer / Deep Dive', category: 'article', description: 'Making complex topics accessible', structure: ['Why you should care', 'The basics (ELI5)', 'How it actually works', 'The nuances most miss', 'Real-world examples', 'What to watch for next'], wordCountRange: [1200, 2500], bestFor: ['Vox', 'The Verge', 'Wired', 'The Atlantic'] },
  // Marketing Templates
  { id: 'vsl', name: 'Video Sales Letter (VSL)', category: 'marketing', description: 'Persuasive video script for product/service', structure: ['Pattern interrupt hook', 'Problem agitation', 'Credibility builder', 'Solution reveal', 'Benefits stack', 'Social proof', 'Offer details', 'Urgency + CTA'], wordCountRange: [2000, 5000], bestFor: ['Landing pages', 'Webinars', 'Product launches'] },
  { id: 'advertorial', name: 'Advertorial', category: 'marketing', description: 'Native advertising that reads like editorial', structure: ['Editorial-style headline', 'Story-driven opening', 'Problem identification', 'Solution introduction (subtle)', 'Data & proof points', 'Reader benefit focus', 'Soft CTA'], wordCountRange: [800, 1500], bestFor: ['Sponsored content', 'Native ads', 'Content marketing'] },
  { id: 'newsletter', name: 'Newsletter Issue', category: 'marketing', description: 'Curated newsletter with original commentary', structure: ['Subject line + preview text', 'Personal greeting + hook', 'Main story / insight', 'Curated links (3-5)', 'Quick takes / hot takes', 'CTA + sign-off'], wordCountRange: [500, 1200], bestFor: ['Substack', 'Email marketing', 'Audience building'] },
  // Social Templates
  { id: 'linkedin-thread', name: 'LinkedIn Thread', category: 'social', description: 'Multi-post LinkedIn thought leadership', structure: ['Hook line (pattern interrupt)', 'The story / insight', 'Key takeaways (3-5)', 'Engagement question', 'CTA + hashtags'], wordCountRange: [200, 600], bestFor: ['LinkedIn', 'Professional networking'] },
  { id: 'twitter-thread', name: 'X/Twitter Thread', category: 'social', description: 'Viral thread format for X/Twitter', structure: ['Tweet 1: Bold claim or question', 'Tweet 2-3: Context', 'Tweet 4-7: Evidence/examples', 'Tweet 8: Counterpoint', 'Tweet 9: Summary', 'Tweet 10: CTA + retweet ask'], wordCountRange: [200, 500], bestFor: ['X/Twitter', 'Viral content'] },
];

export const BRAND_VOICES: BrandVoice[] = [
  {
    id: 'insight-profit',
    name: 'Insight Profit',
    audience: 'Business leaders, entrepreneurs, and professionals seeking actionable intelligence on AI, technology, and business strategy',
    voice: 'Authoritative yet accessible. Data-driven. Forward-looking. Avoids hype — backs claims with evidence.',
    focus: 'AI implementation, business automation, future of work, technology strategy',
    tabooTopics: ['get-rich-quick schemes', 'crypto speculation', 'MLM', 'unverified health claims'],
    redFlagPhrases: ['game-changer', 'revolutionary', 'unprecedented', 'you won\'t believe', 'secret trick'],
    keywordClusters: {
      'AI Strategy': ['AI implementation', 'machine learning ROI', 'enterprise AI', 'AI automation'],
      'Business Growth': ['revenue optimization', 'scaling strategies', 'market expansion', 'competitive advantage'],
      'Future of Work': ['remote work', 'hybrid workforce', 'AI augmentation', 'skill development'],
    },
  },
  {
    id: 'funded-first',
    name: 'Funded First',
    audience: 'Startup founders, VCs, and early-stage entrepreneurs seeking funding and growth strategies',
    voice: 'Direct, founder-to-founder tone. Practical over theoretical. Uses real examples and numbers.',
    focus: 'Startup funding, pitch decks, investor relations, growth metrics, fundraising strategy',
    tabooTopics: ['guaranteed funding', 'overnight success stories', 'unethical growth hacks'],
    redFlagPhrases: ['disruptive', 'unicorn potential', 'hockey stick growth', 'move fast and break things'],
    keywordClusters: {
      'Fundraising': ['seed round', 'Series A', 'pitch deck', 'investor outreach', 'term sheets'],
      'Growth Metrics': ['MRR', 'CAC', 'LTV', 'burn rate', 'runway'],
      'Startup Strategy': ['product-market fit', 'go-to-market', 'competitive moat', 'unit economics'],
    },
  },
];

export function getTemplate(id: string): WritingTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function getBrandVoice(id: string): BrandVoice | undefined {
  return BRAND_VOICES.find(b => b.id === id);
}
