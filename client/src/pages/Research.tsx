import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Plus, Database, Link2, BarChart3, Trash2, Copy,
  FileText, ExternalLink, BookOpen, Sparkles, Loader2,
  ArrowRight, Clock, AlertTriangle, TrendingUp, Zap, Globe, Image as ImageIcon
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

// ── Render structured research content (detects JSON and formats for humans) ──
function ResearchNoteContent({ content }: { content: string }) {
  // Try to parse as JSON — if it's a structured brief, render nicely
  try {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const data = JSON.parse(trimmed);
      return (
        <div className="space-y-1.5 text-[11px]">
          {/* Recommended angle / headline */}
          {data.recommended_angle && (
            <div>
              <span className="text-primary font-medium">
                {typeof data.recommended_angle === 'object'
                  ? data.recommended_angle.headline || data.recommended_angle.angle || ''
                  : data.recommended_angle}
              </span>
              {typeof data.recommended_angle === 'object' && data.recommended_angle.angle &&
                data.recommended_angle.angle !== data.recommended_angle.headline && (
                <p className="text-muted-foreground mt-0.5">{data.recommended_angle.angle}</p>
              )}
              {typeof data.recommended_angle === 'object' && data.recommended_angle.why_now && (
                <p className="text-muted-foreground/70 mt-0.5 italic">{data.recommended_angle.why_now}</p>
              )}
            </div>
          )}
          {/* Suggested headline */}
          {data.suggested_headline && !data.recommended_angle && (
            <p className="text-primary font-medium">{data.suggested_headline}</p>
          )}
          {/* Summary / story angle */}
          {data.summary && <p className="text-muted-foreground">{data.summary}</p>}
          {data.story_angle && <p className="text-muted-foreground">{data.story_angle}</p>}
          {/* News peg / urgency */}
          {data.news_peg && (
            <p className="text-amber-400/80 text-[10px]">⏰ {data.news_peg}</p>
          )}
          {data.urgency && typeof data.urgency === 'string' && (
            <p className="text-muted-foreground/70 text-[10px]">{data.urgency}</p>
          )}
          {/* Editor pitch */}
          {data.editor_pitch && (
            <p className="text-muted-foreground/80 italic">"{data.editor_pitch}"</p>
          )}
          {/* Key trends / tags */}
          {Array.isArray(data.key_trends) && data.key_trends.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.key_trends.map((t: string, i: number) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px]">{t}</span>
              ))}
            </div>
          )}
          {/* Hook suggestions */}
          {Array.isArray(data.hook_suggestions) && data.hook_suggestions.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Hooks</span>
              {data.hook_suggestions.map((h: string, i: number) => (
                <p key={i} className="text-muted-foreground/80 pl-2 border-l border-primary/20">• {h}</p>
              ))}
            </div>
          )}
          {/* Data points (from intelligence) */}
          {Array.isArray(data.data_points) && data.data_points.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Key Data</span>
              {data.data_points.slice(0, 4).map((dp: any, i: number) => (
                <p key={i} className="text-muted-foreground/80 pl-2 border-l border-blue-500/20">
                  📊 {typeof dp === 'string' ? dp : dp.stat || dp.value || JSON.stringify(dp)}
                </p>
              ))}
            </div>
          )}
          {/* Expert sources */}
          {Array.isArray(data.expert_sources) && data.expert_sources.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Sources</span>
              {data.expert_sources.slice(0, 3).map((e: any, i: number) => (
                <p key={i} className="text-muted-foreground/80 pl-2 border-l border-green-500/20">
                  👤 {typeof e === 'string' ? e : `${e.name || ''} — ${e.why_them || e.title || ''}`}
                </p>
              ))}
            </div>
          )}
          {/* Counterintuitive angles */}
          {Array.isArray(data.counterintuitive_angles) && data.counterintuitive_angles.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Counter angles</span>
              {data.counterintuitive_angles.slice(0, 2).map((a: string, i: number) => (
                <p key={i} className="text-muted-foreground/80 pl-2 border-l border-amber-500/20">⚡ {a}</p>
              ))}
            </div>
          )}
          {/* Sources list */}
          {Array.isArray(data.sources) && data.sources.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {data.sources.map((s: any, i: number) => {
                const title = typeof s === 'string' ? s : s.title || s.name || s.url || '';
                const url = typeof s === 'string' ? (s.startsWith('http') ? s : '') : s.url || '';
                return url ? (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300 truncate max-w-[250px]">
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    {title.length > 50 ? title.slice(0, 50) + '…' : title}
                  </a>
                ) : (
                  <span key={i} className="text-[10px] text-muted-foreground">{title}</span>
                );
              })}
            </div>
          )}
          {/* Competitive angle */}
          {data.competitive_angle && (
            <p className="text-muted-foreground/60 text-[10px]">🏁 {data.competitive_angle}</p>
          )}
        </div>
      );
    }
  } catch {
    // Not JSON — fall through to plain text
  }

  // Default: plain text rendering
  return (
    <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-4">
      {content}
    </p>
  );
}

const DATA_SOURCES = [
  { name: 'FRED (Federal Reserve)', url: 'https://fred.stlouisfed.org/', category: 'Economics' },
  { name: 'World Bank Open Data', url: 'https://data.worldbank.org/', category: 'Global' },
  { name: 'Bureau of Labor Statistics', url: 'https://www.bls.gov/', category: 'Employment' },
  { name: 'Pew Research Center', url: 'https://www.pewresearch.org/', category: 'Social' },
  { name: 'IMF Data', url: 'https://www.imf.org/en/Data', category: 'Finance' },
  { name: 'OECD Data', url: 'https://data.oecd.org/', category: 'Policy' },
  { name: 'US Census Bureau', url: 'https://www.census.gov/', category: 'Demographics' },
  { name: 'Statista', url: 'https://www.statista.com/', category: 'Market Research' },
  { name: 'McKinsey Global Institute', url: 'https://www.mckinsey.com/mgi/', category: 'Strategy' },
  { name: 'PitchBook', url: 'https://pitchbook.com/', category: 'Venture Capital' },
];

export default function Research() {
  const { state, addResearch, deleteResearch } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const [dpLabel, setDpLabel] = useState('');
  const [dpValue, setDpValue] = useState('');
  const [dpSource, setDpSource] = useState('');
  const [dataPoints, setDataPoints] = useState<{ label: string; value: string; source: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickTopic, setQuickTopic] = useState('');
  const researchMutation = trpc.ai.research.useMutation();
  const createResearchDb = trpc.data.research.create.useMutation();
  const deleteResearchDb = trpc.data.research.delete.useMutation();
  const [researchIdMap] = useState<Map<string, number>>(() => new Map());
  const [aiResult, setAiResult] = useState<any>(null);
  const [braveQuery, setBraveQuery] = useState('');
  const [braveFreshness, setBraveFreshness] = useState<string>('week');
  const [braveResults, setBraveResults] = useState<any[]>([]);
  const [braveNews, setBraveNews] = useState<any[]>([]);
  const braveSearchMutation = trpc.research.braveSearch.useMutation();

  const addSource = () => {
    if (sourceUrl.trim()) {
      setSources([...sources, sourceUrl.trim()]);
      setSourceUrl('');
    }
  };

  const addDataPoint = () => {
    if (dpLabel.trim() && dpValue.trim()) {
      setDataPoints([...dataPoints, { label: dpLabel.trim(), value: dpValue.trim(), source: dpSource.trim() }]);
      setDpLabel(''); setDpValue(''); setDpSource('');
    }
  };

  const handleCreate = () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    const note = addResearch({ title: title.trim(), content: content.trim(), sources, data_points: dataPoints });
    createResearchDb.mutate({ title: title.trim(), content: content.trim(), sources: JSON.stringify(sources), dataPoints: JSON.stringify(dataPoints) }, {
      onSuccess: (r) => { if (r?.id) researchIdMap.set(note.id, r.id); }
    });
    setTitle(''); setContent(''); setSources([]); setDataPoints([]);
    setShowNew(false);
    toast.success('Research note saved');
  };

  const handleQuickResearch = async () => {
    if (!quickTopic.trim()) { toast.error('Enter a topic'); return; }
    try {
      const result = await researchMutation.mutateAsync({
        topic: quickTopic.trim(),
        depth: 'standard',
      });
      if (result.success && result.data) {
        setAiResult(result.data);
        const d = result.data;
        // Auto-create a research note
        const noteContent = [
          d.summary || '',
          d.keyFindings?.length ? '\nKey Findings:\n' + d.keyFindings.map((f: string) => `• ${f}`).join('\n') : '',
          d.trendAnalysis ? '\nTrend Analysis:\n' + d.trendAnalysis : '',
          d.angles?.length ? '\nSuggested Angles:\n' + d.angles.map((a: string) => `• ${a}`).join('\n') : '',
        ].filter(Boolean).join('\n');
        const autoDP = d.dataPoints?.slice(0, 5).map((dp: any) => ({
          label: dp.stat?.slice(0, 50) || 'Data',
          value: dp.stat || '',
          source: dp.source || '',
        })) || [];
        const autoSources = d.sources?.map((s: any) => typeof s === 'string' ? s : s.url || s.title || '') || [];
        const note = addResearch({
          title: `AI Brief: ${quickTopic.trim()}`,
          content: noteContent,
          sources: autoSources,
          data_points: autoDP,
        });
        createResearchDb.mutate({
          title: `AI Brief: ${quickTopic.trim()}`,
          content: noteContent,
          sources: JSON.stringify(autoSources),
          dataPoints: JSON.stringify(autoDP),
        }, { onSuccess: (r) => { if (r?.id) researchIdMap.set(note.id, r.id); } });
        toast.success(`Research brief generated — ${result.usage?.total_tokens || 0} tokens`);
      }
    } catch (err: any) {
      toast.error(err.message || 'AI research failed');
    }
  };

  const handleBraveSearch = async () => {
    if (!braveQuery.trim()) { toast.error('Enter a search query'); return; }
    try {
      const result = await braveSearchMutation.mutateAsync({
        query: braveQuery.trim(),
        count: 10,
        freshness: braveFreshness as any,
      });
      if (result.success) {
        setBraveResults(result.results || []);
        setBraveNews(result.news || []);
        toast.success(`Found ${result.totalResults} results`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Brave Search failed');
    }
  };

  const saveBraveResultAsNote = (item: any) => {
    const note = addResearch({
      title: item.title,
      content: item.description,
      sources: [item.url],
      data_points: [],
    });
    createResearchDb.mutate({
      title: item.title,
      content: item.description,
      sources: JSON.stringify([item.url]),
      dataPoints: JSON.stringify([]),
    }, { onSuccess: (r) => { if (r?.id) researchIdMap.set(note.id, r.id); } });
    toast.success('Saved to research notes');
  };

  const filtered = state.research.filter(r =>
    !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalDP = state.research.reduce((sum, r) => sum + r.data_points.length, 0);
  const totalSources = state.research.reduce((sum, r) => sum + r.sources.length, 0);

  // Ideas that could use research
  const unresearcedIdeas = state.ideas
    .filter(i => i.status === 'idea' || i.status === 'researching')
    .slice(0, 5);

  return (
    <div className="p-3 space-y-2.5 max-w-[1400px] mx-auto">
      {/* Header — compact */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-400" />
          <h1 className="text-sm font-semibold">Research Hub</h1>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{state.research.length} notes</span>
            <span>·</span>
            <span>{totalDP} data points</span>
            <span>·</span>
            <span>{totalSources} sources</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                <Plus className="w-3 h-3" /> Manual Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Research Note</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Title</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., AI Workforce Impact Data 2026" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Notes & Findings</label>
                  <textarea value={content} onChange={e => setContent(e.target.value)}
                    placeholder="Key findings, quotes, analysis..."
                    className="w-full h-32 rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Sources</label>
                  <div className="flex gap-2 mb-2">
                    <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="URL or citation" className="flex-1" />
                    <Button variant="outline" size="sm" onClick={addSource}><Plus className="w-4 h-4" /></Button>
                  </div>
                  {sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {sources.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs gap-1">
                          <Link2 className="w-3 h-3" />{s.length > 40 ? s.slice(0, 40) + '...' : s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Data Points</label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <Input value={dpLabel} onChange={e => setDpLabel(e.target.value)} placeholder="Label" />
                    <Input value={dpValue} onChange={e => setDpValue(e.target.value)} placeholder="Value" />
                    <div className="flex gap-1">
                      <Input value={dpSource} onChange={e => setDpSource(e.target.value)} placeholder="Source" className="flex-1" />
                      <Button variant="outline" size="sm" onClick={addDataPoint}><Plus className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  {dataPoints.length > 0 && (
                    <div className="space-y-1">
                      {dataPoints.map((dp, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-secondary/50 rounded-md px-3 py-1.5">
                          <BarChart3 className="w-3 h-3 text-primary shrink-0" />
                          <span className="font-medium">{dp.label}:</span>
                          <span className="font-mono">{dp.value}</span>
                          {dp.source && <span className="text-muted-foreground ml-auto">({dp.source})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={handleCreate} className="w-full">Save Research Note</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Research Tabs — AI Brief + Brave Web Search */}
      <Tabs defaultValue="ai" className="space-y-2">
        <TabsList className="h-8">
          <TabsTrigger value="ai" className="text-[11px] gap-1"><Sparkles className="w-3 h-3" /> AI Research</TabsTrigger>
          <TabsTrigger value="brave" className="text-[11px] gap-1"><Globe className="w-3 h-3" /> Web Search</TabsTrigger>
        </TabsList>

        {/* AI Research Tab */}
        <TabsContent value="ai" className="mt-0">
          <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <Input
                placeholder="Research any topic — AI generates a brief with sources, data points, and angles..."
                value={quickTopic}
                onChange={e => setQuickTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !researchMutation.isPending && handleQuickResearch()}
                className="flex-1 h-8 text-sm border-0 bg-transparent focus-visible:ring-0 px-0"
              />
              <Button size="sm" className="h-7 text-xs gap-1" disabled={researchMutation.isPending || !quickTopic.trim()} onClick={handleQuickResearch}>
                {researchMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                {researchMutation.isPending ? 'Researching...' : 'Research'}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Brave Web Search Tab */}
        <TabsContent value="brave" className="mt-0 space-y-2">
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.03] p-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-orange-400 shrink-0" />
              <Input
                placeholder="Search the web — real-time results via Brave Search API..."
                value={braveQuery}
                onChange={e => setBraveQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !braveSearchMutation.isPending && handleBraveSearch()}
                className="flex-1 h-8 text-sm border-0 bg-transparent focus-visible:ring-0 px-0"
              />
              <select
                value={braveFreshness}
                onChange={e => setBraveFreshness(e.target.value)}
                className="h-7 text-[10px] px-1.5 rounded bg-background border border-border text-foreground"
              >
                <option value="day">Past Day</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="year">Past Year</option>
                <option value="all">All Time</option>
              </select>
              <Button size="sm" className="h-7 text-xs gap-1 bg-orange-600 hover:bg-orange-700" disabled={braveSearchMutation.isPending || !braveQuery.trim()} onClick={handleBraveSearch}>
                {braveSearchMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                Search
              </Button>
            </div>
          </div>

          {/* Brave News Results */}
          {braveNews.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-orange-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Top News
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {braveNews.map((item, i) => (
                  <div key={i} className="flex gap-2 p-2 rounded-lg border border-border/50 bg-card/30 hover:border-orange-500/20 transition-colors group">
                    {item.thumbnail && (
                      <img src={item.thumbnail} alt="" className="w-16 h-12 rounded object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium hover:text-orange-400 line-clamp-2 leading-tight">{item.title}</a>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-muted-foreground">
                        <span>{item.source}</span>
                        {item.age && <><span>·</span><span>{item.age}</span></>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => saveBraveResultAsNote(item)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brave Web Results */}
          {braveResults.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Globe className="w-3 h-3" /> Web Results
              </p>
              <div className="space-y-1">
                {braveResults.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg border border-border/50 bg-card/30 hover:border-orange-500/20 transition-colors group">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-secondary/50 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium hover:text-orange-400 line-clamp-1">{item.title}</a>
                      <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{item.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-muted-foreground">
                        <span className="text-orange-400/60">{item.siteName}</span>
                        {item.age && <><span>·</span><span>{item.age}</span></>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0" title="Save as research note" onClick={() => saveBraveResultAsNote(item)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="grid lg:grid-cols-4 gap-2.5">
        {/* Main content — research notes */}
        <div className="lg:col-span-3 space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search notes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>

          {/* Ideas that need research */}
          {unresearcedIdeas.length > 0 && filtered.length === 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Ideas needing research
              </p>
              <div className="space-y-1">
                {unresearcedIdeas.map(idea => (
                  <div key={idea.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-secondary/30">
                    <span className="truncate flex-1 text-muted-foreground">{idea.title}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-primary" onClick={() => {
                      setQuickTopic(idea.title + (idea.angle ? ': ' + idea.angle : ''));
                    }}>
                      <Search className="w-3 h-3" /> Research
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes list */}
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border/50 bg-card/30 p-8 text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm font-medium mb-1">No research notes yet</p>
              <p className="text-xs text-muted-foreground mb-3">Use the AI research bar above to generate your first brief</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map(note => (
                <div key={note.id} className="rounded-lg border border-border/50 bg-card/30 p-3 group hover:border-primary/20 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3 className="text-sm font-medium leading-tight">{note.title}</h3>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                        navigator.clipboard.writeText(note.content);
                        toast.success('Copied to clipboard');
                      }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => {
                        const dbId = researchIdMap.get(note.id);
                        if (dbId) deleteResearchDb.mutate({ id: dbId });
                        deleteResearch(note.id);
                        toast.success('Deleted');
                      }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  {note.content && (
                    <div className="mb-2">
                      <ResearchNoteContent content={note.content} />
                    </div>
                  )}
                  {note.data_points.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {note.data_points.slice(0, 3).map((dp, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/5 border border-primary/10 text-primary">
                          <BarChart3 className="w-2.5 h-2.5" /> {dp.label}: {dp.value.slice(0, 40)}
                        </span>
                      ))}
                      {note.data_points.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{note.data_points.length - 3} more</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {note.sources.length > 0 && (
                      <>
                        <span>·</span>
                        <span>{note.sources.length} sources</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar — data sources */}
        <div className="space-y-2">
          <div className="rounded-lg border border-border/50 bg-card/30 p-2.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Database className="w-3 h-3" /> Data Sources
            </p>
            <div className="space-y-0.5">
              {DATA_SOURCES.map(source => (
                <a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-secondary/50 transition-colors text-xs group">
                  <ExternalLink className="w-2.5 h-2.5 text-muted-foreground group-hover:text-primary shrink-0" />
                  <span className="truncate">{source.name}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto shrink-0">{source.category}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
