/**
 * Article Queue — Pre-Written Pipeline
 * 
 * The journalist's inbox: articles arrive pre-written, scored, and ranked.
 * Review in 2 minutes, not 1 hour.
 * 
 * Pipeline: Trending Topic → Research → AI Draft → Score → Queue → Review → Export
 */

import { useState, useMemo, useCallback } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Calendar, Timer, Sparkles,
} from 'lucide-react';
import { getScoreBgColor } from '@/lib/scoring';
import { checkContentQuality, getGradeBgColor } from '@/lib/quality-checker';
import { AGENTS } from '@/lib/agents';

// Article status in the queue pipeline
type QueueStatus = 'researching' | 'drafting' | 'scoring' | 'queued' | 'review' | 'approved' | 'rejected';

// Simulated queue item (will be replaced by DB-backed articles)
type QueueItem = {
  id: number;
  title: string;
  topic: string;
  status: QueueStatus;
  score: number | null;
  qualityGrade: string | null;
  targetPublication: string | null;
  template: string | null;
  wordCount: number;
  researchNotes: number;
  createdAt: string;
  estimatedReadTime: number;
  aiModel: string;
  tags: string[];
  previewSnippet: string;
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

export default function Queue() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'publication'>('score');
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState('');

  // Fetch existing articles from the database
  const articlesQuery = trpc.data.articles.list.useQuery(undefined, { staleTime: 30_000 });
  const articles = articlesQuery.data ?? [];

  // Backend mutations
  const discoverTopics = trpc.queue.discoverTopics.useMutation();
  const generateArticle = trpc.queue.generateArticle.useMutation();
  const updateStatus = trpc.queue.updateStatus.useMutation();
  const deleteArticle = trpc.queue.deleteArticle.useMutation();

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
        wordCount,
        researchNotes: 0,
        createdAt: article.createdAt || new Date().toISOString(),
        estimatedReadTime: Math.max(1, Math.round(wordCount / 250)),
        aiModel: 'claude-sonnet',
        tags: [article.brandVoice].filter(Boolean),
        previewSnippet: getPreviewSnippet(content),
      };
    });
  }, [articles]);

  // Filter and sort
  const filteredItems = useMemo(() => {
    let items = [...queueItems];
    if (statusFilter !== 'all') items = items.filter(i => i.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(q) || i.topic.toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      if (sortBy === 'score') return (b.score ?? 0) - (a.score ?? 0);
      if (sortBy === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return (a.targetPublication ?? '').localeCompare(b.targetPublication ?? '');
    });
    return items;
  }, [queueItems, statusFilter, searchQuery, sortBy]);

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

  const handleOpenInWriter = (id: number) => {
    navigate(`/writer/${id}`);
  };

  const handleUpdateStatus = async (id: number, status: 'draft' | 'review' | 'scored' | 'pitched' | 'published') => {
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
      await articlesQuery.refetch();
      toast.success('Article removed');
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    }
  };

  const handleStartPipeline = useCallback(async () => {
    setPipelineRunning(true);
    try {
      // Step 1: Discover topics
      setPipelineStep('Discovering trending topics...');
      toast.info('🔍 Discovering trending topics...');
      const { topics } = await discoverTopics.mutateAsync({ count: 3 });

      if (!topics || topics.length === 0) {
        toast.error('No topics found. Try again.');
        setPipelineRunning(false);
        return;
      }

      toast.success(`Found ${topics.length} topics — generating articles...`);

      // Step 2: Generate articles one by one
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

      // Refresh the list
      await articlesQuery.refetch();
      setPipelineStep('');
      toast.success(`Pipeline complete — ${generated} articles ready for review!`);
    } catch (err: any) {
      toast.error('Pipeline error: ' + (err.message || 'Unknown'));
    } finally {
      setPipelineRunning(false);
      setPipelineStep('');
    }
  }, [discoverTopics, generateArticle, articlesQuery]);

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between">
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
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => articlesQuery.refetch()}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleStartPipeline}
              disabled={pipelineRunning}
            >
              {pipelineRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {pipelineStep ? pipelineStep.slice(0, 30) : 'Running...'}
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  Generate Articles
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ─── Pipeline Status Bar ─── */}
        <Card className="border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-5 gap-4">
              <PipelineStat icon={Layers} label="Total Articles" value={stats.total} />
              <PipelineStat icon={Bot} label="In Pipeline" value={stats.inPipeline} color="text-blue-400" />
              <PipelineStat icon={Inbox} label="Ready for Review" value={stats.queued} color="text-green-400" />
              <PipelineStat icon={CheckCircle2} label="Approved" value={stats.approved} color="text-emerald-400" />
              <PipelineStat icon={BarChart3} label="Avg Score" value={`${stats.avgScore}/10`} color="text-yellow-400" />
            </div>

            {/* Pipeline visual with agent headshots */}
            <div className="flex items-center gap-1 mt-4 text-[10px]">
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
                    <div className={`w-7 h-7 rounded-full overflow-hidden ring-1 ${step.active ? 'ring-2 ring-primary animate-pulse' : step.done ? 'ring-green-500/50' : 'ring-border/50'}`}>
                      <img src={step.agent.avatar} alt={step.agent.name} className="w-full h-full object-cover" />
                    </div>
                    <span className={`${step.active ? 'text-primary font-medium' : step.done ? 'text-green-400' : 'text-muted-foreground'}`}>
                      {step.label}{(step as any).count ? ` (${(step as any).count})` : ''}
                    </span>
                  </div>
                  {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ─── Filters ─── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search articles..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="w-40 h-9">
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
            <SelectTrigger className="w-40 h-9">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Highest Score</SelectItem>
              <SelectItem value="date">Most Recent</SelectItem>
              <SelectItem value="publication">Publication</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ─── Article List ─── */}
        <div className="grid gap-3 md:grid-cols-2">
          {filteredItems.length === 0 ? (
            <Card className="border-border md:col-span-2">
              <CardContent className="py-16 text-center">
                <Inbox className="w-12 h-12 mx-auto text-muted-foreground opacity-30 mb-4" />
                <h3 className="text-lg font-semibold">Queue is empty</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Click "Generate Articles" to start the AI pipeline. It will research trending topics,
                  draft publication-grade articles, score them, and queue the best ones here for your review.
                </p>
                <Button className="mt-6 gap-1.5" onClick={handleStartPipeline} disabled={pipelineRunning}>
                  <Zap className="w-4 h-4" />
                  Generate Articles
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredItems.map(item => (
              <QueueCard key={item.id} item={item} onOpenInWriter={handleOpenInWriter} onDelete={handleDelete} onUpdateStatus={handleUpdateStatus} />
            ))
          )}
        </div>
      </div>
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

function PipelineStep({ label, active, done, count }: {
  label: string; active?: boolean; done?: boolean; count?: number;
}) {
  return (
    <div className={`px-2.5 py-1 rounded-full border text-center min-w-[60px] ${
      done ? 'bg-green-500/10 border-green-500/20 text-green-400' :
      active ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse' :
      count ? `bg-primary/10 border-primary/20 text-primary` :
      'bg-muted/30 border-border text-muted-foreground'
    }`}>
      {label}{count ? ` (${count})` : ''}
    </div>
  );
}

function QueueCard({ item, onOpenInWriter, onDelete, onUpdateStatus }: {
  item: QueueItem;
  onOpenInWriter: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdateStatus: (id: number, status: 'draft' | 'review' | 'scored' | 'pitched' | 'published') => void;
}) {
  const config = STATUS_CONFIG[item.status];
  const StatusIcon = config.icon;

  return (
    <Card className="border-border/80 bg-card/70 hover:border-primary/35 transition-colors group h-full">
      <CardContent className="p-4">
        <div className="flex items-start gap-4 h-full">
          {/* Score circle with agent overlay */}
          <div className="relative shrink-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
              item.score ? getScoreBgColor(item.score) : 'bg-muted/30 border-border'
            }`}>
              <span className="text-lg font-bold font-mono">
                {item.score ? item.score : '—'}
              </span>
            </div>
            {/* Agent that drafted this article */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full overflow-hidden ring-2 ring-background" title={`${AGENTS.drafter.name} — ${AGENTS.drafter.role}`}>
              <img src={AGENTS.drafter.avatar} alt="" className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                    <StatusIcon className="w-2.5 h-2.5 mr-1" />
                    {config.label}
                  </Badge>
                  {item.qualityGrade && (
                    <Badge className={`text-[10px] font-mono ${getGradeBgColor(item.qualityGrade as any)}`}>
                      {item.qualityGrade}
                    </Badge>
                  )}
                  {item.targetPublication && (
                    <Badge variant="outline" className="text-[10px]">
                      <BookOpen className="w-2.5 h-2.5 mr-1" />
                      {item.targetPublication}
                    </Badge>
                  )}
                  {item.template && (
                    <span className="text-[10px] text-muted-foreground">{item.template}</span>
                  )}
                </div>
              </div>

              <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed line-clamp-3">
                {item.previewSnippet}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {(item.status === 'queued' || item.status === 'review') && (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs gap-1"
                    onClick={() => onOpenInWriter(item.id)}
                  >
                    <Eye className="w-3 h-3" />
                    Review
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onOpenInWriter(item.id)}>
                      <PenTool className="w-3.5 h-3.5 mr-2" /> Open in Writer
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'review')}>
                      <Eye className="w-3.5 h-3.5 mr-2" /> Mark as Review
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'pitched')}>
                      <Send className="w-3.5 h-3.5 mr-2" /> Send to Pitch
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onUpdateStatus(item.id, 'published')}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Mark Published
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-400" onClick={() => onDelete(item.id)}>
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="w-2.5 h-2.5" /> {item.wordCount.toLocaleString()} words
              </span>
              <span className="flex items-center gap-1">
                <Timer className="w-2.5 h-2.5" /> {item.estimatedReadTime} min read
              </span>
              <span className="flex items-center gap-1">
                <Bot className="w-2.5 h-2.5" /> {item.aiModel}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" /> {formatRelativeTime(item.createdAt)}
              </span>
              {item.tags.length > 0 && (
                <span className="flex items-center gap-1">
                  {item.tags.map(t => <Badge key={t} variant="outline" className="text-[8px] px-1 py-0">{t}</Badge>)}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

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
