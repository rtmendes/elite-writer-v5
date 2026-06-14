// Elite Writer V5 — Curated RSS Feed Library
// 31 feeds mapped to 167 publications by category
// Replaces the lost ~55 user feeds with strategically curated sources

export interface CuratedFeed {
  id: string;
  name: string;
  url: string;
  category: FeedCategory;
  active: boolean;
  publications: string[];  // publication IDs this feed supports
  description: string;
}

export type FeedCategory = 
  | 'business' | 'tech' | 'news' | 'analysis' | 'finance'
  | 'health' | 'lifestyle' | 'science' | 'travel' | 'food'
  | 'writing_industry' | 'politics' | 'ai' | 'global';

export const FEED_CATEGORY_COLORS: Record<FeedCategory, string> = {
  business: '#7c3aed',
  tech: '#2563eb',
  news: '#d97706',
  analysis: '#6366f1',
  finance: '#f59e0b',
  health: '#059669',
  lifestyle: '#ec4899',
  science: '#0891b2',
  travel: '#14b8a6',
  food: '#f97316',
  writing_industry: '#8b5cf6',
  politics: '#dc2626',
  ai: '#06b6d4',
  global: '#84cc16',
};

export const CURATED_FEEDS: CuratedFeed[] = [
  // ── TIER 1: Business & Finance ──
  { id: 'cf-1', name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews', category: 'business', active: true,
    publications: ['forbes', 'bloomberg', 'fortune', 'business-insider', 'inc', 'fast-company'],
    description: 'Breaking business news from Reuters wire service' },
  { id: 'cf-2', name: 'Bloomberg Markets', url: 'https://feeds.bloomberg.com/markets/news.rss', category: 'business', active: true,
    publications: ['bloomberg', 'fortune', 'cnbc', 'forbes'],
    description: 'Market analysis and financial news' },
  { id: 'cf-3', name: 'Harvard Business Review', url: 'https://feeds.hbr.org/harvardbusiness', category: 'business', active: true,
    publications: ['harvard-business-review', 'fast-company', 'inc', 'strategy-business'],
    description: 'Research-backed business strategy and management' },
  { id: 'cf-4', name: 'Fast Company', url: 'https://www.fastcompany.com/latest/rss?format=xml', category: 'business', active: true,
    publications: ['fast-company', 'inc', 'forbes', 'wired'],
    description: 'Innovation, design, and leadership' },
  { id: 'cf-5', name: 'Inc. Magazine', url: 'https://www.inc.com/rss/', category: 'business', active: true,
    publications: ['inc', 'forbes', 'fast-company', 'business-insider'],
    description: 'Startups, entrepreneurship, and small business' },
  { id: 'cf-6', name: 'Entrepreneur', url: 'https://www.entrepreneur.com/latest.rss', category: 'business', active: true,
    publications: ['inc', 'forbes', 'business-insider', 'cnbc'],
    description: 'Entrepreneurship and business growth' },
  { id: 'cf-7', name: 'CNBC', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', category: 'finance', active: true,
    publications: ['cnbc', 'fortune', 'bloomberg', 'business-insider'],
    description: 'Financial markets and economic news' },
  { id: 'cf-8', name: 'Forbes Innovation', url: 'https://www.forbes.com/innovation/feed/', category: 'business', active: true,
    publications: ['forbes', 'fast-company', 'wired', 'the-verge'],
    description: 'Tech innovation and disruptive companies' },

  // ── TIER 2: Technology ──
  { id: 'cf-9', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'tech', active: true,
    publications: ['the-verge', 'wired', 'gizmodo', 'mit-tech-review'],
    description: 'Startup launches, funding rounds, and tech news' },
  { id: 'cf-10', name: 'Wired', url: 'https://www.wired.com/feed/rss', category: 'tech', active: true,
    publications: ['wired', 'the-verge', 'gizmodo', 'popular-science'],
    description: 'Culture, science, and technology long-form' },
  { id: 'cf-11', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech', active: true,
    publications: ['the-verge', 'wired', 'gizmodo', 'mit-tech-review'],
    description: 'Consumer tech, science, and digital culture' },
  { id: 'cf-12', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech', active: true,
    publications: ['wired', 'the-verge', 'mit-tech-review', 'popular-science'],
    description: 'Deep-dive tech analysis and reviews' },
  { id: 'cf-13', name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'tech', active: false,
    publications: ['wired', 'the-verge', 'fast-company'],
    description: 'Community-curated tech and startup links' },

  // ── TIER 3: News & Analysis ──
  { id: 'cf-14', name: 'AP News', url: 'https://rss.ap.org/article/topnews', category: 'news', active: true,
    publications: ['new-york-times', 'the-atlantic', 'time', 'newsweek'],
    description: 'Breaking news from Associated Press' },
  { id: 'cf-15', name: 'The Conversation US', url: 'https://theconversation.com/us/articles.atom', category: 'analysis', active: true,
    publications: ['the-atlantic', 'vox', 'slate', 'the-american-scholar'],
    description: 'Academic experts writing for a general audience' },
  { id: 'cf-16', name: 'Vox', url: 'https://www.vox.com/rss/index.xml', category: 'analysis', active: true,
    publications: ['vox', 'slate', 'the-atlantic', 'huffpost'],
    description: 'Explainer journalism and policy analysis' },
  { id: 'cf-17', name: 'NPR', url: 'https://feeds.npr.org/1001/rss.xml', category: 'news', active: true,
    publications: ['the-atlantic', 'slate', 'vox', 'huffpost'],
    description: 'National public radio news and features' },
  { id: 'cf-18', name: 'Foreign Policy', url: 'https://foreignpolicy.com/feed/', category: 'politics', active: true,
    publications: ['foreign-policy', 'the-atlantic', 'new-york-times'],
    description: 'International affairs and geopolitics' },

  // ── TIER 4: Health & Wellness ──
  { id: 'cf-19', name: 'Healthline', url: 'https://www.healthline.com/rss', category: 'health', active: true,
    publications: ['well-good', 'health-magazine', 'parents', 'oxygen-magazine'],
    description: 'Evidence-based health and wellness content' },
  { id: 'cf-20', name: 'Psychology Today', url: 'https://www.psychologytoday.com/us/blog/rss', category: 'health', active: true,
    publications: ['psychology-today', 'the-atlantic', 'well-good', 'oprah-daily'],
    description: 'Psychology, mental health, and human behavior' },

  // ── TIER 5: Lifestyle & Culture ──
  { id: 'cf-21', name: 'New York Magazine — The Cut', url: 'https://www.thecut.com/feed/rss/', category: 'lifestyle', active: true,
    publications: ['the-cut', 'allure', 'cosmopolitan', 'vanity-fair', 'bustle'],
    description: 'Style, culture, power, and self' },
  { id: 'cf-22', name: 'Refinery29', url: 'https://www.refinery29.com/rss.xml', category: 'lifestyle', active: true,
    publications: ['cosmopolitan', 'allure', 'bustle', 'essence'],
    description: 'Women-focused lifestyle, fashion, and culture' },

  // ── TIER 6: Science ──
  { id: 'cf-23', name: 'Scientific American', url: 'https://rss.sciam.com/ScientificAmerican-Global', category: 'science', active: true,
    publications: ['scientific-american', 'national-geographic', 'discover-magazine', 'popular-science'],
    description: 'Science news and research for general audiences' },
  { id: 'cf-24', name: 'Nature News', url: 'https://www.nature.com/nature.rss', category: 'science', active: true,
    publications: ['scientific-american', 'new-scientist', 'discover-magazine', 'national-geographic'],
    description: 'Cutting-edge research from Nature journal' },

  // ── TIER 7: Travel & Food ──
  { id: 'cf-25', name: 'Conde Nast Traveler', url: 'https://www.cntraveler.com/feed/rss', category: 'travel', active: true,
    publications: ['conde-nast-traveler', 'afar', 'matador-network'],
    description: 'Luxury travel guides and destination features' },
  { id: 'cf-26', name: 'Eater', url: 'https://www.eater.com/rss/index.xml', category: 'food', active: true,
    publications: ['bon-appetit', 'eating-well', 'diningout'],
    description: 'Restaurant industry, food culture, and dining' },

  // ── TIER 8: Writing Industry Intelligence ──
  { id: 'cf-27', name: 'Nieman Lab', url: 'https://www.niemanlab.org/feed/', category: 'writing_industry', active: true,
    publications: [],  // cross-cutting — supports all publications
    description: 'Future of journalism and media industry trends' },
  { id: 'cf-28', name: 'The Write Life', url: 'https://thewritelife.com/feed/', category: 'writing_industry', active: true,
    publications: [],
    description: 'Freelance writing career advice and markets' },
  { id: 'cf-29', name: 'Contently', url: 'https://contently.com/feed/', category: 'writing_industry', active: true,
    publications: [],
    description: 'Content strategy and marketing intelligence' },

  // ── TIER 9: AI & Global ──
  { id: 'cf-30', name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', category: 'ai', active: true,
    publications: ['mit-tech-review', 'wired', 'fast-company', 'forbes'],
    description: 'AI, biotech, and emerging technology deep-dives' },
  { id: 'cf-31', name: 'Rest of World', url: 'https://restofworld.org/feed/', category: 'global', active: true,
    publications: ['rest-of-world', 'foreign-policy', 'the-atlantic'],
    description: 'Technology impact in non-Western markets' },
];

/** Get feeds relevant to a specific publication */
export function getFeedsForPublication(publicationId: string): CuratedFeed[] {
  return CURATED_FEEDS.filter(f => 
    f.active && (f.publications.length === 0 || f.publications.includes(publicationId))
  );
}

/** Get active feed URLs */
export function getActiveFeedUrls(): string[] {
  return CURATED_FEEDS.filter(f => f.active).map(f => f.url);
}

/** Get feeds by category */
export function getFeedsByCategory(category: FeedCategory): CuratedFeed[] {
  return CURATED_FEEDS.filter(f => f.category === category);
}
