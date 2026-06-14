/**
 * Elite Writer V5 — Zustand Global Store
 * 
 * Enterprise-grade state management replacing React Context.
 * - Atomic subscriptions: components only re-render when their selected slice changes
 * - Stable action references: no unnecessary child re-renders from callback identity changes
 * - No Provider value cascade: state lives outside the React tree
 * - localStorage persistence via subscribe
 * 
 * @see https://zustand.docs.pmnd.rs/
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  type AppState, type ArticleIdea, type ResearchNote, type Article, type Pitch,
  type GiststackItem, type Earning, type Brand, type DigitalProduct, type FunnelMetric,
  loadState, saveState, generateId,
} from './store';

// ── Store Interface ────────────────────────────────────────────────
export interface AppStore {
  // State
  state: AppState;
  isHydrated: boolean;

  // Hydration
  setHydrated: (v: boolean) => void;
  mergeDbData: (dbData: {
    ideas: ArticleIdea[];
    articles: Article[];
    pitches: Pitch[];
    research: ResearchNote[];
    earnings: Earning[];
    brands: Brand[];
    settings: AppState['settings'] | null;
  }) => void;
  markHydratedNoAuth: () => void;

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

  // Internal: called by settings sync hook to fire tRPC mutation
  _pendingSettingsUpdate: Partial<AppState['settings']> | null;
  _clearPendingSettings: () => void;
}

// ── Store Implementation ───────────────────────────────────────────
export const useAppStore = create<AppStore>()(
  subscribeWithSelector((set, get) => ({
    state: loadState(),
    isHydrated: false,

    // ── Hydration ──
    setHydrated: (v) => set({ isHydrated: v }),

    mergeDbData: (dbData) => {
      set((s) => {
        const prev = s.state;
        const merged = { ...prev };

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
        if (dbData.settings) {
          merged.settings = { ...merged.settings, ...dbData.settings };
        }

        return { state: merged, isHydrated: true };
      });
    },

    markHydratedNoAuth: () => set({ isHydrated: true }),

    // ── Ideas ──
    addIdea: (idea) => {
      const now = new Date().toISOString();
      const newIdea: ArticleIdea = { ...idea, id: generateId(), created_at: now, updated_at: now };
      set((s) => ({ state: { ...s.state, ideas: [newIdea, ...s.state.ideas] } }));
      return newIdea;
    },
    updateIdea: (id, updates) => {
      set((s) => ({
        state: {
          ...s.state,
          ideas: s.state.ideas.map(i => i.id === id ? { ...i, ...updates, updated_at: new Date().toISOString() } : i),
        },
      }));
    },
    deleteIdea: (id) => {
      set((s) => ({ state: { ...s.state, ideas: s.state.ideas.filter(i => i.id !== id) } }));
    },

    // ── Research ──
    addResearch: (note) => {
      const newNote: ResearchNote = { ...note, id: generateId(), created_at: new Date().toISOString() };
      set((s) => ({ state: { ...s.state, research: [newNote, ...s.state.research] } }));
      return newNote;
    },
    updateResearch: (id, updates) => {
      set((s) => ({
        state: {
          ...s.state,
          research: s.state.research.map(r => r.id === id ? { ...r, ...updates } : r),
        },
      }));
    },
    deleteResearch: (id) => {
      set((s) => ({ state: { ...s.state, research: s.state.research.filter(r => r.id !== id) } }));
    },

    // ── Articles ──
    addArticle: (article) => {
      const now = new Date().toISOString();
      const newArticle: Article = { ...article, id: generateId(), created_at: now, updated_at: now };
      set((s) => ({ state: { ...s.state, articles: [newArticle, ...s.state.articles] } }));
      return newArticle;
    },
    updateArticle: (id, updates) => {
      set((s) => ({
        state: {
          ...s.state,
          articles: s.state.articles.map(a => a.id === id ? { ...a, ...updates, updated_at: new Date().toISOString() } : a),
        },
      }));
    },
    deleteArticle: (id) => {
      set((s) => ({ state: { ...s.state, articles: s.state.articles.filter(a => a.id !== id) } }));
    },

    // ── Pitches ──
    addPitch: (pitch) => {
      const newPitch: Pitch = { ...pitch, id: generateId(), created_at: new Date().toISOString() };
      set((s) => ({ state: { ...s.state, pitches: [newPitch, ...s.state.pitches] } }));
      return newPitch;
    },
    updatePitch: (id, updates) => {
      set((s) => ({
        state: {
          ...s.state,
          pitches: s.state.pitches.map(p => p.id === id ? { ...p, ...updates } : p),
        },
      }));
    },
    deletePitch: (id) => {
      set((s) => ({ state: { ...s.state, pitches: s.state.pitches.filter(p => p.id !== id) } }));
    },

    // ── Giststack ──
    addGiststackItem: (item) => {
      set((s) => ({
        state: {
          ...s.state,
          giststack: [{ ...item, id: generateId(), created_at: new Date().toISOString() }, ...s.state.giststack],
        },
      }));
    },
    toggleGiststackSave: (id) => {
      set((s) => ({
        state: {
          ...s.state,
          giststack: s.state.giststack.map(g => g.id === id ? { ...g, saved: !g.saved } : g),
        },
      }));
    },

    // ── Earnings ──
    addEarning: (earning) => {
      const newEarning: Earning = { ...earning, id: generateId(), created_at: new Date().toISOString() };
      set((s) => ({ state: { ...s.state, earnings: [newEarning, ...s.state.earnings] } }));
      return newEarning;
    },
    deleteEarning: (id) => {
      set((s) => ({ state: { ...s.state, earnings: s.state.earnings.filter(e => e.id !== id) } }));
    },

    // ── Brands ──
    addBrand: (brand) => {
      const now = new Date().toISOString();
      const newBrand: Brand = { ...brand, id: generateId(), created_at: now, updated_at: now };
      set((s) => ({ state: { ...s.state, brands: [newBrand, ...s.state.brands] } }));
      return newBrand;
    },
    updateBrand: (id, updates) => {
      set((s) => ({
        state: {
          ...s.state,
          brands: s.state.brands.map(b => b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b),
        },
      }));
    },
    deleteBrand: (id) => {
      set((s) => ({ state: { ...s.state, brands: s.state.brands.filter(b => b.id !== id) } }));
    },

    // ── Products (nested under brand) ──
    addProduct: (brandId, product) => {
      set((s) => ({
        state: {
          ...s.state,
          brands: s.state.brands.map(b => b.id === brandId ? {
            ...b,
            products: [...b.products, { ...product, id: generateId(), created_at: new Date().toISOString() }],
            updated_at: new Date().toISOString(),
          } : b),
        },
      }));
    },
    updateProduct: (brandId, productId, updates) => {
      set((s) => ({
        state: {
          ...s.state,
          brands: s.state.brands.map(b => b.id === brandId ? {
            ...b,
            products: b.products.map(p => p.id === productId ? { ...p, ...updates } : p),
            updated_at: new Date().toISOString(),
          } : b),
        },
      }));
    },
    deleteProduct: (brandId, productId) => {
      set((s) => ({
        state: {
          ...s.state,
          brands: s.state.brands.map(b => b.id === brandId ? {
            ...b,
            products: b.products.filter(p => p.id !== productId),
            updated_at: new Date().toISOString(),
          } : b),
        },
      }));
    },

    // ── Funnel Metrics ──
    addFunnelMetric: (metric) => {
      set((s) => ({
        state: {
          ...s.state,
          funnel_metrics: [{ ...metric, id: generateId() }, ...s.state.funnel_metrics],
        },
      }));
    },

    // ── Settings ──
    _pendingSettingsUpdate: null,
    _clearPendingSettings: () => set({ _pendingSettingsUpdate: null }),

    updateSettings: (updates) => {
      set((s) => ({
        state: { ...s.state, settings: { ...s.state.settings, ...updates } },
        _pendingSettingsUpdate: updates,
      }));
    },
  }))
);

// ── Auto-persist to localStorage ──
useAppStore.subscribe(
  (s) => s.state,
  (state) => saveState(state),
);
