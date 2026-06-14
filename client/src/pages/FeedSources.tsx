/**
 * Feed Sources — manage the channels the intelligence engine follows.
 *
 * Surfaces the previously UI-less `sources` tRPC router: add YouTube channels
 * (paste a URL, @handle, or channel ID — the server resolves it), subreddits,
 * websites, RSS feeds, and newsletters; then pull their latest items on demand.
 * Follows the house UI standard: search + type filter + sort + multi-select
 * with bulk actions, loading/empty/error states, mobile card layout.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Rss, Youtube, MessageSquare, Globe, Mail, Plus, Loader2, Trash2,
  RefreshCw, Power, Search, ArrowUp, ArrowDown, ExternalLink, Users,
} from "lucide-react";

type SourceType = "youtube" | "reddit" | "website" | "rss" | "newsletter";

const TYPES: { value: SourceType; label: string; icon: typeof Youtube; placeholder: string; hint: string }[] = [
  { value: "youtube", label: "YouTube", icon: Youtube, placeholder: "youtube.com/@channel, @handle, or channel URL", hint: "Paste a channel URL, @handle, or UC… ID — we resolve it." },
  { value: "reddit", label: "Reddit", icon: MessageSquare, placeholder: "r/subreddit or subreddit name", hint: "A subreddit to follow hot posts from." },
  { value: "website", label: "Website", icon: Globe, placeholder: "https://example.com", hint: "We scrape the page for fresh items." },
  { value: "rss", label: "RSS", icon: Rss, placeholder: "https://example.com/feed.xml", hint: "A direct RSS/Atom feed URL." },
  { value: "newsletter", label: "Newsletter", icon: Mail, placeholder: "Newsletter name", hint: "Generates a forwarding inbox to capture issues." },
];

const TYPE_META: Record<string, { icon: typeof Youtube; color: string }> = {
  youtube: { icon: Youtube, color: "text-red-400" },
  reddit: { icon: MessageSquare, color: "text-orange-400" },
  website: { icon: Globe, color: "text-blue-400" },
  rss: { icon: Rss, color: "text-amber-400" },
  newsletter: { icon: Mail, color: "text-violet-400" },
};

type SortKey = "name" | "type" | "itemCount" | "createdAt";

export default function FeedSources() {
  const utils = trpc.useUtils();
  const sources = trpc.sources.list.useQuery({});
  const add = trpc.sources.add.useMutation();
  const del = trpc.sources.delete.useMutation();
  const toggle = trpc.sources.toggle.useMutation();
  const fetchItems = trpc.sources.fetchItems.useMutation();

  const [type, setType] = useState<SourceType>("youtube");
  const [identifier, setIdentifier] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [fetchingId, setFetchingId] = useState<number | null>(null);

  const activeType = TYPES.find((t) => t.value === type)!;

  const submit = async () => {
    if (!identifier.trim()) return;
    try {
      const r = await add.mutateAsync({ type, identifier: identifier.trim(), category: category.trim() || undefined });
      toast.success(`Added ${r.name}`);
      setIdentifier("");
      setCategory("");
      await utils.sources.list.invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't add source");
    }
  };

  const rows = useMemo(() => {
    let list = (sources.data ?? []) as any[];
    if (typeFilter) list = list.filter((s) => s.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => [s.name, s.identifier, s.description, s.category].some((v) => (v || "").toLowerCase().includes(q)));
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? (sortKey === "itemCount" ? 0 : "");
      const bv = b[sortKey] ?? (sortKey === "itemCount" ? 0 : "");
      if (typeof av === "number" && typeof bv === "number") return dir * (av - bv);
      return dir * String(av).localeCompare(String(bv));
    });
  }, [sources.data, typeFilter, search, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };
  const toggleSel = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} source${selected.size === 1 ? "" : "s"}?`)) return;
    for (const id of selected) await del.mutateAsync({ id });
    setSelected(new Set());
    await utils.sources.list.invalidate();
    toast.success("Deleted");
  };
  const bulkToggle = async (active: boolean) => {
    for (const id of selected) await toggle.mutateAsync({ id, active });
    setSelected(new Set());
    await utils.sources.list.invalidate();
  };
  const pull = async (id: number) => {
    setFetchingId(id);
    try {
      const r = await fetchItems.mutateAsync({ sourceId: id, limit: 20 });
      toast.success(`Pulled ${r.count} item${r.count === 1 ? "" : "s"}`);
      await utils.sources.list.invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Fetch failed");
    } finally {
      setFetchingId(null);
    }
  };

  const SortHead = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="cursor-pointer px-3 py-2 text-left text-xs font-medium text-zinc-400 hover:text-white" onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">{label}{sortKey === k && (sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}</span>
    </th>
  );

  return (
    <div className="p-4 space-y-4 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><Rss className="w-5 h-5 text-violet-400" /> Feed Sources</h1>
        <p className="text-sm text-zinc-500">Follow YouTube channels, subreddits, sites, and feeds — the intelligence engine pulls their latest items.</p>
      </div>

      {/* Add source */}
      <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.value} onClick={() => setType(t.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${type === t.value ? "bg-violet-600 border-violet-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"}`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={activeType.placeholder}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600"
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (optional)"
            className="md:w-40 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600"
          />
          <button onClick={submit} disabled={add.isPending || !identifier.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50">
            {add.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </div>
        <p className="text-xs text-zinc-600">{activeType.hint}</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-600" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sources…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-zinc-600" />
        </div>
        <button onClick={() => setTypeFilter(null)} className={`px-2.5 py-1 rounded-full text-xs ${!typeFilter ? "bg-zinc-700 text-white" : "bg-zinc-800 text-zinc-400"}`}>All</button>
        {TYPES.map((t) => (
          <button key={t.value} onClick={() => setTypeFilter(typeFilter === t.value ? null : t.value)}
            className={`px-2.5 py-1 rounded-full text-xs ${typeFilter === t.value ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}>{t.label}</button>
        ))}
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-violet-500/10 rounded-lg px-3 py-2 text-sm">
          <b className="text-white">{selected.size} selected</b>
          <button className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700 inline-flex items-center gap-1" onClick={() => bulkToggle(true)}><Power className="w-3 h-3" /> Activate</button>
          <button className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-200 hover:bg-zinc-700 inline-flex items-center gap-1" onClick={() => bulkToggle(false)}><Power className="w-3 h-3" /> Pause</button>
          <button className="px-2.5 py-1 rounded-md bg-red-500/20 text-red-300 hover:bg-red-500/30 inline-flex items-center gap-1" onClick={bulkDelete}><Trash2 className="w-3 h-3" /> Delete</button>
          <button className="ml-auto text-zinc-400 hover:text-white" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      {/* Loading / error / empty */}
      {sources.isLoading && (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800/60" />)}</div>
      )}
      {sources.isError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Couldn't load sources. <button className="underline" onClick={() => sources.refetch()}>Retry</button>
        </div>
      )}
      {sources.data && rows.length === 0 && (
        <div className="rounded-lg border border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
          {(sources.data as any[]).length === 0 ? "No sources yet — add a YouTube channel above to start." : "Nothing matches your filters."}
        </div>
      )}

      {/* Desktop table */}
      {rows.length > 0 && (
        <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full">
            <thead className="bg-zinc-900/80">
              <tr>
                <th className="w-9 px-3 py-2"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} /></th>
                <SortHead k="name" label="Source" />
                <SortHead k="type" label="Type" />
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Category</th>
                <SortHead k="itemCount" label="Items" />
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Status</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const Meta = TYPE_META[s.type] ?? TYPE_META.rss;
                const Icon = Meta.icon;
                const active = s.active === 1 || s.active === true;
                return (
                  <tr key={s.id} className={`border-t border-zinc-800/70 ${selected.has(s.id) ? "bg-violet-500/5" : "hover:bg-zinc-800/40"}`}>
                    <td className="px-3 py-2"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {s.iconUrl ? <img src={s.iconUrl} alt="" className="w-6 h-6 rounded-full shrink-0" /> : <Icon className={`w-5 h-5 ${Meta.color} shrink-0`} />}
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate max-w-[280px]">{s.name}</div>
                          {s.metadata?.subscriber_count ? <div className="text-[11px] text-zinc-500 flex items-center gap-1"><Users className="w-3 h-3" />{Number(s.metadata.subscriber_count).toLocaleString()} subs</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2"><span className={`inline-flex items-center gap-1 text-xs ${Meta.color}`}><Icon className="w-3 h-3" /> {s.type}</span></td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{s.category || "—"}</td>
                    <td className="px-3 py-2 text-sm text-zinc-300">{s.itemCount ?? 0}</td>
                    <td className="px-3 py-2">
                      <button onClick={async () => { await toggle.mutateAsync({ id: s.id, active: !active }); await utils.sources.list.invalidate(); }}
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${active ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-400"}`}>
                        {active ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button title="Pull latest" onClick={() => pull(s.id)} disabled={fetchingId === s.id}
                          className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-300 disabled:opacity-50">
                          {fetchingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                        {s.identifier && s.type !== "newsletter" && (
                          <a title="Open" target="_blank" rel="noreferrer"
                            href={s.type === "youtube" ? `https://youtube.com/channel/${s.identifier}` : s.type === "reddit" ? `https://reddit.com/r/${s.identifier}` : s.identifier}
                            className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-300"><ExternalLink className="w-4 h-4" /></a>
                        )}
                        <button title="Delete" onClick={async () => { if (confirm(`Delete ${s.name}?`)) { await del.mutateAsync({ id: s.id }); await utils.sources.list.invalidate(); } }}
                          className="p-1.5 rounded-md hover:bg-red-500/20 text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {rows.length > 0 && (
        <div className="md:hidden space-y-2">
          {rows.map((s) => {
            const Meta = TYPE_META[s.type] ?? TYPE_META.rss;
            const Icon = Meta.icon;
            const active = s.active === 1 || s.active === true;
            return (
              <div key={s.id} className={`rounded-lg border border-zinc-800 p-3 ${selected.has(s.id) ? "ring-1 ring-violet-400" : ""}`}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1 min-h-[20px] min-w-[20px]" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} />
                  {s.iconUrl ? <img src={s.iconUrl} alt="" className="w-8 h-8 rounded-full" /> : <Icon className={`w-6 h-6 ${Meta.color}`} />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white">{s.name}</div>
                    <div className="text-[11px] text-zinc-500">{s.type}{s.category ? ` · ${s.category}` : ""} · {s.itemCount ?? 0} items · {active ? "Active" : "Paused"}</div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => pull(s.id)} disabled={fetchingId === s.id} className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-200 text-xs inline-flex items-center gap-1 disabled:opacity-50">
                        {fetchingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Pull
                      </button>
                      <button onClick={async () => { await toggle.mutateAsync({ id: s.id, active: !active }); await utils.sources.list.invalidate(); }} className="px-2 py-1 rounded-md bg-zinc-800 text-zinc-200 text-xs">{active ? "Pause" : "Activate"}</button>
                      <button onClick={async () => { if (confirm(`Delete ${s.name}?`)) { await del.mutateAsync({ id: s.id }); await utils.sources.list.invalidate(); } }} className="px-2 py-1 rounded-md bg-red-500/20 text-red-300 text-xs ml-auto"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
