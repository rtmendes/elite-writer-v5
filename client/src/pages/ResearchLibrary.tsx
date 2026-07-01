/**
 * Research Library — P2
 * 3-pane workspace: subfolder tree | virtualized item list | reading pane (split-view)
 */
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  BookOpen, Folder, FolderPlus, Plus, Search, Trash2,
  FileText, Globe, Video, GraduationCap, Upload, X, ChevronRight, ChevronDown,
  Highlighter, ExternalLink, Loader2, FolderOpen, Columns2, PenTool, Share2, Link2,
} from "lucide-react";

// ─── Subfolder tree helpers ──────────────────────────────────────────────────

function buildTree(folders: any[]): Map<number | null, any[]> {
  const map = new Map<number | null, any[]>();
  map.set(null, []);
  for (const f of folders) {
    const parent = f.parentId ?? null;
    if (!map.has(parent)) map.set(parent, []);
    map.get(parent)!.push(f);
  }
  return map;
}

function FolderTreeNode({
  folder,
  tree,
  activeFolderId,
  onSelect,
  onDelete,
  onCreateChild,
  depth,
}: {
  folder: any;
  tree: Map<number | null, any[]>;
  activeFolderId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onCreateChild: (parentId: number) => void;
  depth: number;
}) {
  const children = tree.get(folder.id) ?? [];
  const [expanded, setExpanded] = useState(true);
  const isActive = activeFolderId === folder.id;

  return (
    <div>
      <div
        style={{ paddingLeft: depth * 12 + 4 }}
        className={`flex items-center gap-1 py-1 rounded text-sm cursor-pointer group transition-colors
          ${isActive ? "text-amber-400" : "text-slate-400 hover:text-slate-200"}`}
      >
        {children.length > 0 ? (
          <button onClick={() => setExpanded(e => !e)} className="shrink-0">
            {expanded
              ? <ChevronDown className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <button
          onClick={() => onSelect(folder.id)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          {isActive
            ? <FolderOpen className="w-3.5 h-3.5 shrink-0" />
            : <Folder className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate flex-1">{folder.name}</span>
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            onClick={e => { e.stopPropagation(); onCreateChild(folder.id); }}
            className="text-slate-600 hover:text-amber-400"
            title="Add subfolder"
          >
            <FolderPlus className="w-3 h-3" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(folder.id); }}
            className="text-slate-600 hover:text-red-400"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      {expanded && children.map(child => (
        <FolderTreeNode
          key={child.id}
          folder={child}
          tree={tree}
          activeFolderId={activeFolderId}
          onSelect={onSelect}
          onDelete={onDelete}
          onCreateChild={onCreateChild}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

const ROW_H = 76;
const WINDOW_ROWS = 20;

const TYPE_ICONS: Record<string, React.ElementType> = {
  webpage: Globe,
  pdf: FileText,
  video: Video,
  academic: GraduationCap,
  manual: BookOpen,
};

const STATUS_COLORS: Record<string, string> = {
  inbox: "bg-slate-500/20 text-slate-300",
  saved: "bg-emerald-500/20 text-emerald-300",
  archived: "bg-zinc-600/20 text-zinc-400",
};

// ─── Virtualized Item List ───────────────────────────────────────────────────

function VirtualList({
  items,
  selectedIds,
  activeId,
  onSelect,
  onActivate,
  onToggle,
}: {
  items: any[];
  selectedIds: Set<number>;
  activeId: number | null;
  onSelect: (id: number) => void;
  onActivate: (item: any) => void;
  onToggle: (id: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback(() => {
    setScrollTop(containerRef.current?.scrollTop ?? 0);
  }, []);

  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 2);
  const end = Math.min(items.length, start + WINDOW_ROWS + 4);
  const visible = items.slice(start, end);
  const totalH = items.length * ROW_H;

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="overflow-y-auto flex-1 relative"
      style={{ minHeight: 0 }}
    >
      <div style={{ height: totalH, position: "relative" }}>
        {visible.map((item, i) => {
          const idx = start + i;
          const Icon = TYPE_ICONS[item.contentType] ?? Globe;
          const active = item.id === activeId;
          const checked = selectedIds.has(item.id);
          return (
            <div
              key={item.id}
              style={{ position: "absolute", top: idx * ROW_H, left: 0, right: 0, height: ROW_H }}
              className={`flex items-start gap-3 px-3 py-2.5 border-b border-white/5 cursor-pointer transition-colors
                ${active ? "bg-white/8" : "hover:bg-white/4"}`}
              onClick={() => onActivate(item)}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(item.id)}
                onClick={e => e.stopPropagation()}
                className="mt-1 accent-amber-500 shrink-0"
              />
              <Icon className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100 truncate">{item.title}</div>
                <div className="text-xs text-slate-500 truncate mt-0.5">
                  {item.url ?? item.doi ?? item.publication ?? "—"}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[item.status]}`}>
                    {item.status}
                  </span>
                  {(item.tags as string[] | null)?.slice(0, 3).map((t: string) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">{t}</span>
                  ))}
                  {item.year && <span className="text-[10px] text-slate-500">{item.year}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Save Item Dialog ────────────────────────────────────────────────────────

function SaveDialog({
  open,
  onClose,
  onSaved,
  folders,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  folders: any[];
  projects: any[];
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("webpage");
  const [abstract, setAbstract] = useState("");
  const [tags, setTags] = useState("");
  const [folderId, setFolderId] = useState<string>("none");
  const [projectId, setProjectId] = useState<string>("none");

  const saveMut = trpc.researchLibrary.items.save.useMutation({
    onSuccess: () => { toast.success("Item saved"); onSaved(); onClose(); resetForm(); },
    onError: e => toast.error(e.message),
  });

  function resetForm() {
    setUrl(""); setTitle(""); setContentType("webpage");
    setAbstract(""); setTags(""); setFolderId("none"); setProjectId("none");
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#1a1a2e] border border-white/10 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">Save Research Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">URL</label>
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="bg-white/5 border-white/10 text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Title *</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Article title"
              className="bg-white/5 border-white/10 text-slate-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Type</label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger className="bg-white/5 border-white/10 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["webpage","pdf","video","academic","manual"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Folder</label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-slate-100">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {folders.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Abstract / Notes</label>
            <Textarea
              value={abstract}
              onChange={e => setAbstract(e.target.value)}
              rows={3}
              className="bg-white/5 border-white/10 text-slate-100 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Tags (comma-separated)</label>
            <Input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="perimenopause, hormones, study"
              className="bg-white/5 border-white/10 text-slate-100"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              disabled={!title.trim() || saveMut.isPending}
              onClick={() => saveMut.mutate({
                url: url || undefined,
                title: title.trim(),
                contentType: contentType as any,
                abstract: abstract || undefined,
                tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
                folderId: folderId !== "none" ? Number(folderId) : undefined,
                projectId: projectId !== "none" ? Number(projectId) : undefined,
              })}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
            <Button variant="ghost" onClick={onClose} className="text-slate-400">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Import Dialog ──────────────────────────────────────────────────────

function BulkImportDialog({
  open,
  onClose,
  onDone,
  folders,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  folders: any[];
}) {
  const [urls, setUrls] = useState("");
  const [folderId, setFolderId] = useState<string>("none");
  const [tags, setTags] = useState("");

  const importMut = trpc.researchLibrary.items.bulkImport.useMutation({
    onSuccess: r => {
      toast.success(`Imported ${r.imported} / ${r.imported + r.failed} items`);
      onDone();
      onClose();
      setUrls("");
    },
    onError: e => toast.error(e.message),
  });

  const urlList = urls.split("\n").map(u => u.trim()).filter(u => u.startsWith("http"));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#1a1a2e] border border-white/10 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif">Bulk Import URLs</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              One URL per line (max 50)
            </label>
            <Textarea
              value={urls}
              onChange={e => setUrls(e.target.value)}
              rows={8}
              placeholder={"https://pubmed.ncbi.nlm.nih.gov/...\nhttps://..."}
              className="bg-white/5 border-white/10 text-slate-100 text-xs font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">{urlList.length} valid URLs detected</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Folder</label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger className="bg-white/5 border-white/10 text-slate-100">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {folders.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Tags</label>
              <Input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="tag1, tag2"
                className="bg-white/5 border-white/10 text-slate-100"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              disabled={urlList.length === 0 || importMut.isPending}
              onClick={() => importMut.mutate({
                urls: urlList.slice(0, 50),
                folderId: folderId !== "none" ? Number(folderId) : undefined,
                tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
              })}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {importMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Import ${urlList.length} URLs`}
            </Button>
            <Button variant="ghost" onClick={onClose} className="text-slate-400">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reading Pane ─────────────────────────────────────────────────────────────

function ReadingPane({ item, onClose, split, projects }: { item: any | null; onClose: () => void; split: boolean; projects: any[] }) {
  const [newHighlight, setNewHighlight] = useState("");
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [projectPickerId, setProjectPickerId] = useState<number | null>(null);
  const updateItem = trpc.researchLibrary.items.update.useMutation({
    onSuccess: () => { toast.success("Added to project"); setProjectPickerId(null); },
    onError: e => toast.error(e.message),
  });
  const createFromResearch = trpc.data.articles.createFromResearch.useMutation({
    onSuccess: (r) => { window.location.href = `/writer/${r.id}`; },
    onError: (e) => toast.error(e.message),
  });
  const createShare = trpc.researchLibrary.shares.create.useMutation({
    onSuccess: (r) => {
      setShareToken(r.token);
      navigator.clipboard.writeText(`${window.location.origin}/research-share/${r.token}`);
      toast.success("Share link copied to clipboard");
    },
    onError: (e) => toast.error(e.message),
  });
  const bodyQ = trpc.researchLibrary.items.get.useQuery(
    { id: item?.id ?? 0, includeBody: true },
    { enabled: !!item?.r2Key },
  );
  const highlightsQ = trpc.researchLibrary.highlights.list.useQuery(
    { itemId: item?.id ?? 0 },
    { enabled: !!item },
  );
  const addHighlight = trpc.researchLibrary.highlights.add.useMutation({
    onSuccess: () => { highlightsQ.refetch(); setNewHighlight(""); },
    onError: e => toast.error(e.message),
  });
  const deleteHighlight = trpc.researchLibrary.highlights.delete.useMutation({
    onSuccess: () => highlightsQ.refetch(),
  });

  const paneClass = split ? "w-[45%] shrink-0" : "w-80 shrink-0";

  if (!item) {
    return (
      <div className={`${paneClass} border-l border-white/5 flex items-center justify-center text-slate-500 text-sm`}>
        Select an item to read
      </div>
    );
  }

  return (
    <div className={`${paneClass} border-l border-white/5 flex flex-col overflow-hidden`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span className="text-xs text-slate-400 font-medium truncate">{item.title}</span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Research → Article: 3-way choice */}
      <div className="flex items-center flex-wrap gap-1.5 px-3 py-2 border-b border-white/5 shrink-0">
        <Button
          size="sm"
          disabled={createFromResearch.isPending}
          onClick={() => createFromResearch.mutate({ itemId: item.id })}
          className="text-xs h-7 gap-1 bg-amber-600/80 hover:bg-amber-600 text-white"
        >
          {createFromResearch.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <PenTool className="w-3 h-3" />}
          New article
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { window.location.href = `/writer?from=research&item=${item.id}`; }}
          className="text-xs h-7 gap-1 text-slate-400 hover:text-slate-200"
        >
          <Plus className="w-3 h-3" />
          Add to existing
        </Button>
        {projects.length > 0 && (
          <div className="flex items-center gap-1">
            <Select
              value={projectPickerId ? String(projectPickerId) : ""}
              onValueChange={v => setProjectPickerId(v ? Number(v) : null)}
            >
              <SelectTrigger className="h-7 text-[10px] bg-white/5 border-white/10 text-slate-300 w-28">
                <SelectValue placeholder="Project…" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="ghost"
              disabled={!projectPickerId || updateItem.isPending}
              onClick={() => projectPickerId && updateItem.mutate({ id: item.id, projectId: projectPickerId })}
              className="text-xs h-7 text-amber-400 hover:text-amber-300 px-2"
            >
              Add
            </Button>
          </div>
        )}
        <button
          onClick={() => createShare.mutate({ ownerType: "item", ownerId: item.id })}
          className="text-slate-500 hover:text-amber-400 transition-colors p-1 ml-auto"
          title="Share link"
        >
          {shareToken ? <Link2 className="w-3.5 h-3.5 text-amber-400" /> : <Share2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
        {/* Metadata */}
        <div className="space-y-1 text-xs text-slate-400">
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-amber-400 hover:underline truncate">
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span className="truncate">{item.url}</span>
            </a>
          )}
          {item.authors?.length > 0 && <p>Authors: {(item.authors as string[]).join(", ")}</p>}
          {item.year && <p>Year: {item.year}</p>}
          {item.doi && <p>DOI: {item.doi}</p>}
          {item.publication && <p>Source: {item.publication}</p>}
          {item.citationCount > 0 && <p>{item.citationCount} citations</p>}
        </div>

        {/* Abstract */}
        {item.abstract && (
          <div>
            <p className="text-xs font-medium text-slate-300 mb-1">Abstract</p>
            <p className="text-xs text-slate-400 leading-relaxed">{item.abstract}</p>
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div>
            <p className="text-xs font-medium text-slate-300 mb-1">Notes</p>
            <p className="text-xs text-slate-400 leading-relaxed">{item.notes}</p>
          </div>
        )}

        {/* Body preview */}
        {bodyQ.data?.body && (
          <div>
            <p className="text-xs font-medium text-slate-300 mb-1">Body (preview)</p>
            <p className="text-xs text-slate-500 leading-relaxed line-clamp-12">
              {bodyQ.data.body.slice(0, 1200)}
            </p>
          </div>
        )}

        {/* Highlights */}
        <div>
          <p className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1">
            <Highlighter className="w-3 h-3" /> Highlights
          </p>
          <div className="space-y-2">
            {highlightsQ.data?.map(h => (
              <div key={h.id} className="bg-amber-500/10 border border-amber-500/20 rounded p-2 group">
                <p className="text-xs text-amber-200 leading-relaxed">{h.text}</p>
                {h.note && <p className="text-xs text-slate-400 mt-1 italic">{h.note}</p>}
                <button
                  onClick={() => deleteHighlight.mutate({ id: h.id })}
                  className="text-slate-600 hover:text-red-400 mt-1 hidden group-hover:block"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            <Textarea
              value={newHighlight}
              onChange={e => setNewHighlight(e.target.value)}
              placeholder="Paste a passage to highlight…"
              rows={3}
              className="bg-white/5 border-white/10 text-slate-100 text-xs"
            />
            <Button
              size="sm"
              disabled={!newHighlight.trim() || addHighlight.isPending}
              onClick={() => addHighlight.mutate({ itemId: item.id, text: newHighlight.trim() })}
              className="w-full text-xs bg-amber-600/80 hover:bg-amber-600 text-white"
            >
              Add Highlight
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResearchLibrary() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [activeFolderId, setActiveFolderId] = useState<number | null>(() => {
    const p = new URLSearchParams(window.location.search).get("project");
    return null;
  });
  const [activeProjectId, setActiveProjectId] = useState<number | null>(() => {
    const p = new URLSearchParams(window.location.search).get("project");
    return p ? Number(p) : null;
  });
  const [activeItem, setActiveItem] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showSave, setShowSave] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [splitView, setSplitView] = useState(false);

  const itemsQ = trpc.researchLibrary.items.list.useQuery({
    search: search || undefined,
    status: filterStatus !== "all" ? filterStatus as any : undefined,
    contentType: filterType !== "all" ? filterType : undefined,
    folderId: activeFolderId ?? undefined,
    projectId: activeProjectId ?? undefined,
    limit: 500,
  });
  const foldersQ = trpc.researchLibrary.folders.list.useQuery();
  const projectsQ = trpc.researchLibrary.projects.list.useQuery();

  const createFolder = trpc.researchLibrary.folders.create.useMutation({
    onSuccess: () => foldersQ.refetch(),
    onError: e => toast.error(e.message),
  });
  const deleteFolder = trpc.researchLibrary.folders.delete.useMutation({
    onSuccess: () => { foldersQ.refetch(); itemsQ.refetch(); setActiveFolderId(null); },
  });
  const createProject = trpc.researchLibrary.projects.create.useMutation({
    onSuccess: () => projectsQ.refetch(),
    onError: e => toast.error(e.message),
  });
  const deleteItem = trpc.researchLibrary.items.delete.useMutation({
    onSuccess: () => { itemsQ.refetch(); setActiveItem(null); toast.success("Deleted"); },
  });
  const updateItem = trpc.researchLibrary.items.update.useMutation({
    onSuccess: () => itemsQ.refetch(),
  });

  const items = itemsQ.data?.items ?? [];

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function bulkDelete() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    Promise.all(ids.map(id => deleteItem.mutateAsync({ id })))
      .then(() => { setSelectedIds(new Set()); toast.success(`Deleted ${ids.length} items`); })
      .catch(e => toast.error(e.message));
  }

  function bulkArchive() {
    if (selectedIds.size === 0) return;
    Promise.all(Array.from(selectedIds).map(id =>
      updateItem.mutateAsync({ id, status: "archived" })
    )).then(() => { setSelectedIds(new Set()); toast.success("Archived"); });
  }

  function bulkMoveToFolder(folderId: number) {
    if (selectedIds.size === 0) return;
    Promise.all(Array.from(selectedIds).map(id => updateItem.mutateAsync({ id, folderId })))
      .then(() => { setSelectedIds(new Set()); toast.success(`Moved ${selectedIds.size} items`); })
      .catch(e => toast.error(e.message));
  }

  function bulkAddToProject(projectId: number) {
    if (selectedIds.size === 0) return;
    Promise.all(Array.from(selectedIds).map(id => updateItem.mutateAsync({ id, projectId })))
      .then(() => { setSelectedIds(new Set()); toast.success(`Added ${selectedIds.size} items to project`); })
      .catch(e => toast.error(e.message));
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a] text-slate-100 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 shrink-0">
        <BookOpen className="w-5 h-5 text-amber-500" />
        <span className="font-serif text-lg font-medium">Research Library</span>
        <div className="flex-1 max-w-sm ml-4 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items…"
            className="pl-8 h-8 text-sm bg-white/5 border-white/10 text-slate-100"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-28 text-xs bg-white/5 border-white/10 text-slate-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="inbox">Inbox</SelectItem>
            <SelectItem value="saved">Saved</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-28 text-xs bg-white/5 border-white/10 text-slate-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {["webpage","pdf","video","academic","manual"].map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <span className="text-xs text-slate-400">{selectedIds.size} selected</span>
            {(foldersQ.data ?? []).length > 0 && (
              <Select onValueChange={v => v && bulkMoveToFolder(Number(v))}>
                <SelectTrigger className="h-7 text-xs bg-white/5 border-white/10 text-slate-300 w-32">
                  <SelectValue placeholder="→ Folder" />
                </SelectTrigger>
                <SelectContent>
                  {(foldersQ.data ?? []).map((f: any) => (
                    <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(projectsQ.data ?? []).length > 0 && (
              <Select onValueChange={v => v && bulkAddToProject(Number(v))}>
                <SelectTrigger className="h-7 text-xs bg-white/5 border-white/10 text-slate-300 w-32">
                  <SelectValue placeholder="→ Project" />
                </SelectTrigger>
                <SelectContent>
                  {(projectsQ.data ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="ghost" onClick={bulkArchive}
              className="text-xs text-slate-400 hover:text-slate-200 h-7">
              Archive
            </Button>
            <Button size="sm" variant="ghost" onClick={bulkDelete}
              className="text-xs text-red-400 hover:text-red-300 h-7">
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-500 h-7">
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" variant="ghost"
            onClick={() => setSplitView(v => !v)}
            className={`text-xs h-8 gap-1 ${splitView ? "text-amber-400" : "text-slate-400 hover:text-slate-200"}`}
            title="Toggle split view"
          >
            <Columns2 className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost"
            onClick={() => setShowBulk(true)}
            className="text-xs text-slate-400 hover:text-slate-200 h-8 gap-1">
            <Upload className="w-3.5 h-3.5" /> Bulk import
          </Button>
          <Button size="sm"
            onClick={() => setShowSave(true)}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white h-8 gap-1">
            <Plus className="w-3.5 h-3.5" /> Save item
          </Button>
        </div>
      </div>

      {/* 3-pane body */}
      <div className="flex flex-1 min-h-0">
        {/* Pane 1 — Folders + Projects */}
        <div className="w-52 shrink-0 border-r border-white/5 flex flex-col overflow-y-auto">
          {/* All items */}
          <button
            onClick={() => { setActiveFolderId(null); setActiveProjectId(null); }}
            className={`flex items-center gap-2 px-3 py-2 text-sm w-full text-left transition-colors
              ${activeFolderId == null && activeProjectId == null ? "text-amber-400 bg-amber-500/10" : "text-slate-400 hover:text-slate-200"}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            All items
            <span className="ml-auto text-xs text-slate-500">{itemsQ.data?.total ?? ""}</span>
          </button>

          {/* Folders — subfolder tree */}
          <div className="px-2 pt-3 pb-1">
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Folders</span>
              <button
                onClick={() => {
                  const name = prompt("Folder name:");
                  if (name?.trim()) createFolder.mutate({ name: name.trim() });
                }}
                className="text-slate-500 hover:text-amber-400"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
            {(() => {
              const tree = buildTree(foldersQ.data ?? []);
              const roots = tree.get(null) ?? [];
              return roots.map(f => (
                <FolderTreeNode
                  key={f.id}
                  folder={f}
                  tree={tree}
                  activeFolderId={activeFolderId}
                  onSelect={id => { setActiveFolderId(id); setActiveProjectId(null); }}
                  onDelete={id => deleteFolder.mutate({ id })}
                  onCreateChild={parentId => {
                    const name = prompt("Subfolder name:");
                    if (name?.trim()) createFolder.mutate({ name: name.trim(), parentId });
                  }}
                  depth={0}
                />
              ));
            })()}
          </div>

          {/* Projects */}
          <div className="px-3 pt-3 pb-1 border-t border-white/5 mt-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Projects</span>
              <button
                onClick={() => {
                  const name = prompt("Project name:");
                  if (name?.trim()) createProject.mutate({ name: name.trim() });
                }}
                className="text-slate-500 hover:text-amber-400"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {projectsQ.data?.map(p => (
              <button
                key={p.id}
                onClick={() => { setActiveProjectId(p.id); setActiveFolderId(null); }}
                className={`flex items-center gap-1.5 w-full text-left px-1 py-1 rounded text-sm transition-colors
                  ${activeProjectId === p.id ? "text-amber-400" : "text-slate-400 hover:text-slate-200"}`}
              >
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pane 2 — Item list */}
        <div className="flex-1 min-w-0 flex flex-col">
          {itemsQ.isLoading ? (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
              <BookOpen className="w-8 h-8" />
              <p className="text-sm">No items yet</p>
              <Button size="sm" onClick={() => setShowSave(true)}
                className="mt-1 bg-amber-600 hover:bg-amber-700 text-white text-xs">
                Save your first item
              </Button>
            </div>
          ) : (
            <VirtualList
              items={items}
              selectedIds={selectedIds}
              activeId={activeItem?.id ?? null}
              onSelect={id => setSelectedIds(prev => new Set([...prev, id]))}
              onActivate={item => setActiveItem((prev: any) => prev?.id === item.id ? null : item)}
              onToggle={toggleSelect}
            />
          )}
        </div>

        {/* Pane 3 — Reading pane (split-view aware) */}
        <ReadingPane item={activeItem} onClose={() => setActiveItem(null)} split={splitView} projects={projectsQ.data ?? []} />
      </div>

      {/* Dialogs */}
      <SaveDialog
        open={showSave}
        onClose={() => setShowSave(false)}
        onSaved={() => itemsQ.refetch()}
        folders={foldersQ.data ?? []}
        projects={projectsQ.data ?? []}
      />
      <BulkImportDialog
        open={showBulk}
        onClose={() => setShowBulk(false)}
        onDone={() => itemsQ.refetch()}
        folders={foldersQ.data ?? []}
      />
    </div>
  );
}
