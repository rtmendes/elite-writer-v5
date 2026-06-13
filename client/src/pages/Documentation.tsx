/**
 * Documentation AI — generate, store, and read product docs & SOPs.
 * Ported from the old app; outputs structured Markdown stored in the KB
 * (category "Documentation"). Left rail = saved docs; right = generate + read.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { FileText, Loader2, Sparkles, Save, Trash2, Search, Copy } from "lucide-react";

function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = esc(md).split("\n");
  let html = "", inList = false, inCode = false;
  for (const ln of lines) {
    if (ln.trim().startsWith("```")) { inCode = !inCode; html += inCode ? '<pre style="background:var(--muted,#1a1a22);padding:10px;border-radius:8px;overflow:auto;font-size:13px"><code>' : "</code></pre>"; continue; }
    if (inCode) { html += ln + "\n"; continue; }
    if (/^#\s/.test(ln)) html += `<h1 style="font-size:20px;font-weight:600;margin:14px 0 8px">${ln.slice(2)}</h1>`;
    else if (/^##\s/.test(ln)) html += `<h2 style="font-size:17px;font-weight:600;margin:12px 0 6px">${ln.slice(3)}</h2>`;
    else if (/^###\s/.test(ln)) html += `<h3 style="font-size:15px;font-weight:600;margin:10px 0 4px">${ln.slice(4)}</h3>`;
    else if (/^[-*]\s/.test(ln)) { if (!inList) { html += "<ul style='margin:6px 0 6px 18px'>"; inList = true; } html += `<li style="margin:2px 0">${ln.slice(2)}</li>`; continue; }
    else { if (inList) { html += "</ul>"; inList = false; } html += ln.trim() ? `<p style="margin:6px 0;line-height:1.6">${ln}</p>` : ""; }
    if (inList && !/^[-*]\s/.test(ln)) { html += "</ul>"; inList = false; }
  }
  if (inList) html += "</ul>";
  return html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, '<code style="background:var(--muted,#1a1a22);padding:1px 5px;border-radius:4px;font-size:13px">$1</code>');
}

export default function Documentation() {
  const docTypes = trpc.documentation.docTypes.useQuery();
  const list = trpc.documentation.list.useQuery();
  const utils = trpc.useUtils();
  const generate = trpc.documentation.generate.useMutation();
  const save = trpc.documentation.save.useMutation();
  const remove = trpc.documentation.remove.useMutation();

  const [docType, setDocType] = useState("sop");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [draft, setDraft] = useState("");
  const [viewing, setViewing] = useState<any>(null);
  const [search, setSearch] = useState("");

  const docs = useMemo(() => {
    const q = search.toLowerCase();
    return (list.data ?? []).filter((d: any) => !q || (d.title || "").toLowerCase().includes(q));
  }, [list.data, search]);

  const run = async () => {
    if (!title.trim()) return;
    try {
      const r = await generate.mutateAsync({ docType: docType as any, title: title.trim(), context: context.trim() || undefined });
      setDraft(r.markdown); setViewing(null);
    } catch (e: any) { toast.error(e?.message || "Generation failed"); }
  };
  const doSave = async () => {
    if (!draft) return;
    await save.mutateAsync({ title: title.trim() || "Untitled doc", content: draft, docType });
    await utils.documentation.list.invalidate();
    toast.success("Saved to documentation");
  };

  const shown = viewing ? viewing.content : draft;

  return (
    <div className="p-4 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-violet-400" />
        <h1 className="text-xl font-bold text-white">Documentation AI</h1>
        <span className="text-sm text-zinc-500">generate & maintain docs and SOPs</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
        {/* Left: saved docs */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-600" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search docs…"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-zinc-600" />
          </div>
          {list.isLoading && [...Array(3)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-800/60" />)}
          {docs.length === 0 && !list.isLoading && <div className="text-xs text-zinc-600 px-1 py-4">No saved docs yet.</div>}
          {docs.map((d: any) => (
            <div key={d.id} className={`group flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer ${viewing?.id === d.id ? "border-violet-500 bg-violet-500/10" : "border-zinc-800 hover:bg-zinc-800/40"}`}
              onClick={() => { setViewing(d); setDraft(""); }}>
              <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="text-sm text-zinc-200 truncate flex-1">{d.title}</span>
              <button onClick={async (e) => { e.stopPropagation(); if (confirm(`Delete "${d.title}"?`)) { await remove.mutateAsync({ id: d.id }); if (viewing?.id === d.id) setViewing(null); await utils.documentation.list.invalidate(); } }}
                className="opacity-0 group-hover:opacity-100 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>

        {/* Right: generate + reader */}
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(docTypes.data ?? []).map((t: any) => (
                <button key={t.id} onClick={() => setDocType(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${docType === t.id ? "bg-violet-600 border-violet-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"}`}>{t.label}</button>
              ))}
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Doc title (required)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600" />
            <textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Context / source material (optional) — paste notes, steps, or a transcript"
              rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600" />
            <div className="flex gap-2">
              <button onClick={run} disabled={generate.isPending || !title.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm disabled:opacity-50">
                {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate
              </button>
              {draft && <button onClick={doSave} disabled={save.isPending} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-200 text-sm hover:bg-zinc-800"><Save className="w-4 h-4" /> Save</button>}
            </div>
          </div>

          {generate.isPending && <div className="h-60 animate-pulse rounded-xl bg-zinc-800/60" />}

          {shown && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="flex justify-end mb-2">
                <button onClick={() => { navigator.clipboard.writeText(shown); toast.success("Copied"); }} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white"><Copy className="w-3.5 h-3.5" /> Copy</button>
              </div>
              <div className="text-zinc-200 text-sm" dangerouslySetInnerHTML={{ __html: mdToHtml(shown) }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
