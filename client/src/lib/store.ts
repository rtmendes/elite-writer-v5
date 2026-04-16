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
  created_at: string;
}

export interface AppState {
  ideas: ArticleIdea[];
  research: ResearchNote[];
  articles: Article[];
  pitches: Pitch[];
  giststack: GiststackItem[];
  earnings: Earning[];
  settings: {
    openai_key: string;
    brand_voice: string;
    daily_target: number;
    monthly_revenue_goal: number;
  };
}

const STORAGE_KEY = 'elite_writer_v5_state';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getDefaultState(): AppState {
  return {
    ideas: [],
    research: [],
    articles: [],
    pitches: [],
    giststack: [],
    earnings: [],
    settings: {
      openai_key: '',
      brand_voice: 'Insight Profit',
      daily_target: 10,
      monthly_revenue_goal: 100000,
    },
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...getDefaultState(), ...parsed };
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
