/**
 * DB Hydration Hook
 * Loads persisted data from MySQL via tRPC on mount (when authenticated)
 * and maps DB rows (camelCase) to frontend state shape (snake_case).
 * 
 * Strategy: DB is source of truth for authenticated users.
 * On first load, fetch all entities from DB and merge into local state.
 * Local state still provides instant reactivity; DB provides persistence.
 */
import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import type { ArticleIdea, ResearchNote, Article, Pitch, Earning, Brand } from '@/lib/store';

// Map DB idea row → frontend ArticleIdea
function mapIdea(row: any): ArticleIdea {
  return {
    id: `db_${row.id}`,
    title: row.title || '',
    angle: row.angle || '',
    category: row.category || '',
    news_peg: row.newsPeg || '',
    status: row.status || 'idea',
    score: row.score ?? undefined,
    brand_id: row.brandId ?? undefined,
    matched_publications: [],
    created_at: row.createdAt?.toISOString?.() || new Date().toISOString(),
    updated_at: row.updatedAt?.toISOString?.() || new Date().toISOString(),
  };
}

// Map DB article row → frontend Article
function mapArticle(row: any): Article {
  return {
    id: `db_${row.id}`,
    title: row.title || '',
    content: row.content || '',
    word_count: row.wordCount || 0,
    target_publication: row.targetPublication ?? undefined,
    brand_voice: row.brandVoice || 'professional',
    template: row.template || 'thought-leadership',
    brand_id: row.brandId ?? undefined,
    product_id: row.productId ?? undefined,
    scores: row.scoreData ? (typeof row.scoreData === 'string' ? JSON.parse(row.scoreData) : row.scoreData) : undefined,
    status: row.status || 'draft',
    created_at: row.createdAt?.toISOString?.() || new Date().toISOString(),
    updated_at: row.updatedAt?.toISOString?.() || new Date().toISOString(),
  };
}

// Map DB pitch row → frontend Pitch
function mapPitch(row: any): Pitch {
  return {
    id: `db_${row.id}`,
    article_id: row.articleId ?? undefined,
    publication_id: row.publicationId || '',
    publication_name: row.publicationName || '',
    editor_name: row.editorName || '',
    editor_email: row.editorEmail || '',
    subject: row.subject || '',
    body: row.body || '',
    status: row.status || 'draft',
    sent_at: row.sentAt?.toISOString?.() ?? undefined,
    response_at: row.responseDate?.toISOString?.() ?? undefined,
    created_at: row.createdAt?.toISOString?.() || new Date().toISOString(),
  };
}

// Map DB research row → frontend ResearchNote
function mapResearch(row: any): ResearchNote {
  return {
    id: `db_${row.id}`,
    title: row.title || '',
    content: row.content || '',
    sources: row.sources ? (typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources) : [],
    data_points: row.dataPoints ? (typeof row.dataPoints === 'string' ? JSON.parse(row.dataPoints) : row.dataPoints) : [],
    created_at: row.createdAt?.toISOString?.() || new Date().toISOString(),
  };
}

// Map DB earning row → frontend Earning
function mapEarning(row: any): Earning {
  return {
    id: `db_${row.id}`,
    type: row.type || 'content',
    source: row.source || 'freelance',
    amount: parseFloat(row.amount) || 0,
    publication: row.publication || '',
    description: row.description || '',
    date: row.date?.toISOString?.()?.split('T')[0] || new Date().toISOString().split('T')[0],
    brand_id: row.brandId ?? undefined,
    created_at: row.createdAt?.toISOString?.() || new Date().toISOString(),
  };
}

// Map DB brand row → frontend Brand (products loaded separately)
function mapBrand(row: any): Brand {
  return {
    id: `db_${row.id}`,
    name: row.name || '',
    niche: row.niche || '',
    description: row.description || '',
    website: row.website || '',
    color: row.color || '#a78bfa',
    avatar: { id: '', name: 'Default', demographics: '', psychographics: '', pain_points: [], desires: [], media_habits: [], buying_triggers: [] },
    aligned_publication_ids: row.alignedPublications ? (typeof row.alignedPublications === 'string' ? JSON.parse(row.alignedPublications) : (row.alignedPublications || [])) : [],
    aligned_topics: [],
    products: [],
    content_revenue_goal: 25000,
    product_revenue_goal: 25000,
    monthly_content_revenue: 0,
    monthly_product_revenue: 0,
    created_at: row.createdAt?.toISOString?.() || new Date().toISOString(),
    updated_at: row.updatedAt?.toISOString?.() || new Date().toISOString(),
  };
}

export type HydrationData = {
  ideas: ArticleIdea[];
  articles: Article[];
  pitches: Pitch[];
  research: ResearchNote[];
  earnings: Earning[];
  brands: Brand[];
  settings: Record<string, any> | null;
};

/**
 * Hook that fetches all entities from DB when user is authenticated.
 * Returns the mapped data and a loading flag.
 * The parent component (AppContext) should merge this into state on first load.
 */
export function useDbHydration(): { data: HydrationData | null; isLoading: boolean; isAuthenticated: boolean } {
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  const ideasQuery = trpc.data.ideas.list.useQuery(undefined, { enabled: isAuthenticated });
  const articlesQuery = trpc.data.articles.list.useQuery(undefined, { enabled: isAuthenticated });
  const pitchesQuery = trpc.data.pitches.list.useQuery(undefined, { enabled: isAuthenticated });
  const researchQuery = trpc.data.research.list.useQuery(undefined, { enabled: isAuthenticated });
  const earningsQuery = trpc.data.earnings.list.useQuery(undefined, { enabled: isAuthenticated });
  const brandsQuery = trpc.data.brands.list.useQuery(undefined, { enabled: isAuthenticated });
  const settingsQuery = trpc.data.settings.get.useQuery(undefined, { enabled: isAuthenticated });

  const isLoading = authLoading || 
    (isAuthenticated && (ideasQuery.isLoading || articlesQuery.isLoading || pitchesQuery.isLoading || 
     researchQuery.isLoading || earningsQuery.isLoading || brandsQuery.isLoading || settingsQuery.isLoading));

  if (!isAuthenticated || isLoading) {
    return { data: null, isLoading, isAuthenticated };
  }

  const data: HydrationData = {
    ideas: (ideasQuery.data || []).map(mapIdea),
    articles: (articlesQuery.data || []).map(mapArticle),
    pitches: (pitchesQuery.data || []).map(mapPitch),
    research: (researchQuery.data || []).map(mapResearch),
    earnings: (earningsQuery.data || []).map(mapEarning),
    brands: (brandsQuery.data || []).map(mapBrand),
    settings: settingsQuery.data || null,
  };

  return { data, isLoading: false, isAuthenticated };
}
