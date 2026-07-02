import { useCallback, useMemo, useState } from "react";

/**
 * Shared row multi-select (UI standard: every collection view gets it).
 * Page-level twin of the workspace hook in workspace/database/views.tsx —
 * select-all is scoped to the currently visible (filtered) rows, matching
 * the behavior shipped in Queue.tsx.
 */
export function useSelection<Id extends string | number>(visibleIds: Id[]) {
  const [selected, setSelected] = useState<Set<Id>>(new Set());

  const toggle = useCallback((id: Id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      if (visibleIds.length > 0 && visibleIds.every(id => prev.has(id))) return new Set();
      return new Set(visibleIds);
    });
  }, [visibleIds]);

  const clear = useCallback(() => setSelected(new Set()), []);

  const selectedList = useMemo(() => [...selected], [selected]);

  return { selected, selectedList, toggle, allSelected, toggleAll, clear, setSelected };
}
