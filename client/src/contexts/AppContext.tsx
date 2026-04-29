/**
 * AppProvider — Thin Effects Layer
 * 
 * Enterprise architecture: Zustand owns all state + actions.
 * This component ONLY handles:
 *   1. DB hydration (needs tRPC React hooks)
 *   2. Settings sync to DB (needs tRPC mutation hook)
 * 
 * No Provider value object = no context cascade = no #310.
 * 
 * @see appStore.ts for the Zustand store
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useDbHydration } from '@/hooks/useDbHydration';
import { trpc } from '@/lib/trpc';
import { useAppStore } from '@/lib/appStore';
import { useShallow } from 'zustand/shallow';
import type {
  AppState, ArticleIdea, ResearchNote, Article, Pitch,
  GiststackItem, Earning, Brand, DigitalProduct, FunnelMetric,
} from '@/lib/store';

// ── AppProvider (effects only, no context value) ────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  const hydrationDone = useRef(false);

  // DB hydration — loads persisted data from MySQL when authenticated
  const { data: dbData, isLoading: dbLoading, isAuthenticated } = useDbHydration();
  const settingsMutation = trpc.data.settings.upsert.useMutation();
  const settingsMutationRef = useRef(settingsMutation);
  settingsMutationRef.current = settingsMutation;

  // Zustand store actions
  const mergeDbData = useAppStore((s) => s.mergeDbData);
  const markHydratedNoAuth = useAppStore((s) => s.markHydratedNoAuth);

  // Merge DB data into Zustand on first successful load
  useEffect(() => {
    if (hydrationDone.current) return;
    if (dbLoading) return;

    if (dbData && isAuthenticated) {
      mergeDbData(dbData);
      hydrationDone.current = true;
    } else if (!isAuthenticated && !dbLoading) {
      markHydratedNoAuth();
      hydrationDone.current = true;
    }
  }, [dbData, dbLoading, isAuthenticated, mergeDbData, markHydratedNoAuth]);

  // Sync settings changes to DB via tRPC
  const pendingSettings = useAppStore((s) => s._pendingSettingsUpdate);
  const clearPendingSettings = useAppStore((s) => s._clearPendingSettings);

  useEffect(() => {
    if (pendingSettings) {
      settingsMutationRef.current.mutate({ settings: pendingSettings });
      clearPendingSettings();
    }
  }, [pendingSettings, clearPendingSettings]);

  return <>{children}</>;
}

// ── useApp() — Backward-Compatible Hook ─────────────────────────
// Uses Zustand with useShallow so consumers only re-render when their
// destructured fields actually change. All action refs are stable.
//
// Usage: const { state, addIdea, updateIdea } = useApp();
// Identical API to the old Context — zero consumer changes needed.
export function useApp() {
  return useAppStore(
    useShallow((s) => ({
      state: s.state,
      isHydrated: s.isHydrated,
      addIdea: s.addIdea,
      updateIdea: s.updateIdea,
      deleteIdea: s.deleteIdea,
      addResearch: s.addResearch,
      updateResearch: s.updateResearch,
      deleteResearch: s.deleteResearch,
      addArticle: s.addArticle,
      updateArticle: s.updateArticle,
      deleteArticle: s.deleteArticle,
      addPitch: s.addPitch,
      updatePitch: s.updatePitch,
      deletePitch: s.deletePitch,
      addGiststackItem: s.addGiststackItem,
      toggleGiststackSave: s.toggleGiststackSave,
      addEarning: s.addEarning,
      deleteEarning: s.deleteEarning,
      addBrand: s.addBrand,
      updateBrand: s.updateBrand,
      deleteBrand: s.deleteBrand,
      addProduct: s.addProduct,
      updateProduct: s.updateProduct,
      deleteProduct: s.deleteProduct,
      addFunnelMetric: s.addFunnelMetric,
      updateSettings: s.updateSettings,
    }))
  );
}
