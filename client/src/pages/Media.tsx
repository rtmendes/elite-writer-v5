/**
 * Media Library — unified image manager (Admin UX, PRD_ADMIN_UX.md).
 *
 * One browsable grid over the image library: search, tag filter, drag-drop
 * upload to R2 (content-hash dedup), multi-select delete, and click-to-edit
 * (name / alt text / tags) via the shared EditDrawer.
 */
import { useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image as ImageIcon, Search, Upload, Loader2, Trash2 } from "lucide-react";
import { ListSelectionBar, SelectCheck, useSelection } from "@/components/list-selection";
import { EditDrawer, type FieldDef } from "@/components/admin/EditDrawer";

type LibImage = {
  id: number;
  name: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  altText: string | null;
  tags: string[] | null;
  style: string | null;
  createdAt: string | Date;
};

const FIELDS: FieldDef[] = [
  { key: "name", label: "Name", type: "text", group: "Details" },
  { key: "altText", label: "Alt text", type: "textarea", rows: 2, group: "Details", placeholder: "Describe the image for accessibility + SEO" },
  { key: "tags", label: "Tags", type: "tags", group: "Details" },
  { key: "imageUrl", label: "URL", type: "url", group: "Source" },
  { key: "createdAt", label: "Added", type: "readonly", group: "Source", format: (v) => new Date(String(v)).toLocaleString() },
];

export default function MediaLibrary() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<LibImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const imagesQuery = trpc.library.images.list.useQuery({ search: search || undefined, limit: 300 });
  const images = (imagesQuery.data ?? []) as unknown as LibImage[];

  const upload = trpc.library.images.upload.useMutation();
  const update = trpc.library.images.update.useMutation();
  const del = trpc.library.images.delete.useMutation();

  const allTags = useMemo(() => {
    const s = new Set<string>();
    images.forEach((i) => (i.tags ?? []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [images]);

  const visible = useMemo(
    () => (tagFilter ? images.filter((i) => (i.tags ?? []).includes(tagFilter)) : images),
    [images, tagFilter]
  );
  const { selected, toggle, allSelected, toggleAll, clear } = useSelection(
    useMemo(() => visible.map((i) => ({ id: i.id })), [visible])
  );

  const refresh = () => utils.library.images.list.invalidate();

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setUploading(true);
    let ok = 0, deduped = 0;
    for (const file of list) {
      try {
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        const out = await upload.mutateAsync({ dataUrl, name: file.name.replace(/\.[^.]+$/, "") });
        out.deduped ? deduped++ : ok++;
      } catch (e) {
        toast.error(`Upload failed: ${file.name}`);
      }
    }
    setUploading(false);
    await refresh();
    toast.success(`${ok} uploaded${deduped ? `, ${deduped} already in library` : ""}`);
  }

  const bulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} image(s)?`)) return;
    for (const id of selected) await del.mutateAsync({ id: id as number });
    await refresh();
    clear();
    toast.success("Deleted");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold" style={{ fontFamily: "Lora, serif" }}>
            <ImageIcon className="h-6 w-6" /> Media Library
          </h1>
          <p className="text-sm text-muted-foreground">{images.length} images</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search images…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <button className={`rounded-full px-2.5 py-1 text-xs ${!tagFilter ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`} onClick={() => setTagFilter(null)}>All</button>
            {allTags.slice(0, 12).map((t) => (
              <button key={t} className={`rounded-full px-2.5 py-1 text-xs ${tagFilter === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`} onClick={() => setTagFilter(t)}>{t}</button>
            ))}
          </div>
        )}
      </div>

      {visible.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <label className="flex min-h-[36px] items-center gap-2 sm:min-h-0">
            <SelectCheck checked={allSelected} onToggle={toggleAll} title="Select all" /> Select all ({visible.length})
          </label>
        </div>
      )}
      <ListSelectionBar selected={selected} clear={clear} onDelete={bulkDelete} deleteLabel="Delete" />

      {/* Drop zone / grid */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-3 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-transparent"}`}
      >
        {imagesQuery.isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Upload className="h-8 w-8" />
            <p>Drag images here or click Upload</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visible.map((img) => (
              <Card key={img.id}
                className={`group relative overflow-hidden ${selected.has(img.id) ? "ring-2 ring-primary" : ""}`}>
                <div className="absolute left-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 has-[:checked]:opacity-100">
                  <SelectCheck checked={selected.has(img.id)} onToggle={() => toggle(img.id)} />
                </div>
                <button className="block aspect-square w-full" onClick={() => setEditing(img)}>
                  <img src={img.thumbnailUrl || img.imageUrl} alt={img.altText || img.name}
                    loading="lazy" className="h-full w-full object-cover" />
                </button>
                <div className="p-2">
                  <p className="truncate text-xs font-medium">{img.name}</p>
                  {!img.altText && <Badge variant="outline" className="mt-1 text-[10px] text-amber-600">no alt text</Badge>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <EditDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.name ?? "Image"}
        record={editing as unknown as Record<string, unknown> | null}
        fields={FIELDS}
        onSave={async (patch) => {
          if (!editing) return;
          await update.mutateAsync({
            id: editing.id,
            name: patch.name as string | undefined,
            altText: (patch.altText as string | undefined) ?? undefined,
            tags: patch.tags as string[] | undefined,
          });
          await refresh();
        }}
      >
        {editing && (
          <img src={editing.imageUrl} alt={editing.altText || editing.name}
            className="w-full rounded-lg border" />
        )}
      </EditDrawer>
    </div>
  );
}
