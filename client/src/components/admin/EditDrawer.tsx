/**
 * EditDrawer — Payload-style edit-in-panel (Admin UX, PRD_ADMIN_UX.md).
 *
 * Generic, config-driven side drawer that edits everything *about* a record.
 * Field changes autosave (debounced) through a caller-supplied update function —
 * no Save button. Long-form bodies stay in the Writer (see `openInWriter`).
 *
 * The drawer is deliberately schema-driven so every collection reuses it: pass
 * `fields` (grouped) + the current `record` + an `onSave(patch)` that calls the
 * collection's existing tRPC update mutation.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, ExternalLink } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type FieldType =
  | "text" | "textarea" | "number" | "select" | "tags" | "readonly" | "chips" | "url";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  group?: string;
  options?: { value: string; label: string }[]; // select
  placeholder?: string;
  rows?: number; // textarea
  /** chips render: render a value (array) as clickable chips; onChipClick optional */
  onChipClick?: (value: unknown) => void;
  format?: (value: unknown) => string; // readonly display
}

export interface EditDrawerProps<T extends Record<string, unknown>> {
  open: boolean;
  onClose: () => void;
  title: string;
  record: T | null;
  fields: FieldDef[];
  /** Persist a single-field patch. Returns a promise so we can show save state. */
  onSave: (patch: Partial<T>) => Promise<void> | void;
  /** Optional deep-edit link (long-form body lives in the Writer). */
  openInWriter?: (record: T) => void;
  /** Extra content rendered at the bottom of the drawer (e.g. media picker). */
  children?: React.ReactNode;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function EditDrawer<T extends Record<string, unknown>>({
  open, onClose, title, record, fields, onSave, openInWriter, children,
}: EditDrawerProps<T>) {
  // Local draft mirrors the record; edits debounce-save then reconcile.
  const [draft, setDraft] = useState<T | null>(record);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Re-seed the draft whenever a different record opens.
  useEffect(() => { setDraft(record); setSaveState("idle"); }, [record]);

  const groups = useMemo(() => {
    const map = new Map<string, FieldDef[]>();
    for (const f of fields) {
      const g = f.group ?? "Details";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(f);
    }
    return [...map.entries()];
  }, [fields]);

  if (!draft) return null;

  const commit = (key: string, value: unknown) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      setSaveState("saving");
      try {
        await onSave({ [key]: value } as Partial<T>);
        setSaveState("saved");
        setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch {
        setSaveState("error");
      }
    }, 800);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 flex flex-row items-center justify-between gap-2 border-b bg-background px-5 py-3">
          <SheetTitle className="truncate text-base">{title}</SheetTitle>
          <div className="flex items-center gap-2">
            <SaveIndicator state={saveState} />
            {openInWriter && (
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs"
                onClick={() => openInWriter(draft)}>
                <ExternalLink className="h-3.5 w-3.5" /> Open in Writer
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6 px-5 py-4">
          {groups.map(([group, groupFields]) => (
            <section key={group} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
              <div className="space-y-3">
                {groupFields.map((f) => (
                  <Field key={f.key} def={f} value={draft[f.key]} onChange={(v) => commit(f.key, v)} />
                ))}
              </div>
            </section>
          ))}
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "saving") return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>;
  if (state === "saved") return <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3 w-3" /> Saved</span>;
  if (state === "error") return <span className="text-xs text-destructive">Save failed</span>;
  return null;
}

function Field({ def, value, onChange }: { def: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const label = <label className="text-sm font-medium">{def.label}</label>;

  if (def.type === "readonly") {
    return (
      <div className="space-y-1">
        {label}
        <div className="text-sm text-muted-foreground">{def.format ? def.format(value) : String(value ?? "—")}</div>
      </div>
    );
  }

  if (def.type === "chips") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1">
        {label}
        <div className="flex flex-wrap gap-1">
          {arr.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
          {arr.map((v, i) => (
            <Badge key={i} variant="secondary" className={def.onChipClick ? "cursor-pointer" : ""}
              onClick={() => def.onChipClick?.(v)}>
              {String((v as { name?: string; title?: string })?.name ?? (v as { title?: string })?.title ?? v)}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  if (def.type === "select") {
    return (
      <div className="space-y-1">
        {label}
        <Select value={value ? String(value) : undefined} onValueChange={onChange}>
          <SelectTrigger className="h-9"><SelectValue placeholder={def.placeholder ?? "Select…"} /></SelectTrigger>
          <SelectContent>
            {def.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (def.type === "textarea") {
    return (
      <div className="space-y-1">
        {label}
        <Textarea rows={def.rows ?? 4} value={String(value ?? "")}
          placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }

  if (def.type === "tags") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-1">
        {label}
        <Input value={arr.join(", ")} placeholder="comma, separated, tags"
          onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
      </div>
    );
  }

  if (def.type === "number") {
    return (
      <div className="space-y-1">
        {label}
        <Input type="number" value={value === null || value === undefined ? "" : String(value)}
          placeholder={def.placeholder}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      </div>
    );
  }

  if (def.type === "url") {
    return (
      <div className="space-y-1">
        {label}
        <div className="flex items-center gap-2">
          <Input value={String(value ?? "")} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
          {value ? <a href={String(value)} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 text-muted-foreground" /></a> : null}
        </div>
      </div>
    );
  }

  // text
  return (
    <div className="space-y-1">
      {label}
      <Input value={String(value ?? "")} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
