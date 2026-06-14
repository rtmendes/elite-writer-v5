/**
 * Trending Topics — Discover and track trending content opportunities
 * 
 * Features: Platform-specific trend discovery, trend scores, velocity indicators,
 * suggested angles, sample headlines, category filters, grid/list views
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, Flame, Plus, Search, Loader2, ArrowUpRight,
  ArrowRight, ArrowDown, LayoutGrid, List, Filter, Zap,
  Sparkles, Globe, Target, Eye, Trash2, ExternalLink,
  Linkedin, Twitter, Instagram, Facebook, Youtube, Hash,
} from "lucide-react";

const PLATFORMS = [
  { value: "all", label: "All Platforms", icon: Globe },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "twitter", label: "X / Twitter", icon: Twitter },
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "facebook", label: "Facebook", icon: Facebook },
  { value: "youtube", label: "YouTube", icon: Youtube },
  { value: "reddit", label: "Reddit", icon: Hash },
  { value: "tiktok", label: "TikTok", icon: Zap },
  { value: "general", label: "General", icon: TrendingUp },
];

const VELOCITY_CONFIG = {
  rising: { icon: ArrowUpRight, label: "Rising", color: "text-green-500", bg: "bg-green-500/10" },
  stable: { icon: ArrowRight, label: "Stable", color: "text-yellow-500", bg: "bg-yellow-500/10" },
  declining: { icon: ArrowDown, label: "Declining", color: "text-red-500", bg: "bg-red-500/10" },
};

const CATEGORIES = [
  "AI & Technology", "Business", "Marketing", "Finance", "Health",
  "Social Media", "Productivity", "Leadership", "E-commerce", "Creator Economy",
];

export default function Trending() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newPlatform, setNewPlatform] = useState("general");
  const [newCategory, setNewCategory] = useState("");
  const [newTrendScore, setNewTrendScore] = useState(50);
  const [newVelocity, setNewVelocity] = useState("rising");
  const [newAngles, setNewAngles] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");

  // tRPC
  const trendsQuery = trpc.trending.list.useQuery({
    platform: filterPlatform !== "all" ? filterPlatform : undefined,
    category: filterCategory !== "all" ? filterCategory : undefined,
  });
  const createMutation = trpc.trending.create.useMutation({
    onSuccess: () => { toast.success("Trend added!"); trendsQuery.refetch(); setShowAddDialog(false); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMutation = trpc.trending.update.useMutation({
    onSuccess: () => { toast.success("Updated"); trendsQuery.refetch(); },
  });
  const deleteMutation = trpc.trending.delete.useMutation({
    onSuccess: () => { toast.success("Removed"); trendsQuery.refetch(); },
  });

  const resetForm = () => {
    setNewTitle(""); setNewPlatform("general"); setNewCategory("");
    setNewTrendScore(50); setNewVelocity("rising"); setNewAngles(""); setNewSourceUrl("");
  };

  const trends = useMemo(() => {
    const items = trendsQuery.data || [];
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((t: any) =>
      t.title?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q)
    );
  }, [trendsQuery.data, searchQuery]);

  const handleCreate = () => {
    if (!newTitle.trim()) { toast.error("Title is required"); return; }
    createMutation.mutate({
      title: newTitle.trim(),
      platform: newPlatform,
      category: newCategory || undefined,
      trendScore: newTrendScore,
      velocity: newVelocity,
      suggestedAngles: newAngles.split("\n").filter(Boolean),
      sourceUrl: newSourceUrl || undefined,
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="w-6 h-6 text-orange-500" />
            Trending Topics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover and track trending content opportunities across platforms
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Trend</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Trending Topic</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="Topic title..." value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Select value={newPlatform} onValueChange={setNewPlatform}>
                  <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.filter(p => p.value !== "all").map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Trend Score (0-100)</label>
                  <Input type="number" min={0} max={100} value={newTrendScore} onChange={e => setNewTrendScore(Number(e.target.value))} />
                </div>
                <Select value={newVelocity} onValueChange={setNewVelocity}>
                  <SelectTrigger><SelectValue placeholder="Velocity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rising">🔥 Rising</SelectItem>
                    <SelectItem value="stable">➡️ Stable</SelectItem>
                    <SelectItem value="declining">📉 Declining</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea placeholder="Suggested angles (one per line)..." value={newAngles} onChange={e => setNewAngles(e.target.value)} rows={3} />
              <Input placeholder="Source URL (optional)..." value={newSourceUrl} onChange={e => setNewSourceUrl(e.target.value)} />
              <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Add Trend
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search trends..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={filterPlatform} onValueChange={setFilterPlatform}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PLATFORMS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 border rounded-md p-1">
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")}><LayoutGrid className="w-4 h-4" /></Button>
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")}><List className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{trends.length}</p>
          <p className="text-xs text-muted-foreground">Total Trends</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{trends.filter((t: any) => t.velocity === "rising").length}</p>
          <p className="text-xs text-muted-foreground">Rising</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">
            {trends.length ? Math.round(trends.reduce((s: number, t: any) => s + (t.trendScore || 0), 0) / trends.length) : 0}
          </p>
          <p className="text-xs text-muted-foreground">Avg Score</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-500">
            {new Set(trends.map((t: any) => t.platform)).size}
          </p>
          <p className="text-xs text-muted-foreground">Platforms</p>
        </CardContent></Card>
      </div>

      {/* Content */}
      {trendsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : trends.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Flame className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No trending topics yet</p>
          <Button className="mt-4" onClick={() => setShowAddDialog(true)}><Plus className="w-4 h-4 mr-2" />Add Your First Trend</Button>
        </CardContent></Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trends.map((trend: any) => {
            const vel = VELOCITY_CONFIG[trend.velocity as keyof typeof VELOCITY_CONFIG] || VELOCITY_CONFIG.stable;
            const VelIcon = vel.icon;
            const platObj = PLATFORMS.find(p => p.value === trend.platform);
            const PlatIcon = platObj?.icon || Globe;
            return (
              <Card key={trend.id} className="group hover:border-primary/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <PlatIcon className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="secondary" className="text-xs">{trend.category || "General"}</Badge>
                    </div>
                    <div className={`flex items-center gap-1 text-xs ${vel.color}`}>
                      <VelIcon className="w-3 h-3" />{vel.label}
                    </div>
                  </div>
                  <CardTitle className="text-base mt-2">{trend.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Trend Score</span>
                    <span className={`text-lg font-bold ${getScoreColor(trend.trendScore || 0)}`}>
                      {trend.trendScore || 0}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${trend.trendScore || 0}%` }} />
                  </div>
                  {trend.suggestedAngles?.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Suggested Angles</p>
                      <div className="space-y-1">
                        {(trend.suggestedAngles as string[]).slice(0, 3).map((angle: string, i: number) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs">
                            <Target className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                            <span>{angle}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => updateMutation.mutate({ id: trend.id, status: "used" })}>
                      <Sparkles className="w-3 h-3 mr-1" />Use
                    </Button>
                    {trend.sourceUrl && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={trend.sourceUrl} target="_blank" rel="noopener"><ExternalLink className="w-3 h-3" /></a>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate({ id: trend.id })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {trends.map((trend: any) => {
            const vel = VELOCITY_CONFIG[trend.velocity as keyof typeof VELOCITY_CONFIG] || VELOCITY_CONFIG.stable;
            const VelIcon = vel.icon;
            return (
              <Card key={trend.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`text-xl font-bold min-w-[3rem] text-center ${getScoreColor(trend.trendScore || 0)}`}>
                    {trend.trendScore || 0}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{trend.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{trend.platform}</Badge>
                      <Badge variant="outline" className="text-xs">{trend.category || "General"}</Badge>
                      <span className={`flex items-center gap-1 text-xs ${vel.color}`}>
                        <VelIcon className="w-3 h-3" />{vel.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: trend.id, status: "used" })}>
                      <Sparkles className="w-3 h-3 mr-1" />Use
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate({ id: trend.id })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
