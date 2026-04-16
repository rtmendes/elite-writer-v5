import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { type AppState, type ArticleIdea, type ResearchNote, type Article, type Pitch, type GiststackItem, type Earning, loadState, saveState, generateId } from '@/lib/store';

interface AppContextType {
  state: AppState;
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
  // Settings
  updateSettings: (updates: Partial<AppState['settings']>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

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

  const addEarning = useCallback((earning: Omit<Earning, 'id' | 'created_at'>) => {
    const newEarning: Earning = { ...earning, id: generateId(), created_at: new Date().toISOString() };
    setState(s => ({ ...s, earnings: [newEarning, ...s.earnings] }));
    return newEarning;
  }, []);

  const deleteEarning = useCallback((id: string) => {
    setState(s => ({ ...s, earnings: s.earnings.filter(e => e.id !== id) }));
  }, []);

  const updateSettings = useCallback((updates: Partial<AppState['settings']>) => {
    setState(s => ({ ...s, settings: { ...s.settings, ...updates } }));
  }, []);

  return (
    <AppContext.Provider value={{
      state,
      addIdea, updateIdea, deleteIdea,
      addResearch, updateResearch, deleteResearch,
      addArticle, updateArticle, deleteArticle,
      addPitch, updatePitch, deletePitch,
      addGiststackItem, toggleGiststackSave,
      addEarning, deleteEarning,
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
