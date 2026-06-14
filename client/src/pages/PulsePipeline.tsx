import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Newspaper, Zap, TrendingUp, Target, BookOpen, Building2,
  ArrowRight, ChevronDown, ChevronUp, Sparkles, Clock,
  BarChart3, PieChart, Activity, AlertCircle, CheckCircle2,
  XCircle, Eye, Flame, RefreshCw, Filter, Calendar,
  ArrowUpRight, Brain, Send, Loader2,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type PulseStatus = "new" | "reviewing" | "writing" | "in_pipeline" | "published" | "skipped";
type Urgency = "breaking" | "this_week" | "evergreen";

interface PulseStory {
  id: number;
  headline: string;
  beat: string;
  urgency: Urgency;
  urgencyEmoji?: string;
  whyItMatters?: string;
  angle?: string;
  contentType?: string;
  source?: string;
  sourceDisplay?: string;
  priority?: number;
  status: PulseStatus;
  briefingDate: string;
  briefingRank?: number;
  briefingReason?: string;
  matchedBrands?: { brandName: string; relevanceScore: number; suggestedAngle: string }[];
  matchedPublications?: { publicationName: string; matchScore: number; payRange: string; whyItFits: string }[];
  analysisData?: {
    sentimentScore?: number;
    viralPotential?: number;
    competitiveGap?: number;
    audienceSize?: string;
    trendDirection?: string;
  };
  articleId?: number;
  ideaId?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const URGENCY_CONFIG: Record<Urgency, { label: string; emoji: string; color: string; bg: string }> = {
  breaking: { label: "Breaking", emoji: "🔴", color: "text-red-400", bg: "bg-red-500/15 border-red-500/30" },
  this_week: { label: "This Week", emoji: "🟡", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" },
  evergreen: { label: "Evergreen", emoji: "🔵", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
};

const STATUS_CONFIG: Record<PulseStatus, { label: string; icon: any; color: string }> = {
  new: { label: "New", icon: Sparkles, color: "text-violet-400" },
  reviewing: { label: "Reviewing", icon: Eye, color: "text-amber-400" },
  writing: { label: "Writing", icon: Zap, color: "text-blue-400" },
  in_pipeline: { label: "In Pipeline", icon: ArrowRight, color: "text-emerald-400" },
  published: { label: "Published", icon: CheckCircle2, color: "text-green-400" },
  skipped: { label: "Skipped", icon: XCircle, color: "text-zinc-500" },
};

const BEAT_COLORS: Record<string, string> = {
  "BREAKING": "#ef4444",
  "AI & Enterprise Tech": "#06b6d4",
  "Women's Health & Wellness": "#ec4899",
  "Aviation & Career": "#8b5cf6",
  "Digital Publishing & Content": "#f59e0b",
  "E-commerce & Small Business": "#10b981",
  "General": "#6366f1",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function PulsePipeline() {
  useAuth();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedBeat, setSelectedBeat] = useState<string>("all");
  const [selectedUrgency, setSelectedUrgency] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [expandedStory, setExpandedStory] = useState<number | null>(null);

  // ── Queries ──
  const briefingsQuery = trpc.pulse.briefings.useQuery();
  const briefings = briefingsQuery.data ?? [];

  // Auto-select latest date
  const activeDate = selectedDate ?? (briefings.length > 0 ? briefings[0].date : null);

  const storiesQuery = trpc.pulse.list.useQuery(
    activeDate ? { briefingDate: activeDate, limit: 100 } : undefined,
    { enabled: !!activeDate }
  );
  const stories: PulseStory[] = (storiesQuery.data?.stories ?? []) as PulseStory[];

  const analysisQuery = trpc.pulse.analyze.useQuery(undefined, { enabled: true });
  const analysis = analysisQuery.data;

  // ── Mutations ──
  const updateStatusMut = trpc.pulse.updateStatus.useMutation({
    onSuccess: () => { storiesQuery.refetch(); toast.success("Status updated"); },
  });
  const promoteMut = trpc.pulse.promote.useMutation({
    onSuccess: (data) => {
      storiesQuery.refetch();
      toast.success(`🚀 Story promoted! Article #${data.articleId} created`);
    },
  });
  const enrichMut = trpc.pulse.enrichPublications.useMutation({
    onSuccess: () => { storiesQuery.refetch(); toast.success("Enrichment complete"); },
  });
  const enrichBulkMut = trpc.pulse.enrichBulk.useMutation({
    onSuccess: (data) => { storiesQuery.refetch(); toast.success(`Enriched ${data.enriched} stories`); },
  });

  // ── Filtering ──
  const filtered = useMemo(() => {
    let items = stories;
    if (selectedBeat !== "all") items = items.filter(s => s.beat === selectedBeat);
    if (selectedUrgency !== "all") items = items.filter(s => s.urgency === selectedUrgency);
    if (selectedStatus !== "all") items = items.filter(s => s.status === selectedStatus);
    return items;
  }, [stories, selectedBeat, selectedUrgency, selectedStatus]);

  const beats = useMemo(() => [...new Set(stories.map(s => s.beat))], [stories]);

  // Top picks (ranked stories)
  const topPicks = useMemo(
    () => stories.filter(s => s.briefingRank != null).sort((a, b) => (a.briefingRank ?? 99) - (b.briefingRank ?? 99)),
    [stories]
  );

  // Stats for current briefing
  const stats = useMemo(() => ({
    total: stories.length,
    breaking: stories.filter(s => s.urgency === "breaking").length,
    new: stories.filter(s => s.status === "new").length,
    inPipeline: stories.filter(s => s.status === "in_pipeline").length,
    published: stories.filter(s => s.status === "published").length,
  }), [stories]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-primary" />
            Pulse Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-curated stories → matched audience → publication-ready articles
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date selector */}
          <select
            value={activeDate ?? ""}
            onChange={e => setSelectedDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {briefings.map((b: any) => (
              <option key={b.date} value={b.date}>
                {new Date(b.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {` (${b.count} stories${b.breakingCount > 0 ? `, ${b.breakingCount} 🔴` : ''})`}
              </option>
            ))}
            {briefings.length === 0 && <option value="">No briefings yet</option>}
          </select>
          {activeDate && (
            <Button
              variant="outline" size="sm"
              onClick={() => enrichBulkMut.mutate({ briefingDate: activeDate })}
              disabled={enrichBulkMut.isPending}
            >
              {enrichBulkMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Brain className="w-4 h-4 mr-1" />}
              Enrich All
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => { storiesQuery.refetch(); briefingsQuery.refetch(); analysisQuery.refetch(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Stories" value={stats.total} icon={Newspaper} color="text-primary" />
        <StatCard label="Breaking" value={stats.breaking} icon={Flame} color="text-red-400" />
        <StatCard label="Unreviewed" value={stats.new} icon={Sparkles} color="text-violet-400" />
        <StatCard label="In Pipeline" value={stats.inPipeline} icon={ArrowRight} color="text-emerald-400" />
        <StatCard label="Published" value={stats.published} icon={CheckCircle2} color="text-green-400" />
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="stories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stories">📰 Stories ({filtered.length})</TabsTrigger>
          <TabsTrigger value="top_picks">⭐ Top Picks ({topPicks.length})</TabsTrigger>
          <TabsTrigger value="analytics">📊 Analytics</TabsTrigger>
        </TabsList>

        {/* ── STORIES TAB ── */}
        <TabsContent value="stories" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select value={selectedBeat} onChange={e => setSelectedBeat(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="all">All Beats</option>
              {beats.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={selectedUrgency} onChange={e => setSelectedUrgency(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="all">All Urgency</option>
              <option value="breaking">🔴 Breaking</option>
              <option value="this_week">🟡 This Week</option>
              <option value="evergreen">🔵 Evergreen</option>
            </select>
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="reviewing">Reviewing</option>
              <option value="in_pipeline">In Pipeline</option>
              <option value="published">Published</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>

          {/* Story Cards */}
          {storiesQuery.isLoading ? (
            <Card><CardContent className="p-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-2 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading stories...</p>
            </CardContent></Card>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <Newspaper className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {stories.length === 0 ? "No stories yet. The Article Pulse cron will deliver stories here every morning." : "No stories match your filters."}
              </p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filtered.map(story => (
                <StoryCard
                  key={story.id}
                  story={story}
                  expanded={expandedStory === story.id}
                  onToggle={() => setExpandedStory(expandedStory === story.id ? null : story.id)}
                  onUpdateStatus={(status) => updateStatusMut.mutate({ id: story.id, status })}
                  onPromote={() => promoteMut.mutate({ id: story.id })}
                  onEnrich={() => enrichMut.mutate({ id: story.id })}
                  isEnriching={enrichMut.isPending}
                  isPromoting={promoteMut.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TOP PICKS TAB ── */}
        <TabsContent value="top_picks" className="space-y-4">
          {topPicks.length === 0 ? (
            <Card><CardContent className="p-8 text-center">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-amber-400/50" />
              <p className="text-sm text-muted-foreground">No top picks for this briefing yet.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {topPicks.map(story => (
                <Card key={story.id} className="border-amber-500/20 bg-amber-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 font-bold text-amber-400 text-sm">
                        #{story.briefingRank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <UrgencyBadge urgency={story.urgency} />
                          <BeatBadge beat={story.beat} />
                          <StatusBadge status={story.status} />
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{story.headline}</h3>
                        {story.briefingReason && (
                          <p className="text-xs text-amber-400/80 italic">"{story.briefingReason}"</p>
                        )}
                        {story.angle && (
                          <p className="text-xs text-muted-foreground mt-2">
                            <span className="font-medium text-foreground">Angle:</span> {story.angle}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          {story.status === "new" && (
                            <>
                              <Button size="sm" variant="default" className="h-7 text-xs gap-1"
                                onClick={() => promoteMut.mutate({ id: story.id })}
                                disabled={promoteMut.isPending}>
                                <Zap className="w-3 h-3" /> Write This
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                onClick={() => enrichMut.mutate({ id: story.id })}
                                disabled={enrichMut.isPending}>
                                <Brain className="w-3 h-3" /> Match Audience
                              </Button>
                            </>
                          )}
                          {story.articleId && (
                            <a href={`/writer/${story.articleId}`}>
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                                <ArrowUpRight className="w-3 h-3" /> Open Article
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── ANALYTICS TAB ── */}
        <TabsContent value="analytics" className="space-y-4">
          {!analysis ? (
            <Card><CardContent className="p-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading analytics...</p>
            </CardContent></Card>
          ) : (
            <>
              {/* Overall Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Total Stories (All Time)" value={analysis.totals.total} icon={Newspaper} color="text-primary" />
                <StatCard label="Promoted to Pipeline" value={analysis.totals.promoted ?? 0} icon={ArrowRight} color="text-emerald-400" />
                <StatCard label="Published" value={analysis.totals.published ?? 0} icon={CheckCircle2} color="text-green-400" />
                <StatCard label="Pending Review" value={analysis.totals.pending ?? 0} icon={Clock} color="text-amber-400" />
              </div>

              {/* Beat Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-primary" /> Beat Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(analysis.beatDistribution ?? []).map((b: any) => {
                      const pct = analysis.totals.total > 0 ? Math.round((b.count / analysis.totals.total) * 100) : 0;
                      const color = BEAT_COLORS[b.beat] ?? "#6366f1";
                      return (
                        <div key={b.beat} className="flex items-center gap-3">
                          <span className="text-xs w-40 truncate">{b.beat}</span>
                          <div className="flex-1 h-5 bg-muted/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="text-xs font-mono w-16 text-right">{b.count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Urgency & Status Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400" /> Urgency Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(analysis.urgencyDistribution ?? []).map((u: any) => {
                        const config = URGENCY_CONFIG[u.urgency as Urgency];
                        return (
                          <div key={u.urgency} className="flex items-center justify-between">
                            <span className="text-xs flex items-center gap-1.5">
                              <span>{config?.emoji ?? "⚪"}</span>
                              {config?.label ?? u.urgency}
                            </span>
                            <span className="text-xs font-mono">{u.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" /> Pipeline Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(analysis.statusDistribution ?? []).map((s: any) => {
                        const config = STATUS_CONFIG[s.status as PulseStatus];
                        const Icon = config?.icon ?? Sparkles;
                        return (
                          <div key={s.status} className="flex items-center justify-between">
                            <span className={`text-xs flex items-center gap-1.5 ${config?.color ?? ''}`}>
                              <Icon className="w-3 h-3" />
                              {config?.label ?? s.status}
                            </span>
                            <span className="text-xs font-mono">{s.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Ranked Stories Across All Time */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" /> Top-Ranked Stories (All Briefings)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(analysis.topRanked ?? []).map((story: any) => (
                      <div key={story.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-400 text-[10px] font-bold">
                          #{story.briefingRank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{story.headline}</p>
                          <p className="text-[10px] text-muted-foreground">{story.beat} · {story.briefingDate}</p>
                        </div>
                        <StatusBadge status={story.status} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUB-COMPONENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color} shrink-0`} />
        <div>
          <p className="text-lg font-bold">{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const config = URGENCY_CONFIG[urgency];
  return (
    <Badge variant="outline" className={`text-[10px] ${config.bg} ${config.color}`}>
      {config.emoji} {config.label}
    </Badge>
  );
}

function BeatBadge({ beat }: { beat: string }) {
  const color = BEAT_COLORS[beat] ?? "#6366f1";
  return (
    <Badge variant="outline" className="text-[10px]" style={{ borderColor: color + '44', color }}>
      {beat}
    </Badge>
  );
}

function StatusBadge({ status }: { status: PulseStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-[10px] ${config.color}`}>
      <Icon className="w-2.5 h-2.5 mr-0.5" /> {config.label}
    </Badge>
  );
}

function StoryCard({
  story, expanded, onToggle, onUpdateStatus, onPromote, onEnrich, isEnriching, isPromoting,
}: {
  story: PulseStory;
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (status: PulseStatus) => void;
  onPromote: () => void;
  onEnrich: () => void;
  isEnriching: boolean;
  isPromoting: boolean;
}) {
  return (
    <Card className={`border-border transition-all ${
      story.urgency === "breaking" ? "border-l-2 border-l-red-500" :
      story.briefingRank ? "border-l-2 border-l-amber-500" : ""
    }`}>
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start gap-3 cursor-pointer" onClick={onToggle}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <UrgencyBadge urgency={story.urgency} />
              <BeatBadge beat={story.beat} />
              <StatusBadge status={story.status} />
              {story.briefingRank && (
                <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">
                  ⭐ #{story.briefingRank}
                </Badge>
              )}
              {story.contentType && (
                <span className="text-[10px] text-muted-foreground">{story.contentType}</span>
              )}
            </div>
            <h3 className="font-semibold text-sm leading-snug">{story.headline}</h3>
            {story.sourceDisplay && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Source: {story.sourceDisplay}
              </p>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-1">
            {story.analysisData?.viralPotential != null && (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> {story.analysisData.viralPotential}%
              </span>
            )}
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t border-border pt-3">
            {/* Why It Matters */}
            {story.whyItMatters && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Why It Matters</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{story.whyItMatters}</p>
              </div>
            )}

            {/* Angle */}
            {story.angle && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Suggested Angle</p>
                <p className="text-xs text-foreground/80 leading-relaxed italic">"{story.angle}"</p>
              </div>
            )}

            {/* Matched Brands */}
            {story.matchedBrands && story.matchedBrands.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Matched Brands
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {story.matchedBrands.map((b, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-400">
                      <Building2 className="w-2.5 h-2.5" />
                      {b.brandName}
                      <span className="font-mono opacity-60">{b.relevanceScore}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Matched Publications */}
            {story.matchedPublications && story.matchedPublications.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" /> Matched Publications
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {story.matchedPublications.map((p, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                      title={p.whyItFits}>
                      <Target className="w-2.5 h-2.5" />
                      {p.publicationName}
                      <span className="opacity-60">{p.payRange}</span>
                      <span className="font-mono opacity-50">{p.matchScore}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis Data */}
            {story.analysisData && (
              <div className="flex flex-wrap gap-3">
                {story.analysisData.viralPotential != null && (
                  <MiniStat label="Viral Potential" value={`${story.analysisData.viralPotential}%`} icon={TrendingUp} />
                )}
                {story.analysisData.competitiveGap != null && (
                  <MiniStat label="Competitive Gap" value={`${story.analysisData.competitiveGap}%`} icon={Target} />
                )}
                {story.analysisData.trendDirection && (
                  <MiniStat label="Trend" value={story.analysisData.trendDirection} icon={Activity} />
                )}
                {story.analysisData.audienceSize && (
                  <MiniStat label="Audience" value={story.analysisData.audienceSize} icon={BarChart3} />
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {story.status === "new" && (
                <>
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={onPromote} disabled={isPromoting}>
                    {isPromoting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Write This Article
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onEnrich} disabled={isEnriching}>
                    {isEnriching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                    Match Audience & Pubs
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => onUpdateStatus("reviewing")}>
                    <Eye className="w-3 h-3" /> Mark Reviewing
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground"
                    onClick={() => onUpdateStatus("skipped")}>
                    <XCircle className="w-3 h-3" /> Skip
                  </Button>
                </>
              )}
              {story.status === "reviewing" && (
                <>
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={onPromote} disabled={isPromoting}>
                    <Zap className="w-3 h-3" /> Send to Pipeline
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground"
                    onClick={() => onUpdateStatus("skipped")}>
                    <XCircle className="w-3 h-3" /> Skip
                  </Button>
                </>
              )}
              {story.status === "in_pipeline" && story.articleId && (
                <a href={`/writer/${story.articleId}`}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Open in Writer
                  </Button>
                </a>
              )}
              {story.source && (
                <a href={story.source} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Source
                  </Button>
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <Icon className="w-3 h-3" />
      <span>{label}:</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}
