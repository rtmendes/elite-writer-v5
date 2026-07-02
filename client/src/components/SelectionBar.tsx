import { ReactNode } from "react";
import { Trash2, X, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface StatusOption {
  value: string;
  label: string;
}

interface SelectionBarProps {
  count: number;
  /** Bulk status change — omit to hide the "Set status…" select. */
  statusOptions?: StatusOption[];
  onSetStatus?: (status: string) => void | Promise<void>;
  /** Bulk delete — omit to hide the Delete button. Confirm handled here. */
  onDelete?: () => void | Promise<void>;
  deleteNoun?: string; // e.g. "article" → "Delete 3 articles?"
  onClear: () => void;
  busy?: boolean;
  /** Extra view-specific bulk actions, rendered between status and delete. */
  children?: ReactNode;
}

/**
 * Shared bulk-action bar (UI standard: every collection view gets it).
 * Page-level twin of SelectionBar in workspace/database/views.tsx, styled
 * to match the bar shipped in Queue.tsx.
 */
export function SelectionBar({
  count, statusOptions, onSetStatus, onDelete, deleteNoun = "item",
  onClear, busy = false, children,
}: SelectionBarProps) {
  if (count === 0) return null;
  return (
    <Card className="border-primary/30 bg-primary/[0.03] sticky top-2 z-20">
      <CardContent className="p-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium mr-1">{count} selected</span>

        {statusOptions && statusOptions.length > 0 && onSetStatus && (
          <Select onValueChange={v => onSetStatus(v)} disabled={busy}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Set status…" /></SelectTrigger>
            <SelectContent>
              {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {children}

        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Delete ${count} ${deleteNoun}${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
              void onDelete();
            }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
          </Button>
        )}

        <Button variant="ghost" size="sm" className="h-9 gap-1.5 ml-auto" onClick={onClear} disabled={busy}>
          <X className="w-3.5 h-3.5" /> Clear
        </Button>
      </CardContent>
    </Card>
  );
}
