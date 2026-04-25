import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import {
  Lightbulb, PenTool, Send, DollarSign, TrendingUp,
  ArrowRight, CheckCircle2, Clock, FileText, Target, Zap,
  BarChart3, BookOpen, Globe, Sparkles, Building2, ShoppingBag, Megaphone
} from 'lucide-react';

const HERO_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/97706254/hNgnrzmPgQMt5regq8X3Kp/hero-dashboard-bFnVAUYh9iFoEJUorwSuju.webp';

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

  const pipelineStages = [
    { label: 'Ideas', count: ideas.length, icon: Lightbulb, color: 'text-amber-400', bgColor: 'bg-amber-500/10', href: '/ideas' },
    { label: 'Drafts', count: activeDrafts, icon: PenTool, color: 'text-blue-400', bgColor: 'bg-blue-500/10', href: '/writer' },
    { label: 'Pitched', count: pitchesSent, icon: Send, color: 'text-violet-400', bgColor: 'bg-violet-500/10', href: '/pitches' },
    { label: 'Published', count: accepted.length, icon: CheckCircle2, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', href: '/financial' },
  ];

  const recentActivity = [
    ...ideas.slice(0, 3).map(i => ({ type: 'idea' as const, title: i.title, time: i.created_at, status: i.status })),
    ...articles.slice(0, 3).map(a => ({ type: 'article' as const, title: a.title, time: a.updated_at, status: a.status })),
    ...pitches.slice(0, 3).map(p => ({ type: 'pitch' as const, title: `${p.publication_name}: ${p.subject}`, time: p.created_at, status: p.status })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

  const workflowSteps = [
    { step: 1, label: 'Intelligence', desc: 'Scan trending topics', icon: Globe, href: '/giststack', color: 'text-cyan-400' },
    { step: 2, label: 'Ideate', desc: 'Generate scored ideas', icon: Lightbulb, href: '/ideas', color: 'text-amber-400' },
    { step: 3, label: 'Research', desc: 'Gather data & sources', icon: BookOpen, href: '/research', color: 'text-orange-400' },
    { step: 4, label: 'Write', desc: 'Draft & score article', icon: PenTool, href: '/writer', color: 'text-blue-400' },
    { step: 5, label: 'Match', desc: 'Find best publications', icon: Target, href: '/publications', color: 'text-rose-400' },
    { step: 6, label: 'Pitch', desc: 'Submit to editors', icon: Send, href: '/pitches', color: 'text-violet-400' },
    { step: 7, label: 'Earn', desc: 'Track revenue', icon: DollarSign, href: '/financial', color: 'text-emerald-400' },
  ];

  return (
    <div className="p-4 space-y-3">
      {/* Hero Banner */}
      <div className="relative rounded-xl overflow-hidden h-28 md:h-32">
        <img src={HERO_IMG} alt="Command Center" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 flex items-center p-4 md:p-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-xs border-violet-500/50 text-violet-300 bg-violet-500/10">
                <Sparkles className="w-3 h-3 mr-1" /> Elite Writer V5
              </Badge>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Command Center</h1>
            <p className="text-sm text-white/70 mt-1 max-w-md">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {' '}&mdash; 176 publications loaded
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { label: 'Total Ideas', value: ideas.length, icon: Lightbulb, color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
          { label: 'Active Drafts', value: activeDrafts, icon: FileText, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
          { label: 'Acceptance Rate', value: `${acceptanceRate}%`, icon: TrendingUp, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
          { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-violet-400', bgColor: 'bg-violet-500/10' },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-bold font-mono">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Progress */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Daily Production Target
            </CardTitle>
            <Link href="/ideas">
              <Button size="sm" className="gap-1.5 h-8">
                <Zap className="w-3.5 h-3.5" /> New Idea
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Ideas generated today</span>
                <span className="font-mono font-semibold">{todayIdeas} / {settings.daily_target}</span>
              </div>
              <Progress value={Math.min(100, (todayIdeas / settings.daily_target) * 100)} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Complete Workflow Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {workflowSteps.map((ws, i) => (
              <Link key={ws.step} href={ws.href}>
                <div className="relative p-2 rounded-lg hover:bg-secondary/50 transition-all cursor-pointer text-center group">
                  <div className="flex items-center justify-center mb-1.5">
                    <div className="w-7 h-7 rounded-full bg-secondary/80 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <ws.icon className={`w-4 h-4 ${ws.color}`} />
                    </div>
                  </div>
                  <p className="text-xs font-medium">{ws.label}</p>
                  <p className="text-[10px] text-muted-foreground hidden md:block">{ws.desc}</p>
                  {i < workflowSteps.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-muted-foreground/50 absolute right-[-8px] top-1/2 -translate-y-1/2 hidden lg:block" />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline + Activity */}
      <div className="grid lg:grid-cols-2 gap-3">
        {/* Pipeline Flow */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base">Article Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2">
              {pipelineStages.map((stage, i) => (
                <div key={stage.label} className="flex items-center gap-2 flex-1">
                  <Link href={stage.href} className="flex-1">
                    <div className="p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors text-center cursor-pointer">
                      <stage.icon className={`w-5 h-5 mx-auto mb-1 ${stage.color}`} />
                      <p className="text-2xl font-bold font-mono">{stage.count}</p>
                      <p className="text-xs text-muted-foreground">{stage.label}</p>
                    </div>
                  </Link>
                  {i < pipelineStages.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No activity yet. Start by generating ideas!</p>
                <Link href="/giststack">
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Browse Intelligence Feed
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-md text-sm hover:bg-secondary/30 transition-colors">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      item.type === 'idea' ? 'bg-amber-400' :
                      item.type === 'article' ? 'bg-blue-400' : 'bg-violet-400'
                    }`} />
                    <span className="truncate flex-1">{item.title || 'Untitled'}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{item.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dual Revenue Progress */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Revenue Engine: $200K/mo Target
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium">Content Revenue</span>
              </div>
              <p className="text-2xl font-bold font-mono text-emerald-400">${contentRevenue.toLocaleString()}</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Monthly Goal</span>
                  <span>${contentGoal.toLocaleString()}</span>
                </div>
                <Progress value={Math.min(100, (contentRevenue / contentGoal) * 100)} className="h-1.5" />
              </div>
            </div>
            <div className="p-4 rounded-lg bg-violet-500/5 border border-violet-500/20">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-medium">Product Revenue</span>
              </div>
              <p className="text-2xl font-bold font-mono text-violet-400">${productRevenue.toLocaleString()}</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Monthly Goal</span>
                  <span>${productGoal.toLocaleString()}</span>
                </div>
                <Progress value={Math.min(100, (productRevenue / productGoal) * 100)} className="h-1.5" />
              </div>
            </div>
          </div>
          {brands.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" /> Active Brands
              </p>
              <div className="flex flex-wrap gap-2">
                {brands.map(brand => (
                  <Link key={brand.id} href="/brands">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:border-primary/30 transition-colors cursor-pointer">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: brand.color }} />
                      <span className="text-xs font-medium">{brand.name}</span>
                      <span className="text-[10px] text-muted-foreground">{brand.products.length} products</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: 'Intelligence Feed', href: '/giststack', icon: Globe, color: 'text-cyan-400' },
              { label: 'Generate Ideas', href: '/ideas', icon: Lightbulb, color: 'text-amber-400' },
              { label: 'Start Writing', href: '/writer', icon: PenTool, color: 'text-blue-400' },
              { label: '176 Publications', href: '/publications', icon: FileText, color: 'text-rose-400' },
              { label: 'Create Pitch', href: '/pitches', icon: Send, color: 'text-violet-400' },
            ].map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group border border-transparent hover:border-border/50">
                  <action.icon className={`w-5 h-5 ${action.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-xs text-center">{action.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
