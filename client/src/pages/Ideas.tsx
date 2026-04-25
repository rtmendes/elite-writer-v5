import { useState, useMemo, useRef, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import {
  Lightbulb, Plus, Search, ArrowRight, PenTool, Trash2,
  Calendar, Tag, Target, Sparkles, LayoutGrid, List, Loader2, GripVertical
} from 'lucide-react';
import { CATEGORIES } from '@/lib/publications-data';

const STATUSES = ['idea', 'researching', 'drafting', 'scoring', 'pitching', 'published'] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  idea: { label: 'Ideas', color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20', icon: '💡' },
  researching: { label: 'Researching', color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20', icon: '🔍' },
  drafting: { label: 'Drafting', color: 'text-violet-400', bgColor: 'bg-violet-500/10 border-violet-500/20', icon: '✍️' },
  scoring: { label: 'Scoring', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10 border-cyan-500/20', icon: '📊' },
  pitching: { label: 'Pitching', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20', icon: '📨' },
  published: { label: 'Published', color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/20', icon: '🏆' },
};

export default function Ideas() {
  const { state, addIdea, updateIdea, deleteIdea } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAngle, setNewAngle] = useState('');
  const [newCategory, setNewCategory] = useState('Business');
  const [newNewsPeg, setNewNewsPeg] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // tRPC mutations
  const ideasMutation = trpc.ai.ideas.useMutation();
  const createIdeaDb = trpc.data.ideas.create.useMutation();
  const updateIdeaDb = trpc.data.ideas.update.useMutation();
  const deleteIdeaDb = trpc.data.ideas.delete.useMutation();
  const [idMap] = useState<Map<string, number>>(() => new Map()); // local id -> db id

  const todayCount = state.ideas.filter(i => {
    const d = new Date(i.created_at);
    return d.toDateString() === new Date().toDateString();
  }).length;

  const filtered = useMemo(() => {
    return state.ideas.filter(idea => {
      const matchesSearch = !searchQuery ||
        idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        idea.angle.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [state.ideas, searchQuery]);

  const groupedByStatus = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    STATUSES.forEach(s => { groups[s] = []; });
    filtered.forEach(idea => {
      if (groups[idea.status]) groups[idea.status].push(idea);
    });
    return groups;
  }, [filtered]);

  const handleCreate = () => {
    if (!newTitle.trim()) { toast.error('Title is required'); return; }
    const idea = addIdea({
      title: newTitle.trim(),
      angle: newAngle.trim(),
      category: newCategory,
      news_peg: newNewsPeg.trim(),
      status: 'idea',
    });
    // Persist to DB
    createIdeaDb.mutate({ title: newTitle.trim(), angle: newAngle.trim(), category: newCategory, newsPeg: newNewsPeg.trim(), status: 'idea' }, {
      onSuccess: (r) => { if (r?.id) idMap.set(idea.id, r.id); }
    });
    setNewTitle(''); setNewAngle(''); setNewNewsPeg('');
    setShowNewIdea(false);
    toast.success('Idea created');
  };

  const handleAiGenerate = async () => {
    try {
      const result = await ideasMutation.mutateAsync({
        topics: [newCategory],
        count: 5,
      });
      if (result.success && result.data?.ideas) {
        result.data.ideas.forEach((idea: any) => {
          addIdea({
            title: idea.title || 'Untitled',
            angle: idea.hook || idea.angle || '',
            category: newCategory,
            news_peg: idea.timeliness || '',
            status: 'idea',
          });
        });
        const tokens = result.usage?.total_tokens || 0;
        toast.success(`${result.data.ideas.length} ideas generated (${tokens} tokens)`);
        setShowNewIdea(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'AI generation failed');
    }
  };

  const handleAdvance = (id: string, currentStatus: string) => {
    const idx = STATUSES.indexOf(currentStatus as any);
    if (idx < STATUSES.length - 1) {
      const nextStatus = STATUSES[idx + 1] as any;
      updateIdea(id, { status: nextStatus });
      const dbId = idMap.get(id);
      if (dbId) updateIdeaDb.mutate({ id: dbId, status: nextStatus });
      toast.success(`Advanced to ${nextStatus}`);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(status);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    if (draggedId) {
      updateIdea(draggedId, { status: newStatus as any });
      const dbId = idMap.get(draggedId);
      if (dbId) updateIdeaDb.mutate({ id: dbId, status: newStatus as any });
      toast.success(`Moved to ${STATUS_CONFIG[newStatus]?.label}`);
    }
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverCol(null);
  };

  return (
    <div className="p-4 max-w-full mx-auto space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-400" />
            Article Ideas Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag ideas across stages — from concept to publication
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-md overflow-hidden">
            <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" className="rounded-none h-8"
              onClick={() => setViewMode('kanban')}>
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" className="rounded-none h-8"
              onClick={() => setViewMode('list')}>
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Dialog open={showNewIdea} onOpenChange={setShowNewIdea}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4" /> New Idea</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Article Idea</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Title / Headline</label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g., Why AI Will Replace 30% of Marketing Jobs by 2026" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Angle / Hook</label>
                  <Input value={newAngle} onChange={e => setNewAngle(e.target.value)} placeholder="e.g., Contrarian take backed by McKinsey data" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Category</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="AI & Technology">AI & Technology</option>
                    <option value="Finance">Finance</option>
                    <option value="Future of Work">Future of Work</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">News Peg (why now?)</label>
                  <Input value={newNewsPeg} onChange={e => setNewNewsPeg(e.target.value)} placeholder="e.g., McKinsey just released new AI workforce report" />
                </div>
                <Button variant="outline" className="w-full gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                  disabled={ideasMutation.isPending}
                  onClick={handleAiGenerate}>
                  {ideasMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {ideasMutation.isPending ? 'Generating 5 Ideas...' : 'AI Generate 5 Ideas'}
                </Button>
                <Button onClick={handleCreate} className="w-full">Create Idea</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Daily Target + Search */}
      <div className="flex items-center gap-4 flex-wrap">
        <Card className="border-border flex-1 min-w-[250px]">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Today's ideas</span>
                  <span className="font-mono font-semibold">{todayCount} / {state.settings.daily_target}</span>
                </div>
                <Progress value={(todayCount / state.settings.daily_target) * 100} className="h-1.5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search ideas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {STATUSES.map(s => (
            <span key={s} className="flex items-center gap-1">
              <span className="text-sm">{STATUS_CONFIG[s].icon}</span>
              <span className="font-mono">{groupedByStatus[s]?.length || 0}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '60vh' }}>
          {STATUSES.map(status => {
            const config = STATUS_CONFIG[status];
            const ideas = groupedByStatus[status] || [];
            const isOver = dragOverCol === status;

            return (
              <div
                key={status}
                className={`flex-shrink-0 w-64 flex flex-col rounded-lg border transition-colors ${
                  isOver ? 'border-primary bg-primary/5' : 'border-border bg-card/50'
                }`}
                onDragOver={e => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, status)}
              >
                {/* Column Header */}
                <div className={`px-3 py-2.5 border-b border-border rounded-t-lg ${config.bgColor}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{config.icon}</span>
                      <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono h-5">{ideas.length}</Badge>
                  </div>
                </div>

                {/* Column Body */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(60vh-60px)]">
                  {ideas.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground/40">
                      <p className="text-xs">Drop ideas here</p>
                    </div>
                  )}
                  {ideas.map(idea => (
                    <div
                      key={idea.id}
                      draggable
                      onDragStart={e => handleDragStart(e, idea.id)}
                      onDragEnd={handleDragEnd}
                      className={`group cursor-grab active:cursor-grabbing rounded-md border border-border bg-background p-2.5 hover:border-primary/30 transition-all ${
                        draggedId === idea.id ? 'opacity-40 scale-95' : ''
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="w-3 h-3 text-muted-foreground/30 mt-0.5 shrink-0 group-hover:text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-medium leading-snug line-clamp-2">{idea.title}</h4>
                          {idea.angle && (
                            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{idea.angle}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              <Tag className="w-2 h-2 mr-0.5" />{idea.category}
                            </Badge>
                            {idea.score && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
                                {idea.score}/10
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Quick actions on hover */}
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {status !== 'published' && (
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5"
                            onClick={() => handleAdvance(idea.id, status)}>
                            <ArrowRight className="w-3 h-3" /> Advance
                          </Button>
                        )}
                        {(status === 'idea' || status === 'researching') && (
                          <Link href="/writer">
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5">
                              <PenTool className="w-3 h-3" /> Write
                            </Button>
                          </Link>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 text-destructive ml-auto"
                          onClick={() => { const dbId = idMap.get(idea.id); if (dbId) deleteIdeaDb.mutate({ id: dbId }); deleteIdea(idea.id); toast.success('Deleted'); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add to column */}
                {status === 'idea' && (
                  <div className="p-2 border-t border-border">
                    <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground gap-1"
                      onClick={() => setShowNewIdea(true)}>
                      <Plus className="w-3 h-3" /> Add idea
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-12 text-center">
                <Lightbulb className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <h3 className="font-semibold mb-1">No ideas yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Start by creating an idea or using AI generation</p>
                <Button onClick={() => setShowNewIdea(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Create First Idea
                </Button>
              </CardContent>
            </Card>
          ) : (
            filtered.map(idea => {
              const config = STATUS_CONFIG[idea.status];
              return (
                <Card key={idea.id} className="border-border hover:border-primary/20 transition-colors group">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${config.bgColor} ${config.color}`}>
                            {config.icon} {config.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            <Tag className="w-2.5 h-2.5 mr-1" />{idea.category}
                          </Badge>
                          {idea.score && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              <Sparkles className="w-2.5 h-2.5 mr-1" />{idea.score}/10
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm mb-1">{idea.title}</h3>
                        {idea.angle && <p className="text-xs text-muted-foreground mb-1">{idea.angle}</p>}
                        {idea.news_peg && (
                          <p className="text-xs text-muted-foreground/70 italic">
                            <Calendar className="w-3 h-3 inline mr-1" />{idea.news_peg}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {idea.status !== 'published' && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"
                            onClick={() => handleAdvance(idea.id, idea.status)} title="Advance stage">
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        )}
                        {(idea.status === 'idea' || idea.status === 'researching') && (
                          <Link href="/writer">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Start writing">
                              <PenTool className="w-4 h-4" />
                            </Button>
                          </Link>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive"
                          onClick={() => { const dbId = idMap.get(idea.id); if (dbId) deleteIdeaDb.mutate({ id: dbId }); deleteIdea(idea.id); toast.success('Idea deleted'); }} title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
