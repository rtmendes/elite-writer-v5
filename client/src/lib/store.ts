// Elite Writer V5 — Global App Store
// Uses localStorage for persistence, React context for reactivity

export interface ArticleIdea {
  id: string;
  title: string;
  angle: string;
  category: string;
  news_peg: string;
  status: 'idea' | 'researching' | 'drafting' | 'scoring' | 'pitching' | 'published';
  score?: number;
  matched_publications?: string[];
  brand_id?: string;
  product_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ResearchNote {
  id: string;
  idea_id?: string;
  title: string;
  content: string;
  sources: string[];
  data_points: { label: string; value: string; source: string }[];
  created_at: string;
}

export interface Article {
  id: string;
  idea_id?: string;
  title: string;
  content: string;
  word_count: number;
  target_publication?: string;
  brand_voice: string;
  template: string;
  brand_id?: string;
  product_id?: string;
  funnel_cta?: string;
  scores?: ArticleScores;
  status: 'draft' | 'scoring' | 'editing' | 'ready' | 'pitched' | 'published';
  created_at: string;
  updated_at: string;
}

export interface ArticleScores {
  overall: number;
  clarity_structure: number;
  hook_engagement: number;
  voice_tone: number;
  data_evidence: number;
  originality_angle: number;
  publication_fit: number;
  timeliness: number;
  actionability: number;
  expertise_depth: number;
  readability: number;
  conclusion_cta: number;
  reader_resonance?: number;
  editor_alignment?: number;
  healthClaimsSafety?: number;
  healthClaimsFlaggedPhrases?: string[];
  suggestions?: { category: string; title: string; impact: number; action_items: string[] }[];
}

export interface Pitch {
  id: string;
  article_id?: string;
  publication_id: string;
  publication_name: string;
  editor_name: string;
  editor_email: string;
  subject: string;
  body: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'no_response';
  sent_at?: string;
  response_at?: string;
  payment?: number;
  brand_id?: string;
  product_id?: string;
  created_at: string;
}

export interface GiststackItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  relevance_score: number;
  saved: boolean;
  created_at: string;
}

export interface Earning {
  id: string;
  amount: number;
  source: string;
  publication: string;
  description: string;
  date: string;
  type: 'content' | 'product';
  brand_id?: string;
  product_id?: string;
  created_at: string;
}

// ── Brand & Product Engine ──────────────────────────────────────

export interface CustomerAvatar {
  id: string;
  name: string;
  demographics: string;
  psychographics: string;
  pain_points: string[];
  desires: string[];
  media_habits: string[];
  buying_triggers: string[];
}

export interface DigitalProduct {
  id: string;
  brand_id: string;
  name: string;
  type: 'course' | 'ebook' | 'membership' | 'coaching' | 'template' | 'saas' | 'supplement' | 'physical' | 'other';
  price: number;
  margin_pct: number;
  description: string;
  landing_url: string;
  cta_text: string;
  status: 'concept' | 'building' | 'launched' | 'scaling';
  monthly_revenue: number;
  monthly_units: number;
  created_at: string;
}

export interface Brand {
  id: string;
  name: string;
  niche: string;
  description: string;
  website: string;
  color: string;
  avatar: CustomerAvatar;
  aligned_publication_ids: string[];
  aligned_topics: string[];
  products: DigitalProduct[];
  content_revenue_goal: number;
  product_revenue_goal: number;
  monthly_content_revenue: number;
  monthly_product_revenue: number;
  created_at: string;
  updated_at: string;
}

export interface FunnelMetric {
  id: string;
  brand_id: string;
  month: string; // YYYY-MM
  articles_published: number;
  total_traffic: number;
  leads_captured: number;
  product_sales: number;
  content_revenue: number;
  product_revenue: number;
}

// ── App State ───────────────────────────────────────────────────

export interface AppState {
  ideas: ArticleIdea[];
  research: ResearchNote[];
  articles: Article[];
  pitches: Pitch[];
  giststack: GiststackItem[];
  earnings: Earning[];
  brands: Brand[];
  funnel_metrics: FunnelMetric[];
  settings: {
    openai_key: string;
    brand_voice: string;
    daily_target: number;
    monthly_revenue_goal: number;
    content_revenue_goal: number;
    product_revenue_goal: number;
    tracked_topics: string[];
  };
}

const STORAGE_KEY = 'elite_writer_v5_state';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Seed brand: Second Spring (Women's Health / Perimenopause)
function getDefaultBrands(): Brand[] {
  return [
    {
      id: 'brand_second_spring',
      name: 'Second Spring',
      niche: "Women's Health & Perimenopause",
      description: 'Empowering women 40-55 navigating perimenopause with science-backed wellness solutions, community support, and personalized health tracking.',
      website: 'secondspring.com',
      color: '#e879a0',
      avatar: {
        id: 'avatar_ss_1',
        name: 'Sarah — The Overwhelmed Achiever',
        demographics: 'Women 40-55, upper-middle income, professional career, managing family (preteens + aging parents)',
        psychographics: 'Health-conscious but frustrated by lack of medical support, seeks community and validation, values science-backed solutions over fads',
        pain_points: [
          'Hot flashes disrupting work and sleep',
          'Brain fog affecting career performance',
          'Mood swings impacting family relationships',
          'Fatigue making exercise feel impossible',
          'Medical gaslighting from uninformed doctors',
          'Balancing caregiving for kids AND aging parents',
        ],
        desires: [
          'Feel in control of her body again',
          'Find a supportive community of women who understand',
          'Get personalized, data-driven health insights',
          'Maintain career momentum despite symptoms',
          'Simple daily wellness routine that actually works',
        ],
        media_habits: [
          'Reads Health Magazine, Oprah Daily, SELF, Good Housekeeping',
          'Follows wellness influencers on Instagram',
          'Listens to health podcasts during commute',
          'Subscribes to 2-3 health newsletters',
          'Active in Facebook groups for perimenopause support',
        ],
        buying_triggers: [
          'Testimonials from women with similar symptoms',
          'Doctor or expert endorsements',
          'Free trial or symptom quiz as entry point',
          'Community access included with purchase',
          'Money-back guarantee reduces risk',
        ],
      },
      aligned_publication_ids: [
        'health-magazine', 'oprah-daily', 'self', 'good-housekeeping',
        'womens-health', 'parents', 'real-simple', 'prevention',
        'elle', 'glamour', 'cosmopolitan', 'refinery29',
      ],
      aligned_topics: [
        'perimenopause', 'menopause', "women's health", 'hormone health',
        'wellness', 'self-care', 'mental health', 'aging well',
        'work-life balance', 'caregiving', 'nutrition', 'sleep health',
      ],
      products: [
        {
          id: 'prod_ss_app',
          brand_id: 'brand_second_spring',
          name: 'Second Spring Health Tracker App',
          type: 'saas',
          price: 14.99,
          margin_pct: 90,
          description: 'Daily symptom tracking, personalized insights, community support, and expert resources for perimenopause.',
          landing_url: 'secondspring.com/app',
          cta_text: 'Start Your Free Symptom Assessment',
          status: 'building',
          monthly_revenue: 0,
          monthly_units: 0,
          created_at: new Date().toISOString(),
        },
        {
          id: 'prod_ss_course',
          brand_id: 'brand_second_spring',
          name: 'Thrive Through Perimenopause Masterclass',
          type: 'course',
          price: 197,
          margin_pct: 92,
          description: '8-week video course with hormone specialist Dr. Sarah Chen covering symptom management, nutrition, exercise, and mindset.',
          landing_url: 'secondspring.com/masterclass',
          cta_text: 'Join 5,000+ Women Who Took Control',
          status: 'concept',
          monthly_revenue: 0,
          monthly_units: 0,
          created_at: new Date().toISOString(),
        },
        {
          id: 'prod_ss_ebook',
          brand_id: 'brand_second_spring',
          name: 'The Perimenopause Playbook',
          type: 'ebook',
          price: 27,
          margin_pct: 95,
          description: 'Comprehensive 200-page guide to navigating perimenopause with actionable checklists, meal plans, and exercise routines.',
          landing_url: 'secondspring.com/playbook',
          cta_text: 'Download Your Free Chapter',
          status: 'concept',
          monthly_revenue: 0,
          monthly_units: 0,
          created_at: new Date().toISOString(),
        },
      ],
      content_revenue_goal: 25000,
      product_revenue_goal: 25000,
      monthly_content_revenue: 0,
      monthly_product_revenue: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'brand_insight_profit',
      name: 'Insight Profit',
      niche: 'Business & Finance Intelligence',
      description: 'Data-driven business intelligence and financial analysis for entrepreneurs, investors, and executives who need actionable insights.',
      website: 'insightprofit.live',
      color: '#a78bfa',
      avatar: {
        id: 'avatar_ip_1',
        name: 'Marcus — The Data-Driven Founder',
        demographics: 'Men 30-50, entrepreneurs/executives, $150K+ income, tech-savvy, MBA or self-educated',
        psychographics: 'Values efficiency and ROI, skeptical of hype, wants data-backed decisions, reads Bloomberg/HBR daily',
        pain_points: [
          'Information overload — too many sources, not enough signal',
          'Needs competitive intelligence without hiring analysts',
          'Wants to identify market trends before competitors',
          'Struggles to create thought leadership content at scale',
          'Needs to build authority to attract investors/partners',
        ],
        desires: [
          'Be seen as a thought leader in his industry',
          'Get curated, actionable business intelligence daily',
          'Scale content creation without sacrificing quality',
          'Build a media presence that drives deal flow',
          'Automate research and analysis workflows',
        ],
        media_habits: [
          'Reads Bloomberg, HBR, Forbes, Fast Company, TechCrunch',
          'Subscribes to Stratechery, The Hustle, Morning Brew',
          'Active on LinkedIn and Twitter/X for business networking',
          'Listens to business podcasts (All-In, My First Million)',
          'Uses Gist, Feedly, or Flipboard for news curation',
        ],
        buying_triggers: [
          'ROI calculators and case studies',
          'Free tier or trial that demonstrates value immediately',
          'Integration with existing workflow tools',
          'Peer recommendations from other founders',
          'Time savings quantified (e.g., "saves 10 hours/week")',
        ],
      },
      aligned_publication_ids: [
        'bloomberg-businessweek', 'harvard-business-review', 'forbes',
        'fast-company', 'inc', 'entrepreneur', 'techcrunch',
        'business-insider', 'fortune', 'quartz', 'wired',
        'mit-technology-review', 'the-atlantic',
      ],
      aligned_topics: [
        'business strategy', 'fintech', 'AI in business', 'entrepreneurship',
        'venture capital', 'market analysis', 'digital transformation',
        'leadership', 'productivity', 'SaaS', 'data analytics',
      ],
      products: [
        {
          id: 'prod_ip_platform',
          brand_id: 'brand_insight_profit',
          name: 'Insight Profit Intelligence Platform',
          type: 'saas',
          price: 49,
          margin_pct: 88,
          description: 'AI-powered business intelligence dashboard with curated news feeds, competitive analysis, and content creation tools.',
          landing_url: 'insightprofit.live/platform',
          cta_text: 'Start Your Free Intelligence Brief',
          status: 'building',
          monthly_revenue: 0,
          monthly_units: 0,
          created_at: new Date().toISOString(),
        },
        {
          id: 'prod_ip_mastermind',
          brand_id: 'brand_insight_profit',
          name: 'Founder Intelligence Mastermind',
          type: 'membership',
          price: 297,
          margin_pct: 85,
          description: 'Monthly mastermind with curated intelligence briefings, expert guest speakers, and peer networking for founders.',
          landing_url: 'insightprofit.live/mastermind',
          cta_text: 'Apply for Membership',
          status: 'concept',
          monthly_revenue: 0,
          monthly_units: 0,
          created_at: new Date().toISOString(),
        },
      ],
      content_revenue_goal: 50000,
      product_revenue_goal: 50000,
      monthly_content_revenue: 0,
      monthly_product_revenue: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

function getDefaultState(): AppState {
  return {
    ideas: [],
    research: [],
    articles: [],
    pitches: [],
    giststack: [],
    earnings: [],
    brands: getDefaultBrands(),
    funnel_metrics: [],
    settings: {
      openai_key: '',
      brand_voice: 'Insight Profit',
      daily_target: 10,
      monthly_revenue_goal: 200000,
      content_revenue_goal: 100000,
      product_revenue_goal: 100000,
      tracked_topics: ['AI & Technology', 'Business', 'Future of Work', 'Health', 'Finance'],
    },
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const defaults = getDefaultState();
      return {
        ...defaults,
        ...parsed,
        brands: parsed.brands?.length ? parsed.brands : defaults.brands,
        funnel_metrics: parsed.funnel_metrics ?? [],
        settings: { ...defaults.settings, ...parsed.settings },
      };
    }
  } catch (e) {
    console.warn('Failed to load state:', e);
  }
  return getDefaultState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}

export { generateId };
