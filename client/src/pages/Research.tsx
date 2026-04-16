import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search, Plus, Database, Link2, BarChart3, Trash2,
  FileText, ExternalLink, BookOpen, Sparkles, Loader2
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

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
  const [aiTopic, setAiTopic] = useState('');
  const [aiAngle, setAiAngle] = useState('');
  const researchMutation = trpc.ai.research.useMutation();
  const createResearchDb = trpc.data.research.create.useMutation();
  const deleteResearchDb = trpc.data.research.delete.useMutation();
  const [researchIdMap] = useState<Map<string, number>>(() => new Map());

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

  const filtered = state.research.filter(r =>
    !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Search className="w-6 h-6 text-blue-400" />
            Research Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gather data, sources, and evidence for your articles
          </p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New Research Note</Button>
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
              {/* Sources */}
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
              {/* Data Points */}
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
              <Button variant="outline" className="w-full gap-2" disabled={researchMutation.isPending || !title.trim()}
                onClick={async () => {
                  try {
                    const result = await researchMutation.mutateAsync({
                      topic: title + (content ? ': ' + content.slice(0, 200) : ''),
                      depth: 'standard',
                    });
                    if (result.success && result.data) {
                      const d = result.data;
                      const brief = [
                        d.summary || '',
                        d.keyFindings?.length ? '\n\nKey Findings:\n' + d.keyFindings.map((f: string) => `- ${f}`).join('\n') : '',
                        d.dataPoints?.length ? '\n\nData Points:\n' + d.dataPoints.map((dp: any) => `- ${dp.stat} (${dp.source}, ${dp.year})`).join('\n') : '',
                        d.trendAnalysis ? '\n\nTrend Analysis:\n' + d.trendAnalysis : '',
                        d.angles?.length ? '\n\nSuggested Angles:\n' + d.angles.map((a: string) => `- ${a}`).join('\n') : '',
                      ].filter(Boolean).join('');
                      setContent(prev => prev ? prev + '\n\n---\nAI Research Brief:\n' + brief : brief);
                      // Auto-add data points
                      if (d.dataPoints?.length) {
                        setDataPoints(prev => [...prev, ...d.dataPoints.slice(0, 5).map((dp: any) => ({ label: dp.stat?.slice(0, 50) || '', value: dp.stat || '', source: dp.source || '' }))]);
                      }
                      const tokens = result.usage?.total_tokens || 0;
                      toast.success(`Research brief generated (${tokens} tokens)`);
                    }
                  } catch (err: any) {
                    toast.error(err.message || 'AI research failed');
                  }
                }}>
                <Sparkles className="w-4 h-4" /> {researchMutation.isPending ? 'Researching...' : 'AI Research Brief'}
              </Button>
              <Button onClick={handleCreate} className="w-full">Save Research Note</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Research Notes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search research notes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          {filtered.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-12 text-center">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <h3 className="font-semibold mb-1">No research notes yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create research notes with data points and sources to power your articles</p>
                <Button onClick={() => setShowNew(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Create First Note
                </Button>
              </CardContent>
            </Card>
          ) : (
            filtered.map(note => (
              <Card key={note.id} className="border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm">{note.title}</CardTitle>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                      onClick={() => { const dbId = researchIdMap.get(note.id); if (dbId) deleteResearchDb.mutate({ id: dbId }); deleteResearch(note.id); toast.success('Deleted'); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {note.content && <p className="text-xs text-muted-foreground leading-relaxed">{note.content}</p>}
                  {note.data_points.length > 0 && (
                    <div className="space-y-1">
                      {note.data_points.map((dp, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-secondary/50 rounded px-2.5 py-1.5">
                          <BarChart3 className="w-3 h-3 text-primary shrink-0" />
                          <span className="font-medium">{dp.label}:</span>
                          <span className="font-mono">{dp.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {note.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {note.sources.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] gap-1">
                          <Link2 className="w-2.5 h-2.5" />{s.length > 30 ? s.slice(0, 30) + '...' : s}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Authoritative Sources Sidebar */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Authoritative Data Sources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {DATA_SOURCES.map(source => (
                <a key={source.name} href={source.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 transition-colors text-xs group">
                  <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="block truncate font-medium">{source.name}</span>
                    <span className="block text-muted-foreground text-[10px]">{source.category}</span>
                  </div>
                </a>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Research Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total notes</span>
                <span className="font-mono font-semibold">{state.research.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data points collected</span>
                <span className="font-mono font-semibold">{state.research.reduce((sum, r) => sum + r.data_points.length, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sources tracked</span>
                <span className="font-mono font-semibold">{state.research.reduce((sum, r) => sum + r.sources.length, 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
