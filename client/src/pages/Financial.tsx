import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, Target, Plus, Calendar,
  BarChart3, PieChart, ArrowUpRight, Trash2
} from 'lucide-react';

const REVENUE_STREAMS = [
  { id: 'freelance', name: 'Freelance Articles', icon: '📝', color: 'text-emerald-400' },
  { id: 'syndication', name: 'Content Syndication', icon: '🔄', color: 'text-blue-400' },
  { id: 'consulting', name: 'Writing Consulting', icon: '💼', color: 'text-violet-400' },
  { id: 'courses', name: 'Courses & Workshops', icon: '🎓', color: 'text-amber-400' },
  { id: 'newsletter', name: 'Newsletter / Substack', icon: '📧', color: 'text-cyan-400' },
  { id: 'ghostwriting', name: 'Ghostwriting', icon: '👻', color: 'text-pink-400' },
  { id: 'book', name: 'Book / eBook', icon: '📚', color: 'text-orange-400' },
  { id: 'speaking', name: 'Speaking Engagements', icon: '🎤', color: 'text-red-400' },
];

export default function Financial() {
  const { state, addEarning, deleteEarning } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('freelance');
  const [publication, setPublication] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const totalEarnings = useMemo(() => state.earnings.reduce((s, e) => s + e.amount, 0), [state.earnings]);
  const monthlyEarnings = useMemo(() => {
    const now = new Date();
    return state.earnings
      .filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, e) => s + e.amount, 0);
  }, [state.earnings]);

  const byStream = useMemo(() => {
    const map: Record<string, number> = {};
    state.earnings.forEach(e => { map[e.source] = (map[e.source] || 0) + e.amount; });
    return REVENUE_STREAMS.map(rs => ({ ...rs, total: map[rs.id] || 0 })).sort((a, b) => b.total - a.total);
  }, [state.earnings]);

  const monthlyGoalPct = state.settings.monthly_revenue_goal > 0
    ? Math.min(100, (monthlyEarnings / state.settings.monthly_revenue_goal) * 100) : 0;

  const handleCreate = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    addEarning({ amount: amt, source, publication: publication.trim(), description: description.trim(), date });
    setAmount(''); setPublication(''); setDescription('');
    setShowNew(false);
    toast.success(`$${amt.toLocaleString()} earning recorded`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            Financial Accelerator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track revenue, set goals, and optimize your writing income
          </p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Record Earning</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Earning</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Amount ($)</label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Revenue Stream</label>
                <select value={source} onChange={e => setSource(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {REVENUE_STREAMS.map(rs => (
                    <option key={rs.id} value={rs.id}>{rs.icon} {rs.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Publication / Client</label>
                <Input value={publication} onChange={e => setPublication(e.target.value)} placeholder="e.g., Harvard Business Review" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., AI workforce article" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Date</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <Button onClick={handleCreate} className="w-full">Record Earning</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Revenue Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Total Earnings</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold font-mono text-emerald-400">${totalEarnings.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{state.earnings.length} transactions</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">This Month</span>
              <Calendar className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold font-mono text-blue-400">${monthlyEarnings.toLocaleString()}</p>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Monthly Goal</span>
                <span>${state.settings.monthly_revenue_goal.toLocaleString()}</span>
              </div>
              <Progress value={monthlyGoalPct} className="h-2" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Avg Per Article</span>
              <TrendingUp className="w-4 h-4 text-violet-400" />
            </div>
            <p className="text-3xl font-bold font-mono text-violet-400">
              ${state.earnings.length > 0 ? Math.round(totalEarnings / state.earnings.length).toLocaleString() : '0'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">per earning</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue by Stream */}
        <div className="lg:col-span-1">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                Revenue by Stream
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {byStream.map(rs => (
                <div key={rs.id} className="flex items-center gap-3">
                  <span className="text-sm w-5">{rs.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="truncate">{rs.name}</span>
                      <span className={`font-mono font-semibold ${rs.color}`}>${rs.total.toLocaleString()}</span>
                    </div>
                    <Progress value={totalEarnings > 0 ? (rs.total / totalEarnings) * 100 : 0} className="h-1" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Earnings History */}
        <div className="lg:col-span-2">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Earnings History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {state.earnings.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                  <p className="text-xs text-muted-foreground">No earnings recorded yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {[...state.earnings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(earning => {
                    const stream = REVENUE_STREAMS.find(rs => rs.id === earning.source);
                    return (
                      <div key={earning.id} className="flex items-center gap-3 p-2.5 rounded-md bg-secondary/30 group">
                        <span className="text-sm">{stream?.icon || '💰'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium truncate">{earning.publication || stream?.name}</span>
                            <Badge variant="outline" className="text-[10px]">{stream?.name}</Badge>
                          </div>
                          {earning.description && <p className="text-[10px] text-muted-foreground truncate">{earning.description}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(earning.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        <span className="text-sm font-mono font-semibold text-emerald-400">${earning.amount.toLocaleString()}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => { deleteEarning(earning.id); toast.success('Deleted'); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Monetization Strategies */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            Monetization Playbook
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { title: 'Tier 1 Publications', desc: 'HBR, Forbes, Bloomberg — $1-3/word. Requires 8+ article score.', target: '$2,000-$5,000/article', color: 'border-emerald-500/30' },
              { title: 'Content Syndication', desc: 'License top articles to multiple outlets. 2-5x revenue per piece.', target: '$500-$2,000/syndication', color: 'border-blue-500/30' },
              { title: 'Thought Leadership', desc: 'Ghostwrite for C-suite executives. Premium rates for data-driven content.', target: '$3,000-$10,000/piece', color: 'border-violet-500/30' },
              { title: 'Newsletter Monetization', desc: 'Build subscriber base from published articles. Sponsorships + paid tiers.', target: '$1,000-$5,000/month', color: 'border-amber-500/30' },
            ].map(strategy => (
              <Card key={strategy.title} className={`border ${strategy.color}`}>
                <CardContent className="p-3">
                  <h4 className="text-xs font-semibold mb-1">{strategy.title}</h4>
                  <p className="text-[10px] text-muted-foreground mb-2">{strategy.desc}</p>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    <ArrowUpRight className="w-2.5 h-2.5 mr-1" />{strategy.target}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
