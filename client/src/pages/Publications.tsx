import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BookOpen, Search, ExternalLink, Mail, DollarSign, TrendingUp, Download, Send,
  LayoutGrid, List as ListIcon, ArrowUp, ArrowDown, ArrowUpDown, Copy, X,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { PUBLICATIONS, CATEGORIES, getPublicationTier, type Publication } from '@/lib/publications-data';

type ViewMode = 'gallery' | 'list';
type SortDir = 'asc' | 'desc';

// Parse human traffic strings ("31 million", "900k") into a sortable number so
// "sort by traffic" orders correctly instead of lexically ("9" > "31").
function trafficNum(s: string): number {
  const m = s.toLowerCase().replace(/,/g, '').match(/([\d.]+)\s*(million|m|thousand|k)?/);
  if (!m) return 0;
  let n = parseFloat(m[1]) || 0;
  const unit = m[2];
  if (unit === 'million' || unit === 'm') n *= 1_000_000;
  else if (unit === 'thousand' || unit === 'k') n *= 1_000;
  return n;
}

function tierClasses(tier: string): string {
  return tier === 'Tier 1' ? 'text-emerald-400 border-emerald-500/30'
    : tier === 'Tier 2' ? 'text-amber-400 border-amber-500/30'
    : 'text-blue-400 border-blue-500/30';
}

// Single source of truth for the list view: every column carries how to display,
// sort, and (via display) filter itself. The header row, per-column filter row,
// and cells all map over this array — so sort + filter exist on every column.
interface Col {
  key: string;
  label: string;
  display: (p: Publication) => string;
  sort?: (p: Publication) => string | number; // omit → not sortable
  numericDefault?: boolean;                     // first click sorts desc
  className?: string;
}
const COLUMNS: Col[] = [
  { key: 'name', label: 'Publication', display: p => p.name, sort: p => p.name },
  { key: 'category', label: 'Category', display: p => p.category, sort: p => p.category },
  { key: 'tier', label: 'Tier', display: p => getPublicationTier(p), sort: p => getPublicationTier(p) },
  { key: 'pay', label: 'Pay', display: p => p.pay_structure, sort: p => p.pay_max ?? 0, numericDefault: true },
  { key: 'acceptance', label: 'Accept %', display: p => (p.acceptance_rate != null ? `${p.acceptance_rate}%` : '—'), sort: p => p.acceptance_rate ?? 0, numericDefault: true },
  { key: 'response', label: 'Response', display: p => (p.avg_response_days != null ? `${p.avg_response_days}d` : '—'), sort: p => p.avg_response_days ?? 0, numericDefault: true },
  { key: 'traffic', label: 'Traffic/mo', display: p => p.traffic_monthly, sort: p => trafficNum(p.traffic_monthly), numericDefault: true },
  { key: 'topics', label: 'Topics', display: p => p.topics, className: 'max-w-[260px]' },
];

const PAGE_SIZES = [25, 50, 100, 200];

export default function Publications() {
  const [view, setView] = useState<ViewMode>('gallery');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null);
  const [, navigate] = useLocation();

  // Audience & editor intelligence — feeds the 13-dimension scorecard
  // (reader_resonance + editor_alignment) and AI drafting context
  const [intelAvatar, setIntelAvatar] = useState('');
  const [intelEditorPrefs, setIntelEditorPrefs] = useState('');
  const intelQuery = trpc.publications.list.useQuery(
    { search: selectedPub?.name ?? '', limit: 1 },
    { enabled: !!selectedPub }
  );
  useEffect(() => {
    const row = intelQuery.data?.[0] as { audienceAvatar?: string | null; editorPreferences?: string | null } | undefined;
    setIntelAvatar(row?.audienceAvatar ?? '');
    setIntelEditorPrefs(row?.editorPreferences ?? '');
  }, [intelQuery.data, selectedPub?.id]);
  const intelUpsert = trpc.publications.upsert.useMutation();
  const saveIntel = async () => {
    if (!selectedPub) return;
    try {
      await intelUpsert.mutateAsync({
        slug: selectedPub.id,
        name: selectedPub.name,
        audienceAvatar: intelAvatar.trim(),
        editorPreferences: intelEditorPrefs.trim(),
      });
      toast.success('Audience & editor intelligence saved — scoring uses it immediately');
    } catch (e: any) {
      toast.error('Save failed: ' + (e?.message ?? 'unknown error'));
    }
  };

  // ---- filter + sort pipeline (shared by both views) ----
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return PUBLICATIONS.filter(pub => {
      const matchesSearch = !q ||
        pub.name.toLowerCase().includes(q) ||
        pub.topics.toLowerCase().includes(q) ||
        pub.category.toLowerCase().includes(q);
      const matchesCategory = filterCategory === 'all' || pub.category === filterCategory;
      const matchesTier = filterTier === 'all' || getPublicationTier(pub) === filterTier;
      const matchesCols = COLUMNS.every(col => {
        const f = colFilters[col.key];
        return !f || col.display(pub).toLowerCase().includes(f.toLowerCase());
      });
      return matchesSearch && matchesCategory && matchesTier && matchesCols;
    }).sort((a, b) => {
      const col = COLUMNS.find(c => c.key === sortKey);
      const get = col?.sort ?? ((p: Publication) => p.name);
      const av = get(a), bv = get(b);
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [searchQuery, filterCategory, filterTier, colFilters, sortKey, sortDir]);

  // Reset to page 1 whenever the result set changes underneath us
  useEffect(() => { setPage(1); }, [searchQuery, filterCategory, filterTier, colFilters, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key: string) {
    const col = COLUMNS.find(c => c.key === key);
    if (!col?.sort) return;
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(col.numericDefault ? 'desc' : 'asc');
    }
  }

  // ---- selection ----
  const toggleOne = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));
  const someFilteredSelected = !allFilteredSelected && filtered.some(p => selected.has(p.id));
  const toggleAllFiltered = () => setSelected(prev => {
    const n = new Set(prev);
    if (allFilteredSelected) filtered.forEach(p => n.delete(p.id));
    else filtered.forEach(p => n.add(p.id));
    return n;
  });
  const selectedPubs = useMemo(() => PUBLICATIONS.filter(p => selected.has(p.id)), [selected]);

  // ---- bulk actions (non-destructive: static reference DB has no delete/status) ----
  function exportCSV(rows: Publication[], suffix = '') {
    const headers = ['Name','Category','Tier','Pay Min','Pay Max','Pay Structure','Acceptance Rate','Avg Response Days','Topics','Article Styles','Editors','Emails','Submission URL','Traffic','Notes'];
    const body = rows.map(p => [
      p.name, p.category, getPublicationTier(p), p.pay_min ?? '', p.pay_max ?? '', p.pay_structure,
      p.acceptance_rate ?? '', p.avg_response_days ?? '', `"${p.topics}"`, `"${p.article_styles || ''}"`,
      `"${p.editors.map(e => e.name).join('; ')}"`, `"${p.editors.map(e => e.email || '').join('; ')}"`,
      p.submission_url, p.traffic_monthly, `"${(p.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...body.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elite-writer-publications${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const copyEmails = async () => {
    const emails = [...new Set(selectedPubs.flatMap(p => p.editors.map(e => e.email).filter(Boolean)))];
    if (!emails.length) { toast.error('No editor emails in the selected publications'); return; }
    try {
      await navigator.clipboard.writeText(emails.join(', '));
      toast.success(`Copied ${emails.length} editor email${emails.length > 1 ? 's' : ''} to clipboard`);
    } catch {
      toast.error('Clipboard blocked by the browser');
    }
  };

  const tierCounts = useMemo(() => {
    const counts = { 'Tier 1': 0, 'Tier 2': 0, 'Tier 3': 0 } as Record<string, number>;
    PUBLICATIONS.forEach(p => { counts[getPublicationTier(p)]++; });
    return counts;
  }, []);

  const SortGlyph = ({ k }: { k: string }) =>
    sortKey !== k ? <ArrowUpDown className="w-3 h-3 opacity-40" />
      : sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Publication Database
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {PUBLICATIONS.length} publications with editor contacts, pay rates, and submission guidelines
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tier 1 (Premium)', count: tierCounts['Tier 1'], color: 'text-emerald-400' },
          { label: 'Tier 2 (Mid-Range)', count: tierCounts['Tier 2'], color: 'text-amber-400' },
          { label: 'Tier 3 (Entry)', count: tierCounts['Tier 3'], color: 'text-blue-400' },
        ].map(tier => (
          <Card key={tier.label} className="border-border">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold font-mono ${tier.color}`}>{tier.count}</p>
              <p className="text-xs text-muted-foreground">{tier.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar: search + quick filters + view toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search publications, topics..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All Tiers</option>
          <option value="Tier 1">Tier 1</option>
          <option value="Tier 2">Tier 2</option>
          <option value="Tier 3">Tier 3</option>
        </select>
        {view === 'gallery' && (
          <select value={`${sortKey}:${sortDir}`} onChange={e => { const [k, d] = e.target.value.split(':'); setSortKey(k); setSortDir(d as SortDir); }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="name:asc">Sort: Name (A–Z)</option>
            <option value="pay:desc">Sort: Highest Pay</option>
            <option value="acceptance:desc">Sort: Acceptance Rate</option>
            <option value="traffic:desc">Sort: Traffic</option>
          </select>
        )}
        <span className="text-xs text-muted-foreground">{filtered.length} results</span>
        <div className="flex items-center rounded-md border border-input ml-auto">
          <Button variant={view === 'gallery' ? 'secondary' : 'ghost'} size="sm" className="gap-1.5 text-xs rounded-r-none h-9 min-w-[44px]"
            onClick={() => setView('gallery')} aria-pressed={view === 'gallery'}>
            <LayoutGrid className="w-3.5 h-3.5" /> Gallery
          </Button>
          <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="gap-1.5 text-xs rounded-l-none h-9 min-w-[44px]"
            onClick={() => setView('list')} aria-pressed={view === 'list'}>
            <ListIcon className="w-3.5 h-3.5" /> List
          </Button>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCSV(filtered)}>
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      {/* Bulk action bar — appears when ≥1 selected */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCSV(selectedPubs, '-selected')}>
            <Download className="w-3.5 h-3.5" /> Export selected
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={copyEmails}>
            <Copy className="w-3.5 h-3.5" /> Copy editor emails
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs ml-auto" onClick={() => setSelected(new Set())}>
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No publications match your filters.
            <Button variant="link" size="sm" className="ml-1 text-xs"
              onClick={() => { setSearchQuery(''); setFilterCategory('all'); setFilterTier('all'); setColFilters({}); }}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* GALLERY VIEW */}
      {view === 'gallery' && filtered.length > 0 && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {pageRows.map(pub => {
            const tier = getPublicationTier(pub);
            const isSel = selected.has(pub.id);
            return (
              <Card key={pub.id}
                className={`border-border hover:border-primary/20 transition-colors cursor-pointer ${isSel ? 'ring-1 ring-primary/40' : ''}`}
                onClick={() => setSelectedPub(pub)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex items-start gap-2">
                      <span onClick={e => e.stopPropagation()} className="pt-0.5">
                        <Checkbox checked={isSel} onCheckedChange={() => toggleOne(pub.id)} aria-label={`Select ${pub.name}`} />
                      </span>
                      <h3 className="font-semibold text-sm leading-tight">{pub.name}</h3>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${tierClasses(tier)}`}>{tier}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{pub.pay_structure}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">{pub.category}</Badge>
                    {pub.acceptance_rate != null && (
                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{pub.acceptance_rate}% accept</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {view === 'list' && filtered.length > 0 && (
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAllFiltered}
                    aria-label="Select all filtered"
                  />
                </TableHead>
                {COLUMNS.map(col => (
                  <TableHead key={col.key} className={col.className}>
                    {col.sort ? (
                      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(col.key)}>
                        {col.label} <SortGlyph k={col.key} />
                      </button>
                    ) : col.label}
                  </TableHead>
                ))}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
              {/* Per-column filter row */}
              <TableRow className="hover:bg-transparent">
                <TableHead className="p-1" />
                {COLUMNS.map(col => (
                  <TableHead key={col.key} className="p-1">
                    <Input
                      value={colFilters[col.key] ?? ''}
                      onChange={e => setColFilters(f => ({ ...f, [col.key]: e.target.value }))}
                      placeholder="Filter…"
                      className="h-7 text-xs"
                    />
                  </TableHead>
                ))}
                <TableHead className="p-1" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map(pub => {
                const tier = getPublicationTier(pub);
                const isSel = selected.has(pub.id);
                return (
                  <TableRow key={pub.id} className={`cursor-pointer ${isSel ? 'bg-primary/5' : ''}`} onClick={() => setSelectedPub(pub)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={isSel} onCheckedChange={() => toggleOne(pub.id)} aria-label={`Select ${pub.name}`} />
                    </TableCell>
                    <TableCell className="font-medium">{pub.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{pub.category}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={`text-[10px] ${tierClasses(tier)}`}>{tier}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">{pub.pay_structure}</TableCell>
                    <TableCell>{pub.acceptance_rate != null ? `${pub.acceptance_rate}%` : '—'}</TableCell>
                    <TableCell>{pub.avg_response_days != null ? `${pub.avg_response_days}d` : '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{pub.traffic_monthly}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground" title={pub.topics}>{pub.topics}</TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <a href={pub.submission_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Submission guidelines">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Create pitch"
                          onClick={() => navigate(`/pitches?pub=${pub.id}`)}>
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination — list (121) exceeds ~100 rows */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span>
            Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
          </span>
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
          </select>
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2">Page {safePage} / {pageCount}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= pageCount} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedPub} onOpenChange={() => setSelectedPub(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPub?.name}
              <Badge variant="outline" className="text-xs">{selectedPub && getPublicationTier(selectedPub)}</Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedPub && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs block">Category</span>{selectedPub.category}</div>
                <div><span className="text-muted-foreground text-xs block">Monthly Traffic</span>{selectedPub.traffic_monthly}</div>
                <div><span className="text-muted-foreground text-xs block">Pay Range</span>{selectedPub.pay_structure}</div>
                <div><span className="text-muted-foreground text-xs block">Acceptance Rate</span>{selectedPub.acceptance_rate ?? 'N/A'}%</div>
                <div><span className="text-muted-foreground text-xs block">Avg Response</span>{selectedPub.avg_response_days ?? 'N/A'} days</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block mb-1">Topics</span>
                <p className="text-sm">{selectedPub.topics}</p>
              </div>
              {selectedPub.article_styles && (
                <div>
                  <span className="text-muted-foreground text-xs block mb-1">Article Styles</span>
                  <p className="text-sm">{selectedPub.article_styles}</p>
                </div>
              )}
              {selectedPub.notes && (
                <div>
                  <span className="text-muted-foreground text-xs block mb-1">Notes</span>
                  <p className="text-sm">{selectedPub.notes}</p>
                </div>
              )}
              <div className="rounded-md border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                <span className="text-xs font-semibold text-purple-400 block">Audience &amp; editor intelligence</span>
                <div>
                  <span className="text-muted-foreground text-xs block mb-1">Reader avatar — who reads this publication</span>
                  <Textarea rows={3} value={intelAvatar} onChange={(e) => setIntelAvatar(e.target.value)}
                    placeholder="Role, seniority, sophistication, what they're trying to get done, their vocabulary..." />
                </div>
                <div>
                  <span className="text-muted-foreground text-xs block mb-1">Editor preferences — what the gatekeeper buys and rejects</span>
                  <Textarea rows={3} value={intelEditorPrefs} onChange={(e) => setIntelEditorPrefs(e.target.value)}
                    placeholder="Likes (structures, angles, data style), pet peeves, pitch format, past feedback..." />
                </div>
                <Button size="sm" className="text-xs" onClick={saveIntel} disabled={intelUpsert.isPending}>
                  {intelUpsert.isPending ? 'Saving…' : 'Save intelligence'}
                </Button>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block mb-2">Editors</span>
                {selectedPub.editors.map((ed, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm mb-1">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">{ed.name}</span>
                    {ed.email && <a href={`mailto:${ed.email}`} className="text-primary hover:underline">{ed.email}</a>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <a href={selectedPub.submission_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full gap-2 text-xs">
                    <ExternalLink className="w-3.5 h-3.5" /> Submission Guidelines
                  </Button>
                </a>
                <Button className="flex-1 gap-2 text-xs" onClick={() => { setSelectedPub(null); navigate(`/pitches?pub=${selectedPub.id}`); }}>
                  <Send className="w-3.5 h-3.5" /> Create Pitch
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
