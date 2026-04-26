import { useApp } from '@/contexts/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import {
  Lightbulb, PenTool, Send, DollarSign, TrendingUp,
  ArrowRight, CheckCircle2, Clock, FileText, Target, Zap,
  BarChart3, BookOpen, Globe, Sparkles, Building2, ShoppingBag, Megaphone,
  Newspaper, Search
} from 'lucide-react';
import { AGENTS } from '@/lib/agents';

export default function Dashboard() {
  const { state } = useApp();
  const { ideas, articles, pitches, settings, earnings, brands } = state;

  const todayIdeas = ideas.filter(i => {
    const d = new Date(i.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const activeDrafts = articles.filter(a => a.status === 'draft' || a.status === 'editing').length;
  const pitchesSent = pitches.filter(p => p.status === 'sent' || p.status === 'accepted').length;
  const accepted = pitches.filter(p => p.status === 'accepted');
  const totalRevenue = earnings.reduce((sum, e) => sum + e.amount, 0) || accepted.reduce((sum, p) => sum + (p.payment ?? 0), 0);
  const contentRevenue = earnings.filter(e => e.type === 'content').reduce((s, e) => s + e.amount, 0);
  const productRevenue = earnings.filter(e => e.type === 'product').reduce((s, e) => s + e.amount, 0);
  const acceptanceRate = pitches.length > 0 ? Math.round((accepted.length / pitches.length) * 100) : 0;
  const contentGoal = settings.content_revenue_goal || 100000;
  const productGoal = settings.product_revenue_goal || 100000;

  const recentActivity = [
    ...ideas.slice(0, 3).map(i => ({ type: 'idea' as const, title: i.title, time: i.created_at, status: i.status })),
    ...articles.slice(0, 3).map(a => ({ type: 'article' as const, title: a.title, time: a.updated_at, status: a.status })),
    ...pitches.slice(0, 3).map(p => ({ type: 'pitch' as const, title: `${p.publication_name}: ${p.subject}`, time: p.created_at, status: p.status })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6);

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="p-3 space-y-2.5 max-w-[1400px] mx-auto">
      {/* Compact header — date + daily target inline */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground">{dateStr}</h1>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">176 publications</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{todayIdeas}/{settings.daily_target} ideas today</span>
          <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (todayIdeas / settings.daily_target) * 100)}%` }} />
          </div>
          <Link href="/ideas">
            <Button size="sm" variant="default" className="h-7 text-xs gap-1">
              <Zap className="w-3 h-3" /> New Idea
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats row — no cards, just inline metrics */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Ideas', value: ideas.length, icon: Lightbulb, color: 'text-amber-400', href: '/ideas' },
          { label: 'Drafts', value: activeDrafts, icon: FileText, color: 'text-blue-400', href: '/writer' },
          { label: 'Acceptance', value: `${acceptanceRate}%`, icon: TrendingUp, color: 'text-emerald-400', href: '/pitches' },
          { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-violet-400', href: '/financial' },
        ].map(stat => (
          <Link key={stat.label} href={stat.href}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/50 border border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
              <stat.icon className={`w-3.5 h-3.5 ${stat.color} shrink-0`} />
              <span className="text-lg font-bold font-mono leading-none">{stat.value}</span>
              <span className="text-[10px] text-muted-foreground">{stat.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Workflow — minimal horizontal nav */}
      <div className="flex items-center gap-1 py-1">
        {[
          { label: 'Intelligence', icon: Globe, href: '/giststack', color: 'text-cyan-400' },
          { label: 'Ideate', icon: Lightbulb, href: '/ideas', color: 'text-amber-400' },
          { label: 'Research', icon: Search, href: '/research', color: 'text-orange-400' },
          { label: 'Write', icon: PenTool, href: '/writer', color: 'text-blue-400' },
          { label: 'Match', icon: Target, href: '/publications', color: 'text-rose-400' },
          { label: 'Pitch', icon: Send, href: '/pitches', color: 'text-violet-400' },
          { label: 'Earn', icon: DollarSign, href: '/financial', color: 'text-emerald-400' },
        ].map((ws, i, arr) => (
          <div key={ws.label} className="flex items-center">
            <Link href={ws.href}>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-secondary/60 transition-colors cursor-pointer group">
                <ws.icon className={`w-3.5 h-3.5 ${ws.color}`} />
                <span className="text-xs font-medium group-hover:text-foreground text-muted-foreground">{ws.label}</span>
              </div>
            </Link>
            {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/30 mx-0.5" />}
          </div>
        ))}
      </div>

      {/* Pipeline + Revenue + Activity — 3 columns, no headers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        {/* Pipeline counters */}
        <div className="rounded-lg border border-border/50 bg-card/30 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Pipeline</p>
          <div className="flex items-center justify-between gap-1">
            {[
              { label: 'Ideas', count: ideas.length, color: 'text-amber-400', href: '/ideas' },
              { label: 'Drafts', count: activeDrafts, color: 'text-blue-400', href: '/writer' },
              { label: 'Pitched', count: pitchesSent, color: 'text-violet-400', href: '/pitches' },
              { label: 'Won', count: accepted.length, color: 'text-emerald-400', href: '/financial' },
            ].map((s, i, arr) => (
              <div key={s.label} className="flex items-center gap-1">
                <Link href={s.href}>
                  <div className="text-center cursor-pointer hover:bg-secondary/50 rounded px-2 py-1 transition-colors">
                    <p className={`text-xl font-bold font-mono ${s.color}`}>{s.count}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                </Link>
                {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/30" />}
              </div>
            ))}
          </div>
        </div>

        {/* Revenue dual bars */}
        <div className="rounded-lg border border-border/50 bg-card/30 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Revenue · $200K Target</p>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="flex items-center gap-1 text-muted-foreground"><Megaphone className="w-3 h-3 text-emerald-400" /> Content</span>
                <span className="font-mono text-emerald-400">${contentRevenue.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (contentRevenue / contentGoal) * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="flex items-center gap-1 text-muted-foreground"><ShoppingBag className="w-3 h-3 text-violet-400" /> Product</span>
                <span className="font-mono text-violet-400">${productRevenue.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, (productRevenue / productGoal) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Activity feed */}
        <div className="rounded-lg border border-border/50 bg-card/30 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Recent</p>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No activity yet</p>
          ) : (
            <div className="space-y-1">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    item.type === 'idea' ? 'bg-amber-400' :
                    item.type === 'article' ? 'bg-blue-400' : 'bg-violet-400'
                  }`} />
                  <span className="truncate flex-1 text-muted-foreground">{item.title || 'Untitled'}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0 h-4 px-1">{item.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Team — visual agent roster */}
      <div className="rounded-lg border border-border/50 bg-card/30 p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2.5">Your AI Editorial Team</p>
        <div className="grid grid-cols-6 sm:grid-cols-9 gap-2">
          {Object.values(AGENTS).map(agent => (
            <div key={agent.id} className="flex flex-col items-center gap-1 group" title={`${agent.name} — ${agent.role}`}>
              <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-border/40 group-hover:ring-primary/50 transition-all">
                <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <span className="text-[8px] text-muted-foreground leading-tight text-center truncate w-full">{agent.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Brands — compact inline if they exist */}
      {brands.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Brands</span>
          {brands.map(brand => (
            <Link key={brand.id} href="/brands">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border/50 hover:border-primary/30 transition-colors cursor-pointer text-xs">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brand.color }} />
                <span className="font-medium">{brand.name}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
