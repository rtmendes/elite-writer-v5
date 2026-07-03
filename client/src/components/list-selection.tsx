/**
 * Shared row multi-select — UI standard (PR #40 / Issue #44).
 * Extracted from workspace/database/views.tsx for reuse across list/table/grid views.
 */
import React, { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function useSelection<T extends string | number>(rows: { id: T }[]) {
  const [selected, setSelected] = useState<Set<T>>(new Set());
  const toggle = (id: T) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const clear = () => setSelected(new Set());
  return { selected, toggle, allSelected, toggleAll, clear, setSelected };
}

export function SelectCheck({
  checked,
  onToggle,
  className,
  title,
}: {
  checked: boolean;
  onToggle: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <input
      type="checkbox"
      className={className ?? "checkbox-dot accent-[var(--primary)] w-4 h-4"}
      checked={checked}
      title={title}
      onClick={(e) => e.stopPropagation()}
      onChange={onToggle}
    />
  );
}

export type BulkStatusOption = { value: string; label: string };

export function ListSelectionBar({
  selected,
  clear,
  onDelete,
  deleteLabel = "Delete",
  statusOptions,
  onSetStatus,
  children,
}: {
  selected: Set<string | number>;
  clear: () => void;
  onDelete?: () => void | Promise<void>;
  deleteLabel?: string;
  statusOptions?: BulkStatusOption[];
  onSetStatus?: (status: string) => void | Promise<void>;
  children?: React.ReactNode;
}) {
  if (selected.size === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <b className="font-semibold">{selected.size} selected</b>
      {statusOptions && statusOptions.length > 0 && onSetStatus && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              Set status…
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {statusOptions.map((o) => (
              <DropdownMenuItem key={o.value} onClick={() => onSetStatus(o.value)}>
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {children}
      {onDelete && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          {deleteLabel}
        </Button>
      )}
      <Button variant="ghost" size="sm" className="h-8 text-xs ml-auto" onClick={clear}>
        <X className="w-3.5 h-3.5 mr-1" />
        Clear
      </Button>
    </div>
  );
}
