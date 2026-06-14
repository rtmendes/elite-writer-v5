import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, Target, Plus, Calendar,
  BarChart3, PieChart, ArrowUpRight, Trash2, Building2,
  Megaphone, ShoppingBag, Zap, ArrowRight
} from 'lucide-react';

const CONTENT_STREAMS = [
  { id: 'freelance', name: 'Freelance Articles', icon: '📝', color: 'text-emerald-400' },
  { id: 'syndication', name: 'Content Syndication', icon: '🔄', color: 'text-blue-400' },
  { id: 'consulting', name: 'Writing Consulting', icon: '💼', color: 'text-violet-400' },
  { id: 'ghostwriting', name: 'Ghostwriting', icon: '👻', color: 'text-pink-400' },
  { id: 'newsletter', name: 'Newsletter / Substack', icon: '📧', color: 'text-cyan-400' },
  { id: 'speaking', name: 'Speaking Engagements', icon: '🎤', color: 'text-red-400' },
];

const PRODUCT_STREAMS = [
  { id: 'course', name: 'Online Courses', icon: '🎓', color: 'text-amber-400' },
  { id: 'ebook', name: 'eBooks / Guides', icon: '📚', color: 'text-orange-400' },
  { id: 'membership', name: 'Memberships', icon: '👑', color: 'text-violet-400' },
  { id: 'coaching', name: 'Coaching Programs', icon: '🧠', color: 'text-emerald-400' },
  { id: 'saas', name: 'SaaS / App Revenue', icon: '💻', color: 'text-blue-400' },
  { id: 'supplement', name: 'Physical Products', icon: '📦', color: 'text-rose-400' },
  { id: 'affiliate', name: 'Affiliate Revenue', icon: '🤝', color: 'text-cyan-400' },
];

const ALL_STREAMS = [...CONTENT_STREAMS, ...PRODUCT_STREAMS];

export default function Financial() {
  const { state, addEarning, deleteEarning } = useApp();
  const createEarningDb = trpc.data.earnings.create.useMutation();
  const deleteEarningDb = trpc.data.earnings.delete.useMutation();
  // Pitch → article → payment funnel (ported from elite-writer-app)
  const funnelQuery = trpc.data.articles.funnel.useQuery();
  // Server-side AI spend (7-day, per model) + configured budget
  const aiUsageQuery = trpc.ai.usage.useQuery();
  const [earningIdMap] = useState<Map<string, number>>(() => new Map());
  const [showNew, setShowNew] = useState(false);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('freelance');
  const [earningType, setEarningType] = useState<'content' | 'product'>('content');
  const [publication, setPublication] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [activeView, setActiveView] = useState<'overview' | 'content' | 'product' | 'brands'>('overview');

  const totalEarnings = useMemo(() => state.earnings.reduce((s, e) => s + e.amount, 0), [state.earnings]);
  const contentEarnings = useMemo(() => state.earnings.filter(e => e.type === 'content').reduce((s, e) => s + e.amount, 0), [state.earnings]);
  const productEarnings = useMemo(() => state.earnings.filter(e => e.type === 'product').reduce((s, e) => s + e.amount, 0), [state.earnings]);

  const monthlyEarnings = useMemo(() => {
    const now = new Date();
    return state.earnings
      .filter(e => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, e) => s + e.amount, 0);
  }, [state.earnings]);

  const monthlyContent = useMemo(() => {
    const now = new Date();
    return state.earnings
      .filter(e => e.type === 'content' && (() => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })())
      .reduce((s, e) => s + e.amount, 0);
  }, [state.earnings]);

  const monthlyProduct = useMemo(() => {
    const now = new Date();
    return state.earnings
      .filter(e => e.type === 'product' && (() => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })())
      .reduce((s, e) => s + e.amount, 0);
  }, [state.earnings]);

  const byStream = useMemo(() => {
    const map: Record<string, number> = {};
    state.earnings.forEach(e => { map[e.source] = (map[e.source] || 0) + e.amount; });
    return ALL_STREAMS.map(rs => ({ ...rs, total: map[rs.id] || 0 })).filter(rs => rs.total > 0).sort((a, b) => b.total - a.total);
  }, [state.earnings]);

  const brandRevenue = useMemo(() => {
    return state.brands.map(brand => {
      const brandEarnings = state.earnings.filter(e => e.brand_id === brand.id);
      const content = brandEarnings.filter(e => e.type === 'content').reduce((s, e) => s + e.amount, 0);
      const product = brandEarnings.filter(e => e.type === 'product').reduce((s, e) => s + e.amount, 0);
      return { ...brand, content, product, total: content + product };
    });
  }, [state.brands, state.earnings]);

  const handleCreate = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    const earning = addEarning({
      amount: amt, source, publication: publication.trim(), description: description.trim(),
      date, type: earningType, brand_id: selectedBrandId || undefined,
    });
    createEarningDb.mutate({ type: earningType, source, amount: amt.toString(), description: description.trim() }, {
      onSuccess: (r: any) => { if (r?.id) earningIdMap.set(earning.id, r.id); }
    });
    setAmount(''); setPublication(''); setDescription('');
    setShowNew(false);
    toast.success(`$${amt.toLocaleString()} ${earningType} earning recorded`);
  };

  const contentGoal = state.settings.content_revenue_goal || 100000;
  const productGoal = state.settings.product_revenue_goal || 100000;
  const totalGoal = contentGoal + productGoal;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            Financial Command Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dual revenue engine: $100K/mo content + $100K/mo products = $200K/mo
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
              {/* Type toggle */}
              <div className="flex gap-2">
                <button onClick={() => { setEarningType('content'); setSource('freelance'); }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${earningType === 'content' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-muted text-muted-foreground'}`}>
                  <Megaphone className="w-4 h-4 inline mr-1" /> Content
                </button>
                <button onClick={() => { setEarningType('product'); setSource('course'); }}
                  className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${earningType === 'product' ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' : 'bg-muted text-muted-foreground'}`}>
                  <ShoppingBag className="w-4 h-4 inline mr-1" /> Product
                </button>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Amount ($)</label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Revenue Stream</label>
                <select value={source} onChange={e => setSource(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {(earningType === 'content' ? CONTENT_STREAMS : PRODUCT_STREAMS).map(rs => (
                    <option key={rs.id} value={rs.id}>{rs.icon} {rs.name}</option>
                  ))}
                </select>
              </div>
              {state.brands.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Brand (optional)</label>
                  <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">No brand</option>
                    {state.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
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

      {/* Dual Revenue Goals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Content Revenue</span>
              <Megaphone className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-emerald-400">${monthlyContent.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Goal: ${contentGoal.toLocaleString()}/mo</p>
            <Progress value={Math.min(100, (monthlyContent / contentGoal) * 100)} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Product Revenue</span>
              <ShoppingBag className="w-4 h-4 text-violet-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-violet-400">${monthlyProduct.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Goal: ${productGoal.toLocaleString()}/mo</p>
            <Progress value={Math.min(100, (monthlyProduct / productGoal) * 100)} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Total Monthly</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-amber-400">${monthlyEarnings.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Goal: ${totalGoal.toLocaleString()}/mo</p>
            <Progress value={Math.min(100, (monthlyEarnings / totalGoal) * 100)} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">All-Time Total</span>
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-blue-400">${totalEarnings.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{state.earnings.length} transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
        {(['overview', 'content', 'product', 'brands'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveView(tab)}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all capitalize ${
              activeView === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {tab === 'overview' ? 'All Revenue' : tab === 'content' ? 'Content ($100K)' : tab === 'product' ? 'Products ($100K)' : 'By Brand'}
          </button>
        ))}
      </div>

      {activeView === 'brands' ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Revenue by Brand
          </h3>
          {brandRevenue.map(brand => (
            <Card key={brand.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: brand.color }}>
                    {brand.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{brand.name}</h4>
                    <p className="text-xs text-muted-foreground">{brand.niche}</p>
                  </div>
                  <span className="text-lg font-bold font-mono text-primary">${brand.total.toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Content</span>
                      <span className="font-mono text-emerald-400">${brand.content.toLocaleString()}</span>
                    </div>
                    <Progress value={brand.content_revenue_goal > 0 ? Math.min(100, (brand.content / brand.content_revenue_goal) * 100) : 0} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Goal: ${brand.content_revenue_goal.toLocaleString()}/mo</p>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Products</span>
                      <span className="font-mono text-violet-400">${brand.product.toLocaleString()}</span>
                    </div>
                    <Progress value={brand.product_revenue_goal > 0 ? Math.min(100, (brand.product / brand.product_revenue_goal) * 100) : 0} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Goal: ${brand.product_revenue_goal.toLocaleString()}/mo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {brandRevenue.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No brands configured yet</p>
              <p className="text-xs">Go to Brands to create your first brand</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Revenue by Stream */}
          <div className="lg:col-span-1">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-primary" />
                  {activeView === 'content' ? 'Content Streams' : activeView === 'product' ? 'Product Streams' : 'All Streams'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(activeView === 'overview' ? byStream :
                  activeView === 'content' ? byStream.filter(rs => CONTENT_STREAMS.some(cs => cs.id === rs.id)) :
                  byStream.filter(rs => PRODUCT_STREAMS.some(ps => ps.id === rs.id))
                ).map(rs => (
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
                {byStream.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No earnings recorded yet</p>
                )}
              </CardContent>
            </Card>

            {/* Revenue Math */}
            <Card className="border-border mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Path to $200K/mo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Articles at $2K avg</span>
                  <span className="font-mono">50/mo</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Syndication at $500 avg</span>
                  <span className="font-mono">100/mo</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Product sales at $50 avg</span>
                  <span className="font-mono">2,000/mo</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Traffic needed (2% conv)</span>
                  <span className="font-mono">100K/mo</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold">
                  <span>Monthly target</span>
                  <span className="text-primary font-mono">$200,000</span>
                </div>
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
                    <p className="text-[10px] text-muted-foreground mt-1">Click "Record Earning" to start tracking revenue</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {[...state.earnings]
                      .filter(e => activeView === 'overview' || e.type === activeView)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(earning => {
                        const stream = ALL_STREAMS.find(rs => rs.id === earning.source);
                        const brand = state.brands.find(b => b.id === earning.brand_id);
                        return (
                          <div key={earning.id} className="flex items-center gap-3 p-2.5 rounded-md bg-secondary/30 group">
                            <span className="text-sm">{stream?.icon || '💰'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium truncate">{earning.publication || stream?.name}</span>
                                <Badge variant="outline" className={`text-[10px] ${earning.type === 'product' ? 'border-violet-500/30 text-violet-400' : 'border-emerald-500/30 text-emerald-400'}`}>
                                  {earning.type}
                                </Badge>
                                {brand && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: brand.color + '20', color: brand.color }}>
                                    {brand.name}
                                  </span>
                                )}
                              </div>
                              {earning.description && <p className="text-[10px] text-muted-foreground truncate">{earning.description}</p>}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {new Date(earning.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className={`text-sm font-mono font-semibold shrink-0 ${earning.type === 'product' ? 'text-violet-400' : 'text-emerald-400'}`}>
                              ${earning.amount.toLocaleString()}
                            </span>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                              onClick={() => { const dbId = earningIdMap.get(earning.id); if (dbId) deleteEarningDb.mutate({ id: dbId }); deleteEarning(earning.id); toast.success('Deleted'); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monetization Strategies */}
            <Card className="border-border mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Dual Revenue Playbook
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { title: 'Tier 1 Publications', desc: 'HBR, Forbes, Bloomberg — $1-3/word. Requires 8+ article score.', target: '$2K-$5K/article', color: 'border-emerald-500/30', type: 'Content' },
                    { title: 'Content Syndication', desc: 'License top articles to multiple outlets. 2-5x revenue per piece.', target: '$500-$2K/syndication', color: 'border-blue-500/30', type: 'Content' },
                    { title: 'Digital Products', desc: 'Courses, eBooks, templates aligned with your brand audience.', target: '$10K-$50K/mo', color: 'border-violet-500/30', type: 'Product' },
                    { title: 'SaaS / Membership', desc: 'Recurring revenue from brand-aligned apps and communities.', target: '$5K-$25K/mo', color: 'border-amber-500/30', type: 'Product' },
                  ].map(strategy => (
                    <Card key={strategy.title} className={`border ${strategy.color}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-xs font-semibold">{strategy.title}</h4>
                          <Badge variant="outline" className="text-[10px]">{strategy.type}</Badge>
                        </div>
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
        </div>
      )}

      {/* AI spend & budget — server-side ledger from invokeLLM metering */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">AI spend (7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {!aiUsageQuery.data?.days?.length ? (
            <p className="text-xs text-muted-foreground">No AI usage recorded yet — the ledger fills as agents run.</p>
          ) : (
            <div className="space-y-3">
              {(() => {
                const days = aiUsageQuery.data.days;
                const today = days[days.length - 1];
                const cap = (aiUsageQuery.data as { budgetUsd?: number | null }).budgetUsd;
                const todayUsd = Number(today?.usd ?? 0);
                const pct = cap ? Math.min(100, (todayUsd / cap) * 100) : 0;
                return (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Today: <span className="font-mono">${todayUsd.toFixed(2)}</span></span>
                      <span className="text-muted-foreground">
                        {cap ? `cap $${cap.toFixed(2)} (downgrades at 80%)` : 'no cap set (AI_DAILY_BUDGET_USD) — metering only'}
                      </span>
                    </div>
                    {cap ? <Progress value={pct} className="h-2" /> : null}
                  </div>
                );
              })()}
              <div className="grid md:grid-cols-2 gap-3">
                <table className="w-full text-xs">
                  <thead><tr className="text-muted-foreground text-left">
                    <th className="py-1 font-medium">Day</th><th className="py-1 text-right font-medium">Calls</th><th className="py-1 text-right font-medium">Spend</th>
                  </tr></thead>
                  <tbody>
                    {aiUsageQuery.data.days.map(d => (
                      <tr key={d.day} className="border-t border-border/40">
                        <td className="py-1 font-mono">{d.day}</td>
                        <td className="py-1 text-right">{d.calls}</td>
                        <td className="py-1 text-right font-mono">${Number(d.usd).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="w-full text-xs">
                  <thead><tr className="text-muted-foreground text-left">
                    <th className="py-1 font-medium">Model</th><th className="py-1 text-right font-medium">Calls</th><th className="py-1 text-right font-medium">Spend</th>
                  </tr></thead>
                  <tbody>
                    {(aiUsageQuery.data.models ?? []).map(m => (
                      <tr key={m.model} className="border-t border-border/40">
                        <td className="py-1 max-w-[160px] truncate">{m.model}</td>
                        <td className="py-1 text-right">{m.calls}</td>
                        <td className="py-1 text-right font-mono">${Number(m.usd).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pitch → article → payment funnel: the money loop in one table */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm">Pitch → Article → Payment funnel</CardTitle>
        </CardHeader>
        <CardContent>
          {!funnelQuery.data?.length ? (
            <p className="text-xs text-muted-foreground">No pitches yet — the funnel fills as pitches go out.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="py-1.5 pr-3 font-medium">Pitch</th>
                    <th className="py-1.5 pr-3 font-medium">Publication</th>
                    <th className="py-1.5 pr-3 font-medium">Pitch status</th>
                    <th className="py-1.5 pr-3 font-medium">Article</th>
                    <th className="py-1.5 pr-3 font-medium">Score</th>
                    <th className="py-1.5 text-right font-medium">Paid (pub total)</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelQuery.data.map((row) => (
                    <tr key={row.pitchId} className="border-t border-border/40">
                      <td className="py-1.5 pr-3 max-w-[220px] truncate">{row.subject}</td>
                      <td className="py-1.5 pr-3">{row.publicationName ?? '—'}</td>
                      <td className="py-1.5 pr-3">
                        <Badge variant="outline" className="text-[10px]">{row.pitchStatus}</Badge>
                      </td>
                      <td className="py-1.5 pr-3">{row.articleStatus ?? '—'}</td>
                      <td className="py-1.5 pr-3">{row.articleScore ?? '—'}</td>
                      <td className="py-1.5 text-right font-mono">
                        {row.earningsFromPublication ? `$${row.earningsFromPublication.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
