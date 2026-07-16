/**
 * SavedViewBar — per-user saved collection views (Admin UX, PRD_ADMIN_UX.md).
 *
 * Renders a row of saved-view chips + a "Save view" control for one collection
 * page. View state (search/filters/sort/columns/mode) is opaque to this bar —
 * the page owns it and passes the current snapshot in `currentConfig`; applying
 * a saved view calls `onApply(config)`.
 *
 * Backed by the savedViews tRPC router (Phase 1).
 */
import { useState } from "react";
import { Bookmark, Plus, Trash2, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

export interface ViewConfig {
  search?: string;
  filters?: Record<string, unknown>;
  sort?: { field: string; dir: "asc" | "desc" } | null;
  columns?: string[];
  mode?: "list" | "gallery" | "kanban";
}

export function SavedViewBar({
  page, currentConfig, activeViewId, onApply,
}: {
  page: string;
  currentConfig: ViewConfig;
  activeViewId: number | null;
  onApply: (id: number | null, config: ViewConfig | null) => void;
}) {
  const utils = trpc.useUtils();
  const views = trpc.savedViews.list.useQuery({ page });
  const create = trpc.savedViews.create.useMutation({
    onSuccess: () => { utils.savedViews.list.invalidate({ page }); toast.success("View saved"); },
  });
  const del = trpc.savedViews.delete.useMutation({
    onSuccess: () => { utils.savedViews.list.invalidate({ page }); },
  });
  const [name, setName] = useState("");
  const [openSave, setOpenSave] = useState(false);

  const list = views.data ?? [];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Bookmark className="h-3.5 w-3.5 text-muted-foreground" />
      <button
        className={`rounded-full px-2.5 py-1 text-xs transition-colors ${activeViewId === null ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}
        onClick={() => onApply(null, null)}
      >
        All
      </button>
      {list.map((v) => (
        <span key={v.id} className={`group inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors ${activeViewId === v.id ? "bg-primary/15 font-medium text-primary" : "text-muted-foreground hover:bg-muted"}`}>
          <button onClick={() => onApply(v.id, v.config as ViewConfig)}>{v.name}</button>
          <button
            className="opacity-0 transition-opacity group-hover:opacity-100"
            title="Delete view"
            onClick={() => { if (confirm(`Delete view "${v.name}"?`)) del.mutate({ id: v.id }); }}
          >
            <Trash2 className="h-3 w-3 hover:text-destructive" />
          </button>
        </span>
      ))}

      <Popover open={openSave} onOpenChange={setOpenSave}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-muted-foreground">
            <Plus className="h-3 w-3" /> Save view
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-2">
          <p className="text-xs text-muted-foreground">Save the current search, filters, sort, and layout as a reusable view.</p>
          <div className="flex items-center gap-1.5">
            <Input
              autoFocus value={name} placeholder="View name"
              className="h-8 text-sm"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  create.mutate({ page, name: name.trim(), config: currentConfig });
                  setName(""); setOpenSave(false);
                }
              }}
            />
            <Button
              size="sm" className="h-8"
              disabled={!name.trim() || create.isPending}
              onClick={() => {
                create.mutate({ page, name: name.trim(), config: currentConfig });
                setName(""); setOpenSave(false);
              }}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
