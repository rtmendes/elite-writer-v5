/**
 * Research Projects Dashboard — P2
 * Portfolio board: per-project stats, bulk-create, status overview.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  LayoutGrid, Plus, Trash2, Loader2, FileText, Search,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function StatusBar({ total, byStatus }: { total: number; byStatus: Record<string, number> }) {
  if (total === 0) return <div className="h-1.5 rounded-full bg-white/5 w-full" />;
  const saved = byStatus.saved ?? 0;
  const inbox = byStatus.inbox ?? 0;
  const archived = byStatus.archived ?? 0;
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden w-full gap-px">
      <div style={{ flex: saved }} className="bg-emerald-500" />
      <div style={{ flex: inbox }} className="bg-slate-500" />
      <div style={{ flex: archived }} className="bg-zinc-700" />
    </div>
  );
}

// ─── Bulk Create Dialog ──────────────────────────────────────────────────────

function BulkCreateDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const bulkMut = trpc.researchLibrary.projects.bulkCreate.useMutation({
    onSuccess: r => {
      toast.success(`Created ${r.created} projects`);
      onDone();
      onClose();
      setText("");
    },
    onError: e => toast.error(e.message),
  });

  const names = text.split("\n").map(s => s.trim()).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#1a1a2e] border border-white/10 text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Bulk Create Projects</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">One project name per line</label>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              placeholder={"Perimenopause Article Series\nHormone Replacement Study\nWomen's Midlife Health"}
              className="bg-white/5 border-white/10 text-slate-100 text-sm font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">{names.length} project{names.length !== 1 ? "s" : ""} to create</p>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              disabled={names.length === 0 || bulkMut.isPending}
              onClick={() => bulkMut.mutate({ names })}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {bulkMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : `Create ${names.length} projects`}
            </Button>
            <Button variant="ghost" onClick={onClose} className="text-slate-400">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onDelete,
  onOpen,
}: {
  project: any;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const { total, byStatus, name, description, status } = project;
  const saved = byStatus?.saved ?? 0;
  const inbox = byStatus?.inbox ?? 0;
  const archived = byStatus?.archived ?? 0;
  const savedPct = total > 0 ? Math.round((saved / total) * 100) : 0;

  return (
    <div
      className="bg-white/4 border border-white/8 rounded-lg p-4 flex flex-col gap-3 hover:border-white/15 transition-colors cursor-pointer group"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-slate-100 truncate">{name}</h3>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{description}</p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <StatusBar total={total} byStatus={byStatus ?? {}} />

      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {total} item{total !== 1 ? "s" : ""}
        </span>
        {total > 0 && (
          <>
            <span className="text-emerald-400">{saved} saved</span>
            <span>{inbox} inbox</span>
            {archived > 0 && <span className="text-zinc-500">{archived} archived</span>}
          </>
        )}
        <Badge
          className={`ml-auto text-[10px] px-1.5 py-0 ${
            status === "active"
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
              : "bg-zinc-500/15 text-zinc-400 border-zinc-500/20"
          }`}
          variant="outline"
        >
          {status}
        </Badge>
      </div>

      {total > 0 && (
        <div className="text-[10px] text-slate-600">
          {savedPct}% reviewed
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ResearchProjectsDashboard() {
  const [search, setSearch] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [newName, setNewName] = useState("");
  const statsQ = trpc.researchLibrary.projects.stats.useQuery();
  const createMut = trpc.researchLibrary.projects.create.useMutation({
    onSuccess: () => { statsQ.refetch(); setNewName(""); },
    onError: e => toast.error(e.message),
  });
  const deleteMut = trpc.researchLibrary.projects.delete.useMutation({
    onSuccess: () => statsQ.refetch(),
    onError: e => toast.error(e.message),
  });

  const projects = (statsQ.data ?? []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  function openProject(id: number) {
    window.location.href = `/research-library?project=${id}`;
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a] text-slate-100 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 shrink-0">
        <LayoutGrid className="w-5 h-5 text-amber-500" />
        <span className="font-serif text-lg font-medium">Research Projects</span>
        <div className="flex-1 max-w-xs ml-4 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter projects…"
            className="pl-8 h-8 text-sm bg-white/5 border-white/10 text-slate-100"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowBulk(true)}
            className="text-xs text-slate-400 hover:text-slate-200 h-8 gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Bulk create
          </Button>
          <div className="flex items-center gap-1.5">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newName.trim()) {
                  createMut.mutate({ name: newName.trim() });
                }
              }}
              placeholder="New project name…"
              className="h-8 text-sm bg-white/5 border-white/10 text-slate-100 w-48"
            />
            <Button
              size="sm"
              disabled={!newName.trim() || createMut.isPending}
              onClick={() => createMut.mutate({ name: newName.trim() })}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white h-8"
            >
              {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {statsQ.data && statsQ.data.length > 0 && (
        <div className="flex items-center gap-6 px-4 py-2 border-b border-white/5 text-xs text-slate-500 shrink-0">
          <span>{statsQ.data.length} project{statsQ.data.length !== 1 ? "s" : ""}</span>
          <span>{statsQ.data.reduce((s, p) => s + (p.total ?? 0), 0)} total items</span>
          <span className="text-emerald-400">
            {statsQ.data.reduce((s, p) => s + (p.byStatus?.saved ?? 0), 0)} saved
          </span>
          <span>{statsQ.data.filter(p => p.status === "active").length} active</span>
        </div>
      )}

      {/* Grid body */}
      <div className="flex-1 overflow-y-auto p-4">
        {statsQ.isLoading ? (
          <div className="flex items-center justify-center h-40 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
            <LayoutGrid className="w-8 h-8" />
            <p className="text-sm">{search ? "No matching projects" : "No projects yet"}</p>
            {!search && (
              <Button
                size="sm"
                onClick={() => setShowBulk(true)}
                className="mt-1 bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                Bulk create projects
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {projects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onDelete={() => deleteMut.mutate({ id: p.id })}
                onOpen={() => openProject(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      <BulkCreateDialog
        open={showBulk}
        onClose={() => setShowBulk(false)}
        onDone={() => statsQ.refetch()}
      />
    </div>
  );
}
