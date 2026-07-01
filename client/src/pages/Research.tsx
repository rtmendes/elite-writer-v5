/**
 * Research — agentic research hub (native Paperguide-style rebuild).
 *
 * Four surfaces, all on our own stack (free-first LLMs + scholarly/web/KB/video
 * sources + the Knowledge Base):
 *   • Search        — multi-source cited answers (trpc.researchHub.agenticSearch)
 *   • Deep Research — sub-question plan → cited report saved to the KB
 *   • Library       — reference manager (CRUD + DOI/BibTeX/RIS/JSON import)
 *   • Chat with PDF — grounded Q&A over an uploaded/pasted document
 *
 * Every answer can be pushed into the Knowledge Base so research compounds
 * across the ecosystem rather than living in a silo.
 */
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { trpc } from "@/lib/trpc";
import {
  Search, Sparkles, Loader2, BookOpen, FileText, ExternalLink, Save, Trash2,
  Plus, Upload, Download, MessageSquare, Library as LibraryIcon, Globe,
  GraduationCap, Youtube, Database, Send, Copy, ChevronLeft, ChevronRight,
  ArrowUpDown, X,
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ── Markdown → HTML (shared renderer, mirrors Documentation/KnowledgeHub) ──
function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc(md || "").split("\n");
  let html = "", inList = false, inCode = false;
  for (const ln of lines) {
    if (ln.trim().startsWith("```")) { inCode = !inCode; html += inCode ? '<pre style="background:var(--muted);padding:10px;border-radius:8px;overflow:auto;font-size:13px"><code>' : "</code></pre>"; continue; }
    if (inCode) { html += ln + "\n"; continue; }
    if (/^#\s/.test(ln)) html += `<h1 style="font-size:20px;font-weight:600;margin:14px 0 8px">${ln.slice(2)}</h1>`;
    else if (/^##\s/.test(ln)) html += `<h2 style="font-size:17px;font-weight:600;margin:12px 0 6px">${ln.slice(3)}</h2>`;
    else if (/^###\s/.test(ln)) html += `<h3 style="font-size:15px;font-weight:600;margin:10px 0 4px">${ln.slice(4)}</h3>`;
    else if (/^\d+\.\s/.test(ln)) { html += `<p style="margin:3px 0 3px 14px;line-height:1.6">${ln}</p>`; continue; }
    else if (/^[-*]\s/.test(ln)) { if (!inList) { html += "<ul style='margin:6px 0 6px 18px;list-style:disc'>"; inList = true; } html += `<li style="margin:2px 0">${ln.slice(2)}</li>`; continue; }
    else { if (inList) { html += "</ul>"; inList = false; } html += ln.trim() ? `<p style="margin:6px 0;line-height:1.65">${ln}</p>` : ""; }
    if (inList && !/^[-*]\s/.test(ln)) { html += "</ul>"; inList = false; }
  }
  if (inList) html += "</ul>";
  return html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code style="background:var(--muted);padding:1px 5px;border-radius:4px;font-size:13px">$1</code>')
    .replace(/\[(\d+)\]/g, '<sup style="color:var(--primary);font-weight:600">[$1]</sup>');
}

async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map((it: any) => ("str" in it ? it.str : "")).join(" ") + "\n\n";
  }
  return text.trim();
}

type Scope = "all" | "scholarly" | "web" | "kb" | "video";
const SCOPES: { id: Scope; label: string; icon: any }[] = [
  { id: "all", label: "Everything", icon: Sparkles },
  { id: "scholarly", label: "Scholarly", icon: GraduationCap },
  { id: "web", label: "Web & News", icon: Globe },
  { id: "kb", label: "My KB", icon: Database },
  { id: "video", label: "Video", icon: Youtube },
];

type UISource = {
  title: string; url: string; snippet: string; source: string;
  type: "article" | "webpage" | "video" | "report";
  authors?: string[]; year?: number | null; doi?: string | null; citationCount?: number | null;
};

function sourceBadgeTone(source: string): string {
  if (source.startsWith("brave")) return "bg-sky-500/15 text-sky-400 border-sky-500/25";
  if (source === "kb") return "bg-violet-500/15 text-violet-400 border-violet-500/25";
  if (source === "youtube") return "bg-red-500/15 text-red-400 border-red-500/25";
  return "bg-amber-500/15 text-amber-400 border-amber-500/25"; // scholarly
}

function ScopePicker({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SCOPES.map((s) => (
        <button key={s.id} onClick={() => onChange(s.id)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors min-h-[44px] ${
            value === s.id ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}>
          <s.icon className="w-3.5 h-3.5" /> {s.label}
        </button>
      ))}
    </div>
  );
}

function SourceList({ sources, onSave }: { sources: UISource[]; onSave?: (s: UISource) => void }) {
  if (!sources.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources ({sources.length})</h3>
      {sources.map((s, i) => (
        <div key={i} className="rounded-lg border border-border bg-card/60 p-3">
          <div className="flex items-start gap-2">
            <span className="text-xs font-semibold text-primary mt-0.5 shrink-0">[{i + 1}]</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground hover:text-primary inline-flex items-center gap-1">
                    {s.title} <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                ) : <span className="text-sm font-medium text-foreground">{s.title}</span>}
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${sourceBadgeTone(s.source)}`}>{s.source}</span>
                {typeof s.citationCount === "number" && s.citationCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">{s.citationCount.toLocaleString()} citations</span>
                )}
                {s.year ? <span className="text-[10px] text-muted-foreground">{s.year}</span> : null}
              </div>
              {s.authors?.length ? <p className="text-[11px] text-muted-foreground mt-0.5">{s.authors.slice(0, 4).join(", ")}</p> : null}
              {s.snippet ? <p className="text-xs text-muted-foreground/90 mt-1 line-clamp-2">{s.snippet}</p> : null}
            </div>
            {onSave && (
              <button onClick={() => onSave(s)} title="Save to Library"
                className="shrink-0 text-muted-foreground hover:text-primary p-1.5 rounded-md hover:bg-accent">
                <Save className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
export default function Research() {
  const [tab, setTab] = useState("search");
  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Search className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-display, Lora, serif)" }}>Research</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Agentic research across scholarly papers, the live web, your Knowledge Base, and video — with cited answers that save straight into your ecosystem.</p>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="search"><Search className="w-4 h-4 mr-1.5" /> Search</TabsTrigger>
          <TabsTrigger value="deep"><Sparkles className="w-4 h-4 mr-1.5" /> Deep Research</TabsTrigger>
          <TabsTrigger value="library"><LibraryIcon className="w-4 h-4 mr-1.5" /> Library</TabsTrigger>
          <TabsTrigger value="chat"><MessageSquare className="w-4 h-4 mr-1.5" /> Chat with PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="search"><SearchTab /></TabsContent>
        <TabsContent value="deep"><DeepResearchTab /></TabsContent>
        <TabsContent value="library"><LibraryTab /></TabsContent>
        <TabsContent value="chat"><ChatPdfTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Search tab ────────────────────────────────────────────────────────────
function SearchTab() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [saveToKb, setSaveToKb] = useState(false);
  const agentic = trpc.researchHub.agenticSearch.useMutation();
  const saveToLib = trpc.researchLibrary.items.save.useMutation();
  const utils = trpc.useUtils();

  const run = async () => {
    if (query.trim().length < 2) return;
    try {
      const r = await agentic.mutateAsync({ query: query.trim(), scope, saveToKb });
      if (r.savedId) toast.success("Saved answer to Knowledge Base");
      if (!r.sources.length) toast.info("No sources found — try a broader query or scope");
    } catch (e: any) { toast.error(e?.message || "Search failed"); }
  };

  const saveSource = async (s: UISource) => {
    try {
      const contentType =
        s.type === "video" ? "video" :
        s.type === "article" ? "academic" :
        "webpage";
      await saveToLib.mutateAsync({
        title: s.title, url: s.url || undefined, contentType,
        authors: s.authors || [], year: s.year ?? undefined,
        doi: s.doi ?? undefined, abstract: s.snippet || undefined,
        source: s.source, status: "saved",
        metadata: s.citationCount != null ? { citationCount: s.citationCount } : undefined,
      });
      await utils.researchLibrary.items.list.invalidate();
      toast.success("Saved to Library");
    } catch (e: any) { toast.error(e?.message || "Could not save"); }
  };

  const data = agentic.data;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Ask a research question…" className="flex-1" />
          <Button onClick={run} disabled={agentic.isPending || query.trim().length < 2}>
            {agentic.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="ml-1.5 hidden sm:inline">Search</span>
          </Button>
        </div>
        <ScopePicker value={scope} onChange={setScope} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={saveToKb} onChange={(e) => setSaveToKb(e.target.checked)} className="accent-[var(--primary)] w-4 h-4" />
          Save the answer to my Knowledge Base
        </label>
      </div>

      {agentic.isPending && (
        <div className="space-y-2">
          <div className="h-32 animate-pulse rounded-xl bg-muted/40" />
          <div className="h-16 animate-pulse rounded-lg bg-muted/30" />
          <div className="h-16 animate-pulse rounded-lg bg-muted/30" />
        </div>
      )}

      {data && !agentic.isPending && (
        <div className="space-y-4">
          {data.answer ? (
            <div className="rounded-xl border border-border bg-card/60 p-5">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-[10px]">{data.scope}</Badge>
                <button onClick={() => { navigator.clipboard.writeText(data.answer); toast.success("Copied"); }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /> Copy</button>
              </div>
              <div className="text-foreground text-sm" dangerouslySetInnerHTML={{ __html: mdToHtml(data.answer) }} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {data.note || "No answer generated."}
            </div>
          )}
          <SourceList sources={data.sources as UISource[]} onSave={saveSource} />
        </div>
      )}

      {!data && !agentic.isPending && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Search className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Ask anything. You'll get a cited answer drawn from real sources — not a guess.</p>
        </div>
      )}
    </div>
  );
}

// ── Deep Research tab ───────────────────────────────────────────────────────
function DeepResearchTab() {
  const [topic, setTopic] = useState("");
  const [depth, setDepth] = useState<"standard" | "deep">("standard");
  const [scope, setScope] = useState<Scope>("all");
  const deep = trpc.researchHub.deepResearch.useMutation();

  const run = async () => {
    if (topic.trim().length < 3) return;
    try {
      const r = await deep.mutateAsync({ topic: topic.trim(), depth, scope, saveToKb: true });
      if (r.savedId) toast.success("Report saved to Knowledge Base");
      else if (!r.sources.length) toast.info("No sources found for this topic");
    } catch (e: any) { toast.error(e?.message || "Deep research failed"); }
  };

  const data = deep.data;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Research topic — e.g. “GLP-1 effects on perimenopausal metabolism”" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {(["standard", "deep"] as const).map((d) => (
              <button key={d} onClick={() => setDepth(d)}
                className={`px-3 py-2 rounded-lg text-sm border min-h-[44px] capitalize ${depth === d ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {d === "deep" ? "Deep (6 questions)" : "Standard (4 questions)"}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <Button onClick={run} disabled={deep.isPending || topic.trim().length < 3}>
            {deep.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="ml-1.5">Generate Report</span>
          </Button>
        </div>
        <ScopePicker value={scope} onChange={setScope} />
        <p className="text-[11px] text-muted-foreground">Plans focused sub-questions, gathers evidence per question, then writes one cited report — saved automatically to your Knowledge Base.</p>
      </div>

      {deep.isPending && (
        <div className="rounded-xl border border-border bg-card/60 p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Planning sub-questions and gathering evidence… this can take a minute.</div>
          <div className="h-40 animate-pulse rounded-lg bg-muted/40" />
        </div>
      )}

      {data && !deep.isPending && (
        <div className="space-y-4">
          {data.subquestions?.length > 0 && (
            <div className="rounded-xl border border-border bg-card/60 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sub-questions</h3>
              <ol className="space-y-1 text-sm text-foreground list-decimal list-inside">
                {data.subquestions.map((q: string, i: number) => <li key={i}>{q}</li>)}
              </ol>
            </div>
          )}
          {data.report ? (
            <div className="rounded-xl border border-border bg-card/60 p-5">
              <div className="flex items-center justify-between mb-2">
                {data.savedId ? <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30"><Save className="w-3 h-3 mr-1" /> Saved to KB</Badge> : <span />}
                <button onClick={() => { navigator.clipboard.writeText(data.report); toast.success("Copied"); }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /> Copy</button>
              </div>
              <div className="text-foreground text-sm" dangerouslySetInnerHTML={{ __html: mdToHtml(data.report) }} />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{data.note || "No report generated."}</div>
          )}
          <SourceList sources={(data.sources || []) as UISource[]} />
        </div>
      )}

      {!data && !deep.isPending && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Give a topic and get a structured, cited briefing — executive summary, section per sub-question, open questions, and references.</p>
        </div>
      )}
    </div>
  );
}

// ── Library tab (enterprise reference manager) ──────────────────────────────
type RefRow = {
  id: number; type: string; title: string; authors: any; year: number | null;
  doi: string | null; url: string | null; abstract: string | null; source: string | null;
  citationCount: number | null; tags: any; notes: string | null; createdAt: any;
};
type SortKey = "title" | "year" | "citationCount";
const PAGE_SIZE = 25;

function LibraryTab() {
  const list = trpc.researchHub.references.list.useQuery({});
  const create = trpc.researchHub.references.create.useMutation();
  const remove = trpc.researchHub.references.remove.useMutation();
  const doImport = trpc.researchHub.references.import.useMutation();
  const saveKb = trpc.researchHub.references.saveToKb.useMutation();
  const utils = trpc.useUtils();

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("citationCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const rows: RefRow[] = (list.data?.references ?? []) as RefRow[];
  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.type))).sort(), [rows]);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    let out = rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (!term) return true;
      const auth = Array.isArray(r.authors) ? r.authors.join(" ") : "";
      return `${r.title} ${auth} ${r.doi || ""} ${r.source || ""}`.toLowerCase().includes(term);
    });
    out = [...out].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "title") cmp = (a.title || "").localeCompare(b.title || "");
      else cmp = (Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, q, typeFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllOnPage = () => setSelected((s) => {
    const n = new Set(s);
    if (allOnPageSelected) pageRows.forEach((r) => n.delete(r.id));
    else pageRows.forEach((r) => n.add(r.id));
    return n;
  });

  const bulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} reference(s)?`)) return;
    await remove.mutateAsync({ ids: [...selected] });
    setSelected(new Set());
    await utils.researchHub.references.list.invalidate();
    toast.success("Deleted");
  };
  const bulkSaveKb = async () => {
    if (!selected.size) return;
    for (const id of selected) await saveKb.mutateAsync({ id });
    toast.success(`Saved ${selected.size} to Knowledge Base`);
    setSelected(new Set());
  };

  const setSort = (k: SortKey) => { if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortKey(k); setSortDir("desc"); } };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search references…" className="pl-8" />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground">
          <option value="all">All types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <AddRefDialog onCreate={async (vals) => { await create.mutateAsync(vals); await utils.researchHub.references.list.invalidate(); toast.success("Reference added"); }} />
        <ImportDialog onImport={async (format, text) => { const r = await doImport.mutateAsync({ format, text }); await utils.researchHub.references.list.invalidate(); toast.success(`Imported ${r.imported}`); }} />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm text-foreground">{selected.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={bulkSaveKb} disabled={saveKb.isPending}><Save className="w-3.5 h-3.5 mr-1" /> Save to KB</Button>
          <Button size="sm" variant="outline" onClick={bulkDelete} className="text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
          <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Loading / empty */}
      {list.isLoading && <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />)}</div>}
      {!list.isLoading && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <LibraryIcon className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No references yet. Save sources from a search, add one manually, or import a DOI / BibTeX / RIS file.</p>
        </div>
      )}
      {!list.isLoading && rows.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No references match your filters.</div>
      )}

      {/* Desktop table */}
      {filtered.length > 0 && (
        <div className="hidden md:block rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2"><input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} className="accent-[var(--primary)] w-4 h-4" /></th>
                <th className="text-left px-3 py-2 cursor-pointer" onClick={() => setSort("title")}><span className="inline-flex items-center gap-1">Title <ArrowUpDown className="w-3 h-3" /></span></th>
                <th className="text-left px-3 py-2 hidden lg:table-cell">Authors</th>
                <th className="text-left px-3 py-2 w-16 cursor-pointer" onClick={() => setSort("year")}><span className="inline-flex items-center gap-1">Year <ArrowUpDown className="w-3 h-3" /></span></th>
                <th className="text-left px-3 py-2 w-20 cursor-pointer" onClick={() => setSort("citationCount")}><span className="inline-flex items-center gap-1">Cites <ArrowUpDown className="w-3 h-3" /></span></th>
                <th className="text-left px-3 py-2 w-24">Type</th>
                <th className="w-20 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} className={`border-t border-border ${selected.has(r.id) ? "bg-primary/5" : "hover:bg-accent/40"}`}>
                  <td className="px-3 py-2"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="accent-[var(--primary)] w-4 h-4" /></td>
                  <td className="px-3 py-2">
                    {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary inline-flex items-center gap-1">{r.title}<ExternalLink className="w-3 h-3 opacity-50" /></a> : <span className="text-foreground">{r.title}</span>}
                    {r.doi && <span className="block text-[10px] text-muted-foreground">{r.doi}</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell truncate max-w-[180px]">{Array.isArray(r.authors) ? r.authors.slice(0, 3).join(", ") : ""}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.year ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.citationCount ? r.citationCount.toLocaleString() : "—"}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{r.type}</Badge></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <button title="Save to KB" onClick={async () => { await saveKb.mutateAsync({ id: r.id }); toast.success("Saved to KB"); }} className="text-muted-foreground hover:text-primary p-1"><Save className="w-3.5 h-3.5" /></button>
                      <button title="Delete" onClick={async () => { if (confirm("Delete this reference?")) { await remove.mutateAsync({ ids: [r.id] }); await utils.researchHub.references.list.invalidate(); } }} className="text-muted-foreground hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {filtered.length > 0 && (
        <div className="md:hidden space-y-2">
          {pageRows.map((r) => (
            <div key={r.id} className={`rounded-lg border p-3 ${selected.has(r.id) ? "border-primary/40 bg-primary/5" : "border-border"}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="accent-[var(--primary)] w-5 h-5 mt-0.5" />
                <div className="min-w-0 flex-1">
                  {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-foreground">{r.title}</a> : <span className="text-sm font-medium text-foreground">{r.title}</span>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                    {r.year ? <span>{r.year}</span> : null}
                    {r.citationCount ? <span>{r.citationCount.toLocaleString()} cites</span> : null}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={async () => { await saveKb.mutateAsync({ id: r.id }); toast.success("Saved to KB"); }} className="text-muted-foreground hover:text-primary p-1.5"><Save className="w-4 h-4" /></button>
                  <button onClick={async () => { if (confirm("Delete?")) { await remove.mutateAsync({ ids: [r.id] }); await utils.researchHub.references.list.invalidate(); } }} className="text-muted-foreground hover:text-red-400 p-1.5"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filtered.length} references</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="p-1.5 rounded-md border border-border disabled:opacity-40 hover:bg-accent"><ChevronLeft className="w-4 h-4" /></button>
            <span>Page {page + 1} / {pageCount}</span>
            <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} className="p-1.5 rounded-md border border-border disabled:opacity-40 hover:bg-accent"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddRefDialog({ onCreate }: { onCreate: (v: any) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [url, setUrl] = useState("");
  const [doi, setDoi] = useState("");
  const [type, setType] = useState("article");
  const save = async () => {
    if (!title.trim()) return;
    await onCreate({ type, title: title.trim(), authors: authors.split(",").map((a) => a.trim()).filter(Boolean), year: year ? parseInt(year, 10) : null, url: url.trim() || undefined, doi: doi.trim() || undefined, source: "manual" });
    setOpen(false); setTitle(""); setAuthors(""); setYear(""); setUrl(""); setDoi("");
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="w-4 h-4 mr-1" /> Add</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add reference</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (required)" />
          <Input value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Authors (comma-separated)" />
          <div className="flex gap-2">
            <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" className="w-24" />
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm flex-1">
              {["article", "webpage", "video", "book", "report"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" />
          <Input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="DOI" />
          <Button onClick={save} disabled={!title.trim()} className="w-full">Add reference</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ onImport }: { onImport: (format: "doi" | "bibtex" | "ris" | "json", text: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"doi" | "bibtex" | "ris" | "json">("doi");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try { await onImport(format, text.trim()); setOpen(false); setText(""); }
    catch (e: any) { toast.error(e?.message || "Import failed"); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" /> Import</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Import references</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <div className="flex gap-1.5">
            {(["doi", "bibtex", "ris", "json"] as const).map((f) => (
              <button key={f} onClick={() => setFormat(f)} className={`px-3 py-1.5 rounded-md text-sm border uppercase ${format === f ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>{f}</button>
            ))}
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8}
            placeholder={format === "doi" ? "Paste DOIs (one per line or comma-separated)" : `Paste ${format.toUpperCase()} content`}
            className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground font-mono" />
          <Button onClick={go} disabled={busy || !text.trim()} className="w-full">{busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Import</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Chat with PDF tab ───────────────────────────────────────────────────────
type ChatMsg = { role: "user" | "assistant"; content: string };
function ChatPdfTab() {
  const [docText, setDocText] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<ChatMsg[]>([]);
  const chat = trpc.researchHub.chatWithDoc.useMutation();
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setExtracting(true);
    try {
      const text = await extractPdfText(file);
      if (!text) { toast.error("No selectable text found (scanned PDF?)"); return; }
      setDocText(text); setDocTitle(file.name); setThread([]);
      toast.success(`Loaded ${file.name} — ${text.length.toLocaleString()} chars`);
    } catch (e: any) { toast.error(e?.message || "Could not read PDF"); }
    finally { setExtracting(false); }
  };

  const ask = async () => {
    if (!question.trim() || !docText) return;
    const userMsg: ChatMsg = { role: "user", content: question.trim() };
    const history = thread.slice(-6);
    setThread((t) => [...t, userMsg]);
    setQuestion("");
    try {
      const r = await chat.mutateAsync({ documentText: docText, question: userMsg.content, title: docTitle || undefined, history });
      setThread((t) => [...t, { role: "assistant", content: r.answer }]);
    } catch (e: any) {
      toast.error(e?.message || "Failed");
      setThread((t) => [...t, { role: "assistant", content: "⚠️ Sorry — that question failed. Try again." }]);
    }
  };

  const clearDoc = () => { setDocText(""); setDocTitle(""); setThread([]); };

  if (!docText) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8">
        <div className="max-w-md mx-auto text-center space-y-4">
          <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Load a document, then ask questions grounded strictly in its text.</p>
          {!pasteMode ? (
            <div className="space-y-2">
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <Button onClick={() => fileRef.current?.click()} disabled={extracting} className="w-full">
                {extracting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Upload className="w-4 h-4 mr-1.5" />} Upload PDF
              </Button>
              <button onClick={() => setPasteMode(true)} className="text-xs text-muted-foreground hover:text-foreground">…or paste text instead</button>
            </div>
          ) : (
            <div className="space-y-2 text-left">
              <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Document title (optional)" />
              <textarea id="pasteText" rows={8} placeholder="Paste document text…" className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground" />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => { const el = document.getElementById("pasteText") as HTMLTextAreaElement; if (el?.value.trim()) { setDocText(el.value.trim()); setThread([]); } }}>Use this text</Button>
                <Button variant="outline" onClick={() => setPasteMode(false)}>Back</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
        <FileText className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm text-foreground truncate flex-1">{docTitle || "Pasted document"}</span>
        <span className="text-[11px] text-muted-foreground">{docText.length.toLocaleString()} chars</span>
        <button onClick={clearDoc} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-3 min-h-[240px] space-y-3">
        {thread.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Ask the first question about this document.</p>}
        {thread.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "bg-primary/15 text-foreground" : "bg-muted/50 text-foreground"}`}>
              {m.role === "assistant" ? <div dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} /> : m.content}
            </div>
          </div>
        ))}
        {chat.isPending && <div className="flex justify-start"><div className="bg-muted/50 rounded-xl px-3 py-2 text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading…</div></div>}
      </div>

      <div className="flex gap-2">
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="Ask about the document…" className="flex-1" />
        <Button onClick={ask} disabled={chat.isPending || !question.trim()}><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
