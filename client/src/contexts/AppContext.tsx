import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  type AppState, type ArticleIdea, type ResearchNote, type Article, type Pitch,
  type GiststackItem, type Earning, type Brand, type DigitalProduct, type FunnelMetric,
  loadState, saveState, generateId,
} from '@/lib/store';
import { useDbHydration } from '@/hooks/useDbHydration';
import { trpc } from '@/lib/trpc';

interface AppContextType {
  state: AppState;
  isHydrated: boolean;
  // Ideas
  addIdea: (idea: Omit<ArticleIdea, 'id' | 'created_at' | 'updated_at'>) => ArticleIdea;
  updateIdea: (id: string, updates: Partial<ArticleIdea>) => void;
  deleteIdea: (id: string) => void;
  // Research
  addResearch: (note: Omit<ResearchNote, 'id' | 'created_at'>) => ResearchNote;
  updateResearch: (id: string, updates: Partial<ResearchNote>) => void;
  deleteResearch: (id: string) => void;
  // Articles
  addArticle: (article: Omit<Article, 'id' | 'created_at' | 'updated_at'>) => Article;
  updateArticle: (id: string, updates: Partial<Article>) => void;
  deleteArticle: (id: string) => void;
  // Pitches
  addPitch: (pitch: Omit<Pitch, 'id' | 'created_at'>) => Pitch;
  updatePitch: (id: string, updates: Partial<Pitch>) => void;
  deletePitch: (id: string) => void;
  // Giststack
  addGiststackItem: (item: Omit<GiststackItem, 'id' | 'created_at'>) => void;
  toggleGiststackSave: (id: string) => void;
  // Earnings
  addEarning: (earning: Omit<Earning, 'id' | 'created_at'>) => Earning;
  deleteEarning: (id: string) => void;
  // Brands
  addBrand: (brand: Omit<Brand, 'id' | 'created_at' | 'updated_at'>) => Brand;
  updateBrand: (id: string, updates: Partial<Brand>) => void;
  deleteBrand: (id: string) => void;
  // Products (nested under brand)
  addProduct: (brandId: string, product: Omit<DigitalProduct, 'id' | 'created_at'>) => void;
  updateProduct: (brandId: string, productId: string, updates: Partial<DigitalProduct>) => void;
  deleteProduct: (brandId: string, productId: string) => void;
  // Funnel Metrics
  addFunnelMetric: (metric: Omit<FunnelMetric, 'id'>) => void;
  // Settings
  updateSettings: (updates: Partial<AppState['settings']>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [isHydrated, setIsHydrated] = useState(false);
  const hydrationDone = useRef(false);

  // DB hydration — loads persisted data from MySQL when authenticated
  const { data: dbData, isLoading: dbLoading, isAuthenticated } = useDbHydration();
  const settingsMutation = trpc.data.settings.upsert.useMutation();

  // Merge DB data into state on first successful load
  useEffect(() => {
    if (hydrationDone.current) return;
    if (dbLoading) return;

    if (dbData && isAuthenticated) {
      setState(prev => {
        const merged = { ...prev };
        // Merge DB entities — DB data takes priority, but keep local-only items (no db_ prefix)
        if (dbData.ideas.length > 0) {
          const localOnly = prev.ideas.filter(i => !i.id.startsWith('db_'));
          merged.ideas = [...dbData.ideas, ...localOnly];
        }
        if (dbData.articles.length > 0) {
          const localOnly = prev.articles.filter(a => !a.id.startsWith('db_'));
          merged.articles = [...dbData.articles, ...localOnly];
        }
        if (dbData.pitches.length > 0) {
          const localOnly = prev.pitches.filter(p => !p.id.startsWith('db_'));
          merged.pitches = [...dbData.pitches, ...localOnly];
        }
        if (dbData.research.length > 0) {
          const localOnly = prev.research.filter(r => !r.id.startsWith('db_'));
          merged.research = [...dbData.research, ...localOnly];
        }
        if (dbData.earnings.length > 0) {
          const localOnly = prev.earnings.filter(e => !e.id.startsWith('db_'));
          merged.earnings = [...dbData.earnings, ...localOnly];
        }
        if (dbData.brands.length > 0) {
          const localOnly = prev.brands.filter(b => !b.id.startsWith('db_'));
          merged.brands = [...dbData.brands, ...localOnly];
        }
        // Merge DB settings (overrides localStorage defaults)
        if (dbData.settings) {
          merged.settings = { ...merged.settings, ...dbData.settings };
        }
        return merged;
      });
      hydrationDone.current = true;
      setIsHydrated(true);
    } else if (!isAuthenticated && !dbLoading) {
      // Not authenticated — just use localStorage state
      hydrationDone.current = true;
      setIsHydrated(true);
    }
  }, [dbData, dbLoading, isAuthenticated]);

  // Save to localStorage on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // ── Ideas ──
  const addIdea = useCallback((idea: Omit<ArticleIdea, 'id' | 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString();
    const newIdea: ArticleIdea = { ...idea, id: generateId(), created_at: now, updated_at: now };
    setState(s => ({ ...s, ideas: [newIdea, ...s.ideas] }));
    return newIdea;
  }, []);

  const updateIdea = useCallback((id: string, updates: Partial<ArticleIdea>) => {
    setState(s => ({
      ...s,
      ideas: s.ideas.map(i => i.id === id ? { ...i, ...updates, updated_at: new Date().toISOString() } : i),
    }));
  }, []);

  const deleteIdea = useCallback((id: string) => {
    setState(s => ({ ...s, ideas: s.ideas.filter(i => i.id !== id) }));
  }, []);

  // ── Research ──
  const addResearch = useCallback((note: Omit<ResearchNote, 'id' | 'created_at'>) => {
    const newNote: ResearchNote = { ...note, id: generateId(), created_at: new Date().toISOString() };
    setState(s => ({ ...s, research: [newNote, ...s.research] }));
    return newNote;
  }, []);

  const updateResearch = useCallback((id: string, updates: Partial<ResearchNote>) => {
    setState(s => ({
      ...s,
      research: s.research.map(r => r.id === id ? { ...r, ...updates } : r),
    }));
  }, []);

  const deleteResearch = useCallback((id: string) => {
    setState(s => ({ ...s, research: s.research.filter(r => r.id !== id) }));
  }, []);

  // ── Articles ──
  const addArticle = useCallback((article: Omit<Article, 'id' | 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString();
    const newArticle: Article = { ...article, id: generateId(), created_at: now, updated_at: now };
    setState(s => ({ ...s, articles: [newArticle, ...s.articles] }));
    return newArticle;
  }, []);

  const updateArticle = useCallback((id: string, updates: Partial<Article>) => {
    setState(s => ({
      ...s,
      articles: s.articles.map(a => a.id === id ? { ...a, ...updates, updated_at: new Date().toISOString() } : a),
    }));
  }, []);

  const deleteArticle = useCallback((id: string) => {
    setState(s => ({ ...s, articles: s.articles.filter(a => a.id !== id) }));
  }, []);

  // ── Pitches ──
  const addPitch = useCallback((pitch: Omit<Pitch, 'id' | 'created_at'>) => {
    const newPitch: Pitch = { ...pitch, id: generateId(), created_at: new Date().toISOString() };
    setState(s => ({ ...s, pitches: [newPitch, ...s.pitches] }));
    return newPitch;
  }, []);

  const updatePitch = useCallback((id: string, updates: Partial<Pitch>) => {
    setState(s => ({
      ...s,
      pitches: s.pitches.map(p => p.id === id ? { ...p, ...updates } : p),
    }));
  }, []);

  const deletePitch = useCallback((id: string) => {
    setState(s => ({ ...s, pitches: s.pitches.filter(p => p.id !== id) }));
  }, []);

  // ── Giststack ──
  const addGiststackItem = useCallback((item: Omit<GiststackItem, 'id' | 'created_at'>) => {
    setState(s => ({
      ...s,
      giststack: [{ ...item, id: generateId(), created_at: new Date().toISOString() }, ...s.giststack],
    }));
  }, []);

  const toggleGiststackSave = useCallback((id: string) => {
    setState(s => ({
      ...s,
      giststack: s.giststack.map(g => g.id === id ? { ...g, saved: !g.saved } : g),
    }));
  }, []);

  // ── Earnings ──
  const addEarning = useCallback((earning: Omit<Earning, 'id' | 'created_at'>) => {
    const newEarning: Earning = { ...earning, id: generateId(), created_at: new Date().toISOString() };
    setState(s => ({ ...s, earnings: [newEarning, ...s.earnings] }));
    return newEarning;
  }, []);

  const deleteEarning = useCallback((id: string) => {
    setState(s => ({ ...s, earnings: s.earnings.filter(e => e.id !== id) }));
  }, []);

  // ── Brands ──
  const addBrand = useCallback((brand: Omit<Brand, 'id' | 'created_at' | 'updated_at'>) => {
    const now = new Date().toISOString();
    const newBrand: Brand = { ...brand, id: generateId(), created_at: now, updated_at: now };
    setState(s => ({ ...s, brands: [newBrand, ...s.brands] }));
    return newBrand;
  }, []);

  const updateBrand = useCallback((id: string, updates: Partial<Brand>) => {
    setState(s => ({
      ...s,
      brands: s.brands.map(b => b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b),
    }));
  }, []);

  const deleteBrand = useCallback((id: string) => {
    setState(s => ({ ...s, brands: s.brands.filter(b => b.id !== id) }));
  }, []);

  // ── Products (nested under brand) ──
  const addProduct = useCallback((brandId: string, product: Omit<DigitalProduct, 'id' | 'created_at'>) => {
    setState(s => ({
      ...s,
      brands: s.brands.map(b => b.id === brandId ? {
        ...b,
        products: [...b.products, { ...product, id: generateId(), created_at: new Date().toISOString() }],
        updated_at: new Date().toISOString(),
      } : b),
    }));
  }, []);

  const updateProduct = useCallback((brandId: string, productId: string, updates: Partial<DigitalProduct>) => {
    setState(s => ({
      ...s,
      brands: s.brands.map(b => b.id === brandId ? {
        ...b,
        products: b.products.map(p => p.id === productId ? { ...p, ...updates } : p),
        updated_at: new Date().toISOString(),
      } : b),
    }));
  }, []);

  const deleteProduct = useCallback((brandId: string, productId: string) => {
    setState(s => ({
      ...s,
      brands: s.brands.map(b => b.id === brandId ? {
        ...b,
        products: b.products.filter(p => p.id !== productId),
        updated_at: new Date().toISOString(),
      } : b),
    }));
  }, []);

  // ── Funnel Metrics ──
  const addFunnelMetric = useCallback((metric: Omit<FunnelMetric, 'id'>) => {
    setState(s => ({
      ...s,
      funnel_metrics: [{ ...metric, id: generateId() }, ...s.funnel_metrics],
    }));
  }, []);

  // ── Settings ── (persisted to DB)
  const updateSettings = useCallback((updates: Partial<AppState['settings']>) => {
    setState(s => {
      const newSettings = { ...s.settings, ...updates };
      // Persist to DB (fire-and-forget, localStorage is the fast cache)
      settingsMutation.mutate({ settings: newSettings });
      return { ...s, settings: newSettings };
    });
  }, [settingsMutation]);

  return (
    <AppContext.Provider value={{
      state,
      isHydrated,
      addIdea, updateIdea, deleteIdea,
      addResearch, updateResearch, deleteResearch,
      addArticle, updateArticle, deleteArticle,
      addPitch, updatePitch, deletePitch,
      addGiststackItem, toggleGiststackSave,
      addEarning, deleteEarning,
      addBrand, updateBrand, deleteBrand,
      addProduct, updateProduct, deleteProduct,
      addFunnelMetric,
      updateSettings,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
