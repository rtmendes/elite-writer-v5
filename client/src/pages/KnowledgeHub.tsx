/**
 * Knowledge Hub — GitBook/Mintlify-style reading view over the knowledge base
 * (ported from the old app). Category tree on the left, rendered article on the
 * right. Reuses kb.index + kb.get; read-only reader (editing lives in Library).
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { BookOpen, Search, ChevronRight, ChevronDown } from "lucide-react";

function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc(md || "").split("\n");
  let html = "", inList = false, inCode = false;
  for (const ln of lines) {
    if (ln.trim().startsWith("```")) { inCode = !inCode; html += inCode ? '<pre style="background:rgba(127,127,127,0.12);padding:10px;border-radius:8px;overflow:auto;font-size:13px"><code>' : "</code></pre>"; continue; }
    if (inCode) { html += ln + "\n"; continue; }
    if (/^#\s/.test(ln)) html += `<h1 style="font-size:22px;font-weight:600;margin:16px 0 10px">${ln.slice(2)}</h1>`;
    else if (/^##\s/.test(ln)) html += `<h2 style="font-size:18px;font-weight:600;margin:14px 0 8px">${ln.slice(3)}</h2>`;
    else if (/^###\s/.test(ln)) html += `<h3 style="font-size:15px;font-weight:600;margin:10px 0 4px">${ln.slice(4)}</h3>`;
    else if (/^[-*]\s/.test(ln)) { if (!inList) { html += "<ul style='margin:6px 0 6px 18px'>"; inList = true; } html += `<li style="margin:3px 0">${ln.slice(2)}</li>`; continue; }
    else { if (inList) { html += "</ul>"; inList = false; } html += ln.trim() ? `<p style="margin:8px 0;line-height:1.7">${ln}</p>` : ""; }
    if (inList && !/^[-*]\s/.test(ln)) { html += "</ul>"; inList = false; }
  }
  if (inList) html += "</ul>";
  return html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, '<code style="background:rgba(127,127,127,0.12);padding:1px 5px;border-radius:4px;font-size:13px">$1</code>');
}

export default function KnowledgeHub() {
  const index = trpc.kb.index.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const doc = trpc.kb.get.useQuery({ id: selectedId! }, { enabled: selectedId != null });
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const items = (index.data ?? []).filter((i: any) => !q || (i.title || "").toLowerCase().includes(q) || (i.hook || "").toLowerCase().includes(q));
    const g: Record<string, any[]> = {};
    for (const i of items) { const c = i.category || "Uncategorized"; (g[c] ||= []).push(i); }
    return g;
  }, [index.data, search]);

  return (
    <div className="p-4 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-5 h-5 text-violet-400" />
        <h1 className="text-xl font-bold text-white">Knowledge Hub</h1>
        <span className="text-sm text-zinc-500">a reading view over your knowledge base</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Left: category tree */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-600" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search knowledge…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-zinc-600" />
          </div>
          {index.isLoading && [...Array(5)].map((_, i) => <div key={i} className="h-8 animate-pulse rounded bg-zinc-800/60" />)}
          {!index.isLoading && Object.keys(grouped).length === 0 && <div className="text-xs text-zinc-600 px-1 py-4">No knowledge items yet — add them in Library or Documentation AI.</div>}
          {Object.entries(grouped).map(([cat, items]) => {
            const open = !collapsed[cat];
            return (
              <div key={cat}>
                <button onClick={() => setCollapsed((c) => ({ ...c, [cat]: open }))}
                  className="w-full flex items-center gap-1 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-300">
                  {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} {cat} <span className="text-zinc-600">({items.length})</span>
                </button>
                {open && (
                  <div className="ml-2 border-l border-zinc-800">
                    {items.map((it: any) => (
                      <button key={it.id} onClick={() => setSelectedId(it.id)}
                        className={`block w-full text-left pl-3 pr-2 py-1.5 text-sm border-l-2 -ml-px ${selectedId === it.id ? "border-violet-500 text-white bg-violet-500/10" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}>
                        {it.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: reader */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 min-h-[400px]">
          {selectedId == null && <div className="text-sm text-zinc-500 flex items-center justify-center h-64">Select an article from the left to read it.</div>}
          {selectedId != null && doc.isLoading && <div className="h-64 animate-pulse rounded-lg bg-zinc-800/60" />}
          {selectedId != null && doc.data && (
            <article className="text-zinc-200 text-sm max-w-[720px]">
              <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">{(doc.data as any).category || "Uncategorized"}</div>
              <div dangerouslySetInnerHTML={{ __html: mdToHtml((doc.data as any).content || "") }} />
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
