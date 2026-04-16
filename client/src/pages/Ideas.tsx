import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Link } from 'wouter';
import {
  Lightbulb, Plus, Search, ArrowRight, PenTool, Trash2,
  Calendar, Tag, Target, Sparkles
} from 'lucide-react';
import { CATEGORIES } from '@/lib/publications-data';

const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  researching: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  drafting: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  scoring: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  pitching: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  published: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export default function Ideas() {
  const { state, addIdea, updateIdea, deleteIdea } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAngle, setNewAngle] = useState('');
  const [newCategory, setNewCategory] = useState('Business');
  const [newNewsPeg, setNewNewsPeg] = useState('');

  const todayCount = state.ideas.filter(i => {
    const d = new Date(i.created_at);
    return d.toDateString() === new Date().toDateString();
  }).length;

  const filtered = useMemo(() => {
    return state.ideas.filter(idea => {
      const matchesSearch = !searchQuery ||
        idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        idea.angle.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || idea.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [state.ideas, searchQuery, filterStatus]);

  const handleCreate = () => {
    if (!newTitle.trim()) { toast.error('Title is required'); return; }
    addIdea({
      title: newTitle.trim(),
      angle: newAngle.trim(),
      category: newCategory,
      news_peg: newNewsPeg.trim(),
      status: 'idea',
    });
    setNewTitle(''); setNewAngle(''); setNewNewsPeg('');
    setShowNewIdea(false);
    toast.success('Idea created successfully');
  };

  const handleAdvance = (id: string, currentStatus: string) => {
    const flow = ['idea', 'researching', 'drafting', 'scoring', 'pitching', 'published'];
    const idx = flow.indexOf(currentStatus);
    if (idx < flow.length - 1) {
      updateIdea(id, { status: flow[idx + 1] as any });
      toast.success(`Advanced to ${flow[idx + 1]}`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-400" />
            Article Ideas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate, score, and pipeline your article ideas
          </p>
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
              <Button onClick={handleCreate} className="w-full">Create Idea</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Daily Target */}
      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Target className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Today's ideas</span>
                <span className="font-mono font-semibold">{todayCount} / {state.settings.daily_target}</span>
              </div>
              <Progress value={(todayCount / state.settings.daily_target) * 100} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search ideas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          {['all', 'idea', 'researching', 'drafting', 'scoring', 'pitching', 'published'].map(status => (
            <Button key={status} variant={filterStatus === status ? 'default' : 'outline'} size="sm"
              onClick={() => setFilterStatus(status)} className="text-xs capitalize">
              {status === 'all' ? `All (${state.ideas.length})` : status}
            </Button>
          ))}
        </div>
      </div>

      {/* Ideas List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="border-border">
            <CardContent className="p-12 text-center">
              <Lightbulb className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <h3 className="font-semibold mb-1">No ideas yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Start by creating an idea or importing from the Intelligence Feed</p>
              <Button onClick={() => setShowNewIdea(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Create First Idea
              </Button>
            </CardContent>
          </Card>
        ) : (
          filtered.map(idea => (
            <Card key={idea.id} className="border-border hover:border-primary/20 transition-colors group">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[idea.status] || ''}`}>
                        {idea.status}
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
                      onClick={() => { deleteIdea(idea.id); toast.success('Idea deleted'); }} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
