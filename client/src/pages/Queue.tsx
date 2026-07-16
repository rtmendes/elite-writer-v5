/**
 * Article Queue — Pre-Written Pipeline
 *
 * The journalist's inbox: articles arrive pre-written, scored, and ranked.
 * Review in 2 minutes, not 1 hour.
 *
 * A gallery of article "widgets" you can act on and iterate:
 *   - Gallery (default) + List views
 *   - Full-text search, status filter, multi-key sort
 *   - Multi-select with bulk actions (set status, delete, re-score, regenerate,
 *     export CSV / copy for Sheets / append to a Google Sheet, generate covers)
 *   - AI cover thumbnails per article (with deterministic fallback visuals)
 *   - In-app AI image generator
 *   - Pagination past ~100 items, loading skeletons, error + empty states
 *
 * Pipeline: Trending Topic → Research → AI Draft → Score → Queue → Review → Export
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Inbox, CheckCircle2, XCircle, ArrowUpDown,
  Filter, Search, PenTool, Send, Eye, Trash2, MoreHorizontal,
  Zap, BookOpen, Bot, RefreshCw,
  ChevronRight, BarChart3, FileText, Layers,
  Calendar, Timer, Sparkles, LayoutGrid, List as ListIcon,
  Image as ImageIcon, Download, Copy, Table2, RotateCcw, Loader2, X,
} from 'lucide-react';
import { getScoreBgColor } from '@/lib/scoring';
import { checkContentQuality, getGradeBgColor } from '@/lib/quality-checker';
import { AGENTS } from '@/lib/agents';
import {
  buildCoverMap, coverVisual, articlesToRows, rowsToCsv, type QueueExportRow,
} from '@/lib/queue-tools';
import { EditDrawer, type FieldDef } from '@/components/admin/EditDrawer';
import { MediaPicker } from '@/components/admin/MediaPicker';
import { SavedViewBar, type ViewConfig } from '@/components/admin/SavedViewBar';

// Article status in the queue pipeline
type QueueStatus = 'researching' | 'drafting' | 'scoring' | 'queued' | 'review' | 'approved' | 'rejected';

// DB-backed statuses the article rows actually persist
type DbStatus = 'draft' | 'review' | 'scored' | 'pitched' | 'published';

type QueueItem = {
  id: number;
  title: string;
  topic: string;
  status: QueueStatus;
  score: number | null;
  qualityGrade: string | null;
  targetPublication: string | null;
  template: string | null;
  brandVoice: string | null;
  content: string;
  wordCount: number;
  researchNotes: number;
  createdAt: string;
  estimatedReadTime: number;
  aiModel: string;
  tags: string[];
  previewSnippet: string;
  coverUrl: string | null;
  needsScoring: boolean;
  importedFrom: string | null;
};

const STATUS_CONFIG: Record<QueueStatus, { label: string; color: string; icon: any }> = {
  researching: { label: 'Researching', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Search },
  drafting: { label: 'Drafting', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: PenTool },
  scoring: { label: 'Scoring', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: Sparkles },
  queued: { label: 'Queued', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: Inbox },
  review: { label: 'In Review', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: Eye },
  approved: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
};

// Bulk "set status" options map to the DB statuses the backend accepts.
const BULK_STATUS_OPTIONS: { value: DbStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'In Review' },
  { value: 'scored', label: 'Scored' },
  { value: 'pitched', label: 'Pitched' },
  { value: 'published', label: 'Published' },
];

const IMAGE_STYLES = ['editorial', 'bloomberg', 'forbes', 'atlantic', 'nyt', 'abstract', 'photographic', 'cinematic', 'minimal'] as const;
const PAGE_SIZE = 24;

// Payload-style edit-drawer field schema for an article (metadata only —
// the long-form body stays in the Writer). Persisted via data.articles.update.
const ARTICLE_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Title', type: 'text', group: 'Content' },
  { key: 'excerpt', label: 'Excerpt', type: 'textarea', rows: 3, group: 'Content', placeholder: 'Short dek / summary' },
  { key: 'category', label: 'Category', type: 'text', group: 'Content' },
  { key: 'tags', label: 'Tags', type: 'tags', group: 'Content' },
  { key: 'status', label: 'Status', type: 'select', group: 'Publication', options: [
    { value: 'draft', label: 'Draft' },
    { value: 'review', label: 'Review' },
    { value: 'scored', label: 'Scored' },
    { value: 'pitched', label: 'Pitched' },
    { value: 'published', label: 'Published' },
  ] },
  { key: 'targetPublication', label: 'Target publication', type: 'text', group: 'Publication' },
  { key: 'brandId', label: 'Brand ID', type: 'text', group: 'Publication' },
  { key: 'overallScore', label: 'Score', type: 'readonly', group: 'Pipeline', format: (v) => (v == null ? '—' : String(v)) },
  { key: 'wordCount', label: 'Word count', type: 'readonly', group: 'Pipeline', format: (v) => (v == null ? '—' : Number(v).toLocaleString()) },
  { key: 'createdAt', label: 'Created', type: 'readonly', group: 'Pipeline', format: (v) => (v ? new Date(String(v)).toLocaleDateString() : '—') },
  { key: 'sources', label: 'Sources', type: 'chips', group: 'Pipeline' },
];

export default function Queue() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'publication'>('score');
  const [viewMode, setViewMode] = useState<'gallery' | 'list'>('gallery');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // Edit-drawer: holds the raw article row (all DB fields) being edited.
  const [editing, setEditing] = useState<any>(null);
  // Saved-views: which saved view (if any) is currently applied.
  const [activeViewId, setActiveViewId] = useState<number | null>(null);

  // Image generator dialog: targets a single article (cover) when articleId set.
  const [imageDialog, setImageDialog] = useState<{ articleId: number; title: string } | null>(null);

  // Data
  const articlesQuery = trpc.data.articles.list.useQuery(undefined, { staleTime: 30_000 });
  const coversQuery = trpc.data.articles.covers.useQuery(undefined, { staleTime: 30_000 });
  const googleStatus = trpc.google.status.useQuery(undefined, { staleTime: 60_000 });
  const articles = articlesQuery.data ?? [];

  // Mutations
  const discoverTopics = trpc.queue.discoverTopics.useMutation();
  const generateArticle = trpc.queue.generateArticle.useMutation();
  const updateStatus = trpc.queue.updateStatus.useMutation();
  const deleteArticle = trpc.queue.deleteArticle.useMutation();
  const scoreArticle = trpc.ai.score.useMutation();
  const updateArticle = trpc.data.articles.update.useMutation();
  const generateImage = trpc.creative.generateArticleImage.useMutation();
  const writeSheet = trpc.google.writeSheet.useMutation();

  // One cover URL per article (newest non-placeholder wins).
  const coverMap = useMemo(() => buildCoverMap(coversQuery.data ?? []), [coversQuery.data]);

  // Transform DB articles into queue items
  const queueItems: QueueItem[] = useMemo(() => {
    return articles.map((article: any) => {
      const content = article.content || '';
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      const qualityReport = wordCount > 30 ? checkContentQuality(content) : null;
      return {
        id: article.id,
        title: article.title || 'Untitled',
        topic: article.template || 'General',
        status: mapArticleStatus(article.status),
        score: article.overallScore || null,
        qualityGrade: qualityReport?.grade || null,
        targetPublication: article.targetPublication || null,
        template: article.template || null,
        brandVoice: article.brandVoice || null,
        content,
        wordCount,
        researchNotes: 0,
        createdAt: article.createdAt || new Date().toISOString(),
        estimatedReadTime: Math.max(1, Math.round(wordCount / 250)),
        aiModel: 'claude-sonnet',
        tags: [article.brandVoice].filter(Boolean),
        previewSnippet: getPreviewSnippet(content),
        coverUrl: coverMap.get(article.id) ?? null,
        // needsScoring is set on external ingest (ZimmWriter); show it until the
        // article actually gets a score, so imported drafts are actionable.
        needsScoring: Boolean(article.needsScoring) && !article.overallScore,
        importedFrom: article.importedFrom ?? null,
      };
    });
  }, [articles, coverMap]);

  // Filter + sort
  const filteredItems = useMemo(() => {
    let items = [...queueItems];
    if (statusFilter !== 'all') items = items.filter(i => i.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.topic.toLowerCase().includes(q) ||
        (i.targetPublication ?? '').toLowerCase().includes(q) ||
        i.previewSnippet.toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => {
      if (sortBy === 'score') return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return (a.targetPublication ?? '').localeCompare(b.targetPublication ?? '');
    });
    return items;
  }, [queueItems, statusFilter, searchQuery, sortBy]);

  // Reset to page 1 whenever the result set changes shape.
  useEffect(() => { setPage(1); }, [searchQuery, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    if (filteredItems.length <= PAGE_SIZE) return filteredItems;
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  // Selection helpers (Set of article ids)
  const toggleSelect = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const visibleIds = filteredItems.map(i => i.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const toggleSelectAll = useCallback(() => {
    setSelected(prev => {
      if (visibleIds.length > 0 && visibleIds.every(id => prev.has(id))) return new Set();
      return new Set(visibleIds);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems]);
  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const selectedItems = useMemo(
    () => filteredItems.filter(i => selected.has(i.id)),
    [filteredItems, selected]
  );

  // Stats
  const stats = useMemo(() => ({
    total: queueItems.length,
    queued: queueItems.filter(i => i.status === 'queued').length,
    inPipeline: queueItems.filter(i => ['researching', 'drafting', 'scoring'].includes(i.status)).length,
    approved: queueItems.filter(i => i.status === 'approved').length,
    avgScore: queueItems.filter(i => i.score).length > 0
      ? Math.round(queueItems.filter(i => i.score).reduce((s, i) => s + (i.score ?? 0), 0) / queueItems.filter(i => i.score).length * 10) / 10
      : 0,
  }), [queueItems]);

  const refresh = useCallback(async () => {
    await Promise.all([articlesQuery.refetch(), coversQuery.refetch()]);
  }, [articlesQuery, coversQuery]);

  // Open the edit-drawer for an article id (looks up the raw DB row).
  const openEditor = useCallback((id: number) => {
    setEditing((articles as any[]).find((a) => a.id === id) ?? null);
  }, [articles]);

  // ─── Saved views: snapshot current view state + apply a stored one ───
  const viewConfig: ViewConfig = {
    search: searchQuery,
    filters: { status: statusFilter },
    sort: { field: sortBy, dir: 'desc' },
    mode: viewMode,
  };

  const applyView = (id: number | null, config: ViewConfig | null) => {
    setActiveViewId(id);
    if (!config) {
      setSearchQuery('');
      setStatusFilter('all');
      setSortBy('score');
      setViewMode('gallery');
      return;
    }
    setSearchQuery(config.search ?? '');
    const st = config.filters?.status as QueueStatus | 'all' | undefined;
    setStatusFilter(st ?? 'all');
    const sf = config.sort?.field;
    if (sf === 'score' || sf === 'date' || sf === 'publication') setSortBy(sf);
    if (config.mode === 'list' || config.mode === 'gallery') setViewMode(config.mode);
  };

  // ─── Single-item handlers ───
  const handleOpenInWriter = (id: number) => navigate(`/writer/${id}`);

  const handleUpdateStatus = async (id: number, status: DbStatus) => {
    try {
      await updateStatus.mutateAsync({ articleId: id, status });
      await articlesQuery.refetch();
      toast.success(`Article moved to ${status}`);
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteArticle.mutateAsync({ articleId: id });
      await refresh();
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      toast.success('Article removed');
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    }
  };

  // ─── Bulk handlers ───
  const bulkSetStatus = async (status: DbStatus) => {
    if (selectedItems.length === 0) return;
    setBusy('status');
    let ok = 0;
    for (const it of selectedItems) {
      try { await updateStatus.mutateAsync({ articleId: it.id, status }); ok++; } catch { /* keep going */ }
    }
    await articlesQuery.refetch();
    setBusy(null);
    toast.success(`${ok}/${selectedItems.length} moved to ${status}`);
  };

  const bulkDelete = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(`Delete ${selectedItems.length} article(s)? This cannot be undone.`)) return;
    setBusy('delete');
    let ok = 0;
    for (const it of selectedItems) {
      try { await deleteArticle.mutateAsync({ articleId: it.id }); ok++; } catch { /* keep going */ }
    }
    await refresh();
    clearSelection();
    setBusy(null);
    toast.success(`${ok} article(s) removed`);
  };

  const bulkRescore = async () => {
    if (selectedItems.length === 0) return;
    setBusy('rescore');
    let ok = 0;
    for (const it of selectedItems) {
      if (!it.content || it.wordCount < 30) continue;
      try {
        const res = await scoreArticle.mutateAsync({
          title: it.title,
          content: it.content,
          targetPublication: it.targetPublication ?? undefined,
          brandVoice: it.brandVoice ?? undefined,
        });
        const overall = res?.data?.overall ?? 0;
        // ai.score returns 0–100; the card displays /10, so store the rounded /10.
        await updateArticle.mutateAsync({
          id: it.id,
          overallScore: Math.round(overall / 10),
          scoreData: res?.data,
          status: 'scored',
        });
        ok++;
      } catch { /* keep going */ }
    }
    await articlesQuery.refetch();
    setBusy(null);
    toast.success(`Re-scored ${ok}/${selectedItems.length}`);
  };

  const bulkRegenerate = async () => {
    if (selectedItems.length === 0) return;
    if (!window.confirm(
      `Regenerate ${selectedItems.length} draft(s)? This creates a NEW article from each brief — your existing drafts are left untouched.`
    )) return;
    setBusy('regenerate');
    let ok = 0;
    for (const it of selectedItems) {
      try {
        const result = await generateArticle.mutateAsync({
          title: it.title,
          targetPublication: it.targetPublication ?? undefined,
          template: it.template ?? undefined,
          brandVoice: it.brandVoice ?? undefined,
          model: 'claude-sonnet',
          wordCount: it.wordCount > 200 ? it.wordCount : 2000,
        });
        if (result.success) ok++;
      } catch { /* keep going */ }
    }
    await refresh();
    setBusy(null);
    toast.success(`Regenerated ${ok}/${selectedItems.length} as new drafts`);
  };

  // Export the current selection (or everything visible if nothing selected).
  const exportRows = (): QueueExportRow[] => {
    const src = selectedItems.length > 0 ? selectedItems : filteredItems;
    return src.map(toExportRow);
  };

  const exportCsv = () => {
    const rows = articlesToRows(exportRows());
    if (rows.length <= 1) { toast.error('Nothing to export'); return; }
    downloadCsv(`article-queue-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(rows));
    toast.success(`Exported ${rows.length - 1} article(s) to CSV`);
  };

  const copyForSheets = async () => {
    const rows = articlesToRows(exportRows());
    if (rows.length <= 1) { toast.error('Nothing to copy'); return; }
    // TSV is the paste-ready format Google Sheets expects from the clipboard.
    const tsv = rows.map(r => r.map(f => f.replace(/[\t\n\r]+/g, ' ')).join('\t')).join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      toast.success(`Copied ${rows.length - 1} row(s) — paste into Google Sheets`);
    } catch {
      toast.error('Clipboard blocked — use Export CSV instead');
    }
  };

  const appendToSheet = async () => {
    const rows = articlesToRows(exportRows());
    if (rows.length <= 1) { toast.error('Nothing to export'); return; }
    const sheetId = window.prompt(
      'Paste the Google Sheet ID (the long string in the sheet URL between /d/ and /edit):'
    );
    if (!sheetId) return;
    setBusy('sheet');
    try {
      const res = await writeSheet.mutateAsync({
        sheetId: sheetId.trim(),
        range: 'Sheet1!A1',
        values: rows,
        mode: 'append',
      });
      toast.success(`Appended ${res.updatedRows ?? rows.length} row(s) to your Google Sheet`);
    } catch (err: any) {
      toast.error('Sheet export failed: ' + (err.message || 'unknown'));
    } finally {
      setBusy(null);
    }
  };

  const bulkGenerateCovers = async () => {
    if (selectedItems.length === 0) return;
    setBusy('covers');
    let ok = 0;
    for (const it of selectedItems) {
      try {
        await generateImage.mutateAsync({
          prompt: it.title,
          type: 'hero',
          style: 'editorial',
          articleTitle: it.title,
          articleId: it.id,
          size: 'landscape',
        });
        ok++;
        await new Promise(r => setTimeout(r, 400)); // be gentle on the provider
      } catch { /* keep going */ }
    }
    await coversQuery.refetch();
    setBusy(null);
    toast.success(`Generated ${ok}/${selectedItems.length} cover image(s)`);
  };

  const handleStartPipeline = useCallback(async () => {
    setPipelineRunning(true);
    try {
      setPipelineStep('Discovering trending topics...');
      toast.info('🔍 Discovering trending topics...');
      const { topics } = await discoverTopics.mutateAsync({ count: 3 });
      if (!topics || topics.length === 0) {
        toast.error('No topics found. Try again.');
        setPipelineRunning(false);
        return;
      }
      toast.success(`Found ${topics.length} topics — generating articles...`);
      let generated = 0;
      for (const topic of topics) {
        setPipelineStep(`Writing: ${topic.title || topic.topic}...`);
        toast.info(`✍️ Drafting: ${(topic.title || topic.topic).slice(0, 60)}...`);
        try {
          const result = await generateArticle.mutateAsync({
            title: topic.title || topic.topic,
            targetPublication: topic.suggestedPublication,
            template: topic.suggestedTemplate,
            model: 'claude-sonnet',
            wordCount: topic.estimatedWords || 2000,
          });
          if (result.success) {
            generated++;
            toast.success(`✅ "${result.headline}" — score: ${result.score}/10, ${result.wordCount} words`);
          }
        } catch (err: any) {
          toast.error(`Failed: ${(topic.title || topic.topic).slice(0, 40)}: ${err.message}`);
        }
      }
      await refresh();
      setPipelineStep('');
      toast.success(`Pipeline complete — ${generated} articles ready for review!`);
    } catch (err: any) {
      toast.error('Pipeline error: ' + (err.message || 'Unknown'));
    } finally {
      setPipelineRunning(false);
      setPipelineStep('');
    }
  }, [discoverTopics, generateArticle, refresh]);

  const runImageGenerator = async (prompt: string, style: string, size: string) => {
    if (!imageDialog) return;
    setBusy('image');
    try {
      await generateImage.mutateAsync({
        prompt: prompt || imageDialog.title,
        type: 'hero',
        style: style as any,
        articleTitle: imageDialog.title,
        articleId: imageDialog.articleId,
        size: size as any,
      });
      await coversQuery.refetch();
      toast.success('Cover image generated');
      setImageDialog(null);
    } catch (err: any) {
      toast.error('Image generation failed: ' + (err.message || 'unknown'));
    } finally {
      setBusy(null);
    }
  };

  const anyBusy = busy !== null;

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Inbox className="w-6 h-6 text-primary" />
              Article Queue
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pre-written articles ready for 2-minute review. AI does the work, you do the final polish.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 min-h-[44px] sm:min-h-0" onClick={refresh}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button size="sm" className="gap-1.5 min-h-[44px] sm:min-h-0" onClick={handleStartPipeline} disabled={pipelineRunning}>
              {pipelineRunning ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" />{pipelineStep ? pipelineStep.slice(0, 30) : 'Running...'}</>
              ) : (
                <><Zap className="w-3.5 h-3.5" />Generate Articles</>
              )}
            </Button>
          </div>
        </div>

        {/* ─── Pipeline Status Bar ─── */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <PipelineStat icon={Layers} label="Total Articles" value={stats.total} />
              <PipelineStat icon={Bot} label="In Pipeline" value={stats.inPipeline} color="text-blue-400" />
              <PipelineStat icon={Inbox} label="Ready for Review" value={stats.queued} color="text-green-400" />
              <PipelineStat icon={CheckCircle2} label="Approved" value={stats.approved} color="text-emerald-400" />
              <PipelineStat icon={BarChart3} label="Avg Score" value={`${stats.avgScore}/10`} color="text-yellow-400" />
            </div>

            <div className="hidden sm:flex items-center gap-1 mt-4 text-[10px]">
              {[
                { agent: AGENTS.scout, label: 'Topics', done: true },
                { agent: AGENTS.researcher, label: 'Research', active: stats.inPipeline > 0 },
                { agent: AGENTS.drafter, label: 'AI Draft', active: stats.inPipeline > 0 },
                { agent: AGENTS.scorer, label: 'Score', active: stats.inPipeline > 0 },
                { agent: AGENTS.proofreader, label: 'Queue', count: stats.queued },
                { agent: AGENTS.editor, label: 'Review' },
                { agent: AGENTS.quality, label: 'Publish', done: stats.approved > 0 },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex items-center">
                  <div className="flex flex-col items-center gap-0.5" title={`${step.agent.name} — ${step.agent.role}`}>
                    <div className={`w-7 h-7 rounded-full overflow-hidden ring-1 ${(step as any).active ? 'ring-2 ring-primary animate-pulse' : (step as any).done ? 'ring-green-500/50' : 'ring-border/50'}`}>
                      <img src={step.agent.avatar} alt={step.agent.name} className="w-full h-full object-cover" />
                    </div>
                    <span className={`${(step as any).active ? 'text-primary font-medium' : (step as any).done ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {step.label}{(step as any).count ? ` (${(step as any).count})` : ''}
                    </span>
                  </div>
                  {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ─── Toolbar: search, filter, sort, view toggle ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search title, topic, publication, body..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
              <SelectTrigger className="w-40 h-10">
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger className="w-40 h-10">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Highest Score</SelectItem>
                <SelectItem value="date">Most Recent</SelectItem>
                <SelectItem value="publication">Publication</SelectItem>
              </SelectContent>
            </Select>

            {/* View toggle: Gallery (default) + List */}
            <div className="flex items-center rounded-md border border-border overflow-hidden h-10">
              <button
                type="button"
                aria-label="Gallery view"
                onClick={() => setViewMode('gallery')}
                className={`flex items-center justify-center w-11 h-10 ${viewMode === 'gallery' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setViewMode('list')}
                className={`flex items-center justify-center w-11 h-10 border-l border-border ${viewMode === 'list' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50'}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── Saved views ─── */}
        <SavedViewBar page="queue" currentConfig={viewConfig} activeViewId={activeViewId} onApply={applyView} />

        {/* ─── Select-all + result count ─── */}
        {filteredItems.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px] sm:min-h-0">
              <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
              Select all ({filteredItems.length})
            </label>
            {selected.size > 0 && <span className="text-primary font-medium">{selected.size} selected</span>}
          </div>
        )}

        {/* ─── Bulk action bar ─── */}
        {selected.size > 0 && (
          <Card className="border-primary/30 bg-primary/[0.03] sticky top-2 z-20">
            <CardContent className="p-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium mr-1">{selected.size} selected</span>

              <Select onValueChange={v => bulkSetStatus(v as DbStatus)} disabled={anyBusy}>
                <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Set status…" /></SelectTrigger>
                <SelectContent>
                  {BULK_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>

              <BulkBtn icon={Sparkles} label="Re-score" busy={busy === 'rescore'} disabled={anyBusy} onClick={bulkRescore} />
              <BulkBtn icon={RotateCcw} label="Regenerate" busy={busy === 'regenerate'} disabled={anyBusy} onClick={bulkRegenerate} />
              <BulkBtn icon={ImageIcon} label="Generate covers" busy={busy === 'covers'} disabled={anyBusy} onClick={bulkGenerateCovers} />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={anyBusy}>
                    <Download className="w-3.5 h-3.5" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={exportCsv}><Download className="w-3.5 h-3.5 mr-2" /> Download CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={copyForSheets}><Copy className="w-3.5 h-3.5 mr-2" /> Copy for Sheets</DropdownMenuItem>
                  {googleStatus.data?.connected ? (
                    <DropdownMenuItem onClick={appendToSheet}><Table2 className="w-3.5 h-3.5 mr-2" /> Append to Google Sheet…</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => navigate('/settings')}>
                      <Table2 className="w-3.5 h-3.5 mr-2" /> Connect Google to export…
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <BulkBtn icon={Trash2} label="Delete" busy={busy === 'delete'} disabled={anyBusy} onClick={bulkDelete} destructive />

              <Button variant="ghost" size="sm" className="h-9 ml-auto gap-1" onClick={clearSelection} disabled={anyBusy}>
                <X className="w-3.5 h-3.5" /> Clear
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ─── Body: loading / error / empty / results ─── */}
        {articlesQuery.isLoading ? (
          <QueueSkeleton viewMode={viewMode} />
        ) : articlesQuery.isError ? (
          <Card className="border-destructive/40">
            <CardContent className="py-12 text-center">
              <XCircle className="w-10 h-10 mx-auto text-destructive/70 mb-3" />
              <h3 className="text-base font-semibold">Couldn't load the queue</h3>
              <p className="text-sm text-muted-foreground mt-1">{(articlesQuery.error as any)?.message || 'Something went wrong.'}</p>
              <Button className="mt-5 gap-1.5" variant="outline" onClick={() => articlesQuery.refetch()}>
                <RefreshCw className="w-4 h-4" /> Retry
              </Button>
            </CardContent>
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-16 text-center">
              <Inbox className="w-12 h-12 mx-auto text-muted-foreground opacity-30 mb-4" />
              <h3 className="text-lg font-semibold">{queueItems.length === 0 ? 'Queue is empty' : 'No articles match your filters'}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {queueItems.length === 0
                  ? 'Click "Generate Articles" to start the AI pipeline. It researches trending topics, drafts publication-grade articles, scores them, and queues the best ones here.'
                  : 'Try clearing the search or switching the status filter to “All Statuses”.'}
              </p>
              {queueItems.length === 0 && (
                <Button className="mt-6 gap-1.5" onClick={handleStartPipeline} disabled={pipelineRunning}>
                  <Zap className="w-4 h-4" /> Generate Articles
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'gallery' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.map(item => (
              <GalleryCard
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onToggleSelect={toggleSelect}
                onOpenInWriter={handleOpenInWriter}
                onDelete={handleDelete}
                onUpdateStatus={handleUpdateStatus}
                onGenerateCover={(id, title) => setImageDialog({ articleId: id, title })}
                onEdit={openEditor}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {paginated.map(item => (
              <ListRow
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onToggleSelect={toggleSelect}
                onOpenInWriter={handleOpenInWriter}
                onDelete={handleDelete}
                onUpdateStatus={handleUpdateStatus}
                onGenerateCover={(id, title) => setImageDialog({ articleId: id, title })}
                onEdit={openEditor}
              />
            ))}
          </div>
        )}

        {/* ─── Pagination ─── */}
        {filteredItems.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
          </div>
        )}
      </div>

      {/* ─── Article edit drawer (Payload-style, autosave) ─── */}
      <EditDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={(editing?.title as string) ?? 'Article'}
        record={editing as Record<string, unknown> | null}
        fields={ARTICLE_FIELDS}
        openInWriter={(r) => navigate(`/writer/${(r as any).id}`)}
        onSave={async (patch) => {
          if (!editing) return;
          await updateArticle.mutateAsync(
            { id: editing.id, ...patch } as Parameters<typeof updateArticle.mutateAsync>[0]
          );
          await articlesQuery.refetch();
        }}
      >
        {editing && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Media</h3>
            <MediaPicker
              value={editing.featuredImageUrl as string | null | undefined}
              onChange={async (url) => {
                setEditing((e: any) => (e ? { ...e, featuredImageUrl: url } : e));
                await updateArticle.mutateAsync(
                  { id: editing.id, featuredImageUrl: url } as Parameters<typeof updateArticle.mutateAsync>[0]
                );
                await articlesQuery.refetch();
              }}
            />
          </section>
        )}
      </EditDrawer>

      {/* ─── AI Image Generator dialog ─── */}
      <ImageGeneratorDialog
        open={!!imageDialog}
        title={imageDialog?.title ?? ''}
        busy={busy === 'image'}
        onClose={() => { if (busy !== 'image') setImageDialog(null); }}
        onGenerate={runImageGenerator}
      />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function PipelineStat({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color?: string;
}) {
  return (
    <div className="text-center">
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color || 'text-muted-foreground'}`} />
      <p className={`text-xl font-bold font-mono ${color || ''}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function BulkBtn({ icon: Icon, label, onClick, busy, disabled, destructive }: {
  icon: any; label: string; onClick: () => void; busy?: boolean; disabled?: boolean; destructive?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={`h-9 gap-1.5 ${destructive ? 'text-red-400 hover:text-red-400 border-red-500/30' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </Button>
  );
}

// Cover banner shared by gallery + list. Uses the generated AI image when
// present, otherwise a deterministic gradient + initials so every card stays
// visually distinguishable.
function Cover({ item, className }: { item: QueueItem; className?: string }) {
  if (item.coverUrl) {
    return <img src={item.coverUrl} alt="" className={`object-cover ${className ?? ''}`} loading="lazy" />;
  }
  const { hue, initials } = coverVisual(item.title);
  return (
    <div
      className={`flex items-center justify-center ${className ?? ''}`}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 42% 32%), hsl(${(hue + 38) % 360} 48% 20%))` }}
    >
      <span className="text-2xl font-bold font-serif text-white/85 tracking-wide">{initials}</span>
    </div>
  );
}

function ActionMenu({ item, onOpenInWriter, onUpdateStatus, onDelete, onGenerateCover, onEdit }: {
  item: QueueItem;
  onOpenInWriter: (id: number) => void;
  onUpdateStatus: (id: number, status: DbStatus) => void;
  onDelete: (id: number) => void;
  onGenerateCover: (id: number, title: string) => void;
  onEdit: (id: number) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(item.id)}><FileText className="w-3.5 h-3.5 mr-2" /> Edit details</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpenInWriter(item.id)}><PenTool className="w-3.5 h-3.5 mr-2" /> Open in Writer</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onGenerateCover(item.id, item.title)}><ImageIcon className="w-3.5 h-3.5 mr-2" /> Generate cover</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'review')}><Eye className="w-3.5 h-3.5 mr-2" /> Mark as Review</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'pitched')}><Send className="w-3.5 h-3.5 mr-2" /> Send to Pitch</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'published')}><CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Mark Published</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-400" onClick={() => onDelete(item.id)}><Trash2 className="w-3.5 h-3.5 mr-2" /> Remove</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type CardProps = {
  item: QueueItem;
  selected: boolean;
  onToggleSelect: (id: number) => void;
  onOpenInWriter: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdateStatus: (id: number, status: DbStatus) => void;
  onGenerateCover: (id: number, title: string) => void;
  onEdit: (id: number) => void;
};

function GalleryCard({ item, selected, onToggleSelect, onOpenInWriter, onDelete, onUpdateStatus, onGenerateCover, onEdit }: CardProps) {
  const config = STATUS_CONFIG[item.status];
  const StatusIcon = config.icon;
  return (
    <Card className={`border-border/80 bg-card/70 hover:border-primary/35 transition-colors group overflow-hidden flex flex-col ${selected ? 'ring-2 ring-primary' : ''}`}>
      {/* Cover */}
      <div className="relative aspect-[16/9] w-full">
        <Cover item={item} className="absolute inset-0 w-full h-full" />
        <div className="absolute top-2 left-2 bg-background/80 backdrop-blur rounded-md p-1.5">
          <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(item.id)} aria-label={`Select ${item.title}`} />
        </div>
        {item.score != null && (
          <div className={`absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center border-2 text-sm font-bold font-mono ${getScoreBgColor(item.score)}`}>
            {item.score}
          </div>
        )}
        {!item.coverUrl && (
          <button
            type="button"
            onClick={() => onGenerateCover(item.id, item.title)}
            className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] bg-background/80 backdrop-blur rounded-md px-2 py-1 hover:text-primary"
          >
            <ImageIcon className="w-3 h-3" /> Add cover
          </button>
        )}
      </div>

      <CardContent className="p-4 flex flex-col flex-1">
        <button type="button" onClick={() => onEdit(item.id)} className="text-left" title="Edit details">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors cursor-pointer hover:underline">{item.title}</h3>
        </button>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <Badge variant="outline" className={`text-[10px] ${config.color}`}><StatusIcon className="w-2.5 h-2.5 mr-1" />{config.label}</Badge>
          {item.needsScoring && <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Sparkles className="w-2.5 h-2.5 mr-1" />Needs scoring</Badge>}
          {item.importedFrom?.startsWith('zimmwriter') && <Badge variant="outline" className="text-[10px]"><Download className="w-2.5 h-2.5 mr-1" />ZimmWriter</Badge>}
          {item.qualityGrade && <Badge className={`text-[10px] font-mono ${getGradeBgColor(item.qualityGrade as any)}`}>{item.qualityGrade}</Badge>}
          {item.targetPublication && <Badge variant="outline" className="text-[10px]"><BookOpen className="w-2.5 h-2.5 mr-1" />{item.targetPublication}</Badge>}
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed line-clamp-3 flex-1">{item.previewSnippet}</p>

        <div className="flex items-center gap-x-3 gap-y-1 mt-3 text-[10px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><FileText className="w-2.5 h-2.5" /> {item.wordCount.toLocaleString()} words</span>
          <span className="flex items-center gap-1"><Timer className="w-2.5 h-2.5" /> {item.estimatedReadTime} min</span>
          <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {formatRelativeTime(item.createdAt)}</span>
        </div>

        <div className="flex items-center gap-1 mt-3">
          {(item.status === 'queued' || item.status === 'review') && (
            <Button size="sm" variant="default" className="h-8 text-xs gap-1 flex-1" onClick={() => onOpenInWriter(item.id)}>
              <Eye className="w-3 h-3" /> Review
            </Button>
          )}
          <ActionMenu item={item} onOpenInWriter={onOpenInWriter} onUpdateStatus={onUpdateStatus} onDelete={onDelete} onGenerateCover={onGenerateCover} onEdit={onEdit} />
        </div>
      </CardContent>
    </Card>
  );
}

function ListRow({ item, selected, onToggleSelect, onOpenInWriter, onDelete, onUpdateStatus, onGenerateCover, onEdit }: CardProps) {
  const config = STATUS_CONFIG[item.status];
  const StatusIcon = config.icon;
  return (
    <Card className={`border-border/80 bg-card/70 hover:border-primary/35 transition-colors group ${selected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(item.id)} aria-label={`Select ${item.title}`} />
        <div className="relative w-16 h-12 shrink-0 rounded overflow-hidden">
          <Cover item={item} className="absolute inset-0 w-full h-full text-base" />
        </div>
        <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center border-2 text-sm font-bold font-mono ${item.score != null ? getScoreBgColor(item.score) : 'bg-muted/30 border-border'}`}>
          {item.score ?? '—'}
        </div>
        <div className="flex-1 min-w-0">
          <button type="button" onClick={() => onEdit(item.id)} className="text-left w-full" title="Edit details">
            <h3 className="font-semibold text-sm leading-tight truncate group-hover:text-primary transition-colors cursor-pointer hover:underline">{item.title}</h3>
          </button>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge variant="outline" className={`text-[10px] ${config.color}`}><StatusIcon className="w-2.5 h-2.5 mr-1" />{config.label}</Badge>
            {item.needsScoring && <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Sparkles className="w-2.5 h-2.5 mr-1" />Needs scoring</Badge>}
            {item.importedFrom?.startsWith('zimmwriter') && <Badge variant="outline" className="text-[10px]"><Download className="w-2.5 h-2.5 mr-1" />ZimmWriter</Badge>}
            {item.targetPublication && <Badge variant="outline" className="text-[10px]"><BookOpen className="w-2.5 h-2.5 mr-1" />{item.targetPublication}</Badge>}
            <span className="text-[10px] text-muted-foreground">{item.wordCount.toLocaleString()} words · {formatRelativeTime(item.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(item.status === 'queued' || item.status === 'review') && (
            <Button size="sm" variant="default" className="h-8 text-xs gap-1" onClick={() => onOpenInWriter(item.id)}>
              <Eye className="w-3 h-3" /> Review
            </Button>
          )}
          <ActionMenu item={item} onOpenInWriter={onOpenInWriter} onUpdateStatus={onUpdateStatus} onDelete={onDelete} onGenerateCover={onGenerateCover} onEdit={onEdit} />
        </div>
      </CardContent>
    </Card>
  );
}

function QueueSkeleton({ viewMode }: { viewMode: 'gallery' | 'list' }) {
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border/60"><CardContent className="p-3 flex items-center gap-3">
            <Skeleton className="w-16 h-12 rounded" />
            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
          </CardContent></Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="border-border/60 overflow-hidden">
          <Skeleton className="aspect-[16/9] w-full" />
          <CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /></CardContent>
        </Card>
      ))}
    </div>
  );
}

function ImageGeneratorDialog({ open, title, busy, onClose, onGenerate }: {
  open: boolean;
  title: string;
  busy: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, style: string, size: string) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<string>('editorial');
  const [size, setSize] = useState<string>('landscape');

  // Default the prompt to the article title each time the dialog opens.
  useEffect(() => { if (open) { setPrompt(title); setStyle('editorial'); setSize('landscape'); } }, [open, title]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary" /> AI Image Generator</DialogTitle>
          <DialogDescription>Generate a cover image for “{title}”. It's saved as this article's cover.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="img-prompt">Prompt</Label>
            <Textarea id="img-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Describe the cover image…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{IMAGE_STYLES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Aspect</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Landscape</SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => onGenerate(prompt, style, size)} disabled={busy} className="gap-1.5">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Generating…' : 'Generate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function toExportRow(i: QueueItem): QueueExportRow {
  return {
    title: i.title,
    status: i.status,
    score: i.score,
    publication: i.targetPublication,
    words: i.wordCount,
    createdAt: i.createdAt,
  };
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getPreviewSnippet(content: string): string {
  const plain = (content || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return 'No draft content yet. Open in Writer to continue refining this piece.';
  return plain.length > 180 ? `${plain.slice(0, 180)}...` : plain;
}

function mapArticleStatus(dbStatus: string): QueueStatus {
  switch (dbStatus) {
    case 'draft': return 'queued';
    case 'review': return 'review';
    case 'scored': return 'queued';
    case 'pitched': return 'approved';
    case 'published': return 'approved';
    default: return 'queued';
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
