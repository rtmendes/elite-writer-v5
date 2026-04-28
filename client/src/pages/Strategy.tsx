/**
 * Strategy & Keywords — Blazly-inspired Strategy Builder + Keyword Discovery
 * 
 * Features:
 * - Keyword discovery with difficulty, volume, intent, AI visibility
 * - Pillar-cluster content strategy builder
 * - Strategy enhancement & auto-execute
 * - Blog idea generation from keywords
 * - Bulk article generation
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Map, Search, Plus, Loader2, Trash2, Bookmark, BookmarkCheck,
  Sparkles, TrendingUp, TrendingDown, Minus, Target, Lightbulb,
  Layers, Zap, Play, FileText, CheckCircle2, Clock, BarChart3,
} from "lucide-react";

function TrendIcon({ trend }: { trend: string | null }) {
  if (trend === "rising") return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (trend === "declining") return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

function DifficultyBar({ value }: { value: number | null }) {
  const v = value || 0;
  const color = v > 70 ? "bg-red-500" : v > 40 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-6">{v}</span>
    </div>
  );
}

function IntentBadge({ intent }: { intent: string | null }) {
  const config: Record<string, string> = {
    informational: "bg-blue-500/10 text-blue-400",
    navigational: "bg-purple-500/10 text-purple-400",
    commercial: "bg-amber-500/10 text-amber-400",
    transactional: "bg-green-500/10 text-green-400",
  };
  return intent ? <Badge className={`text-xs ${config[intent] || ""}`}>{intent}</Badge> : null;
}

export default function Strategy() {
  const [tab, setTab] = useState("keywords");
  const [topic, setTopic] = useState("");
  const [showStrategyCreate, setShowStrategyCreate] = useState(false);
  const [strategyKeyword, setStrategyKeyword] = useState("");
  const [strategyName, setStrategyName] = useState("");
  const [expandedStrategy, setExpandedStrategy] = useState<number | null>(null);

  // tRPC
  const keywordsQuery = trpc.strategy.keywords.list.useQuery({});
  const strategiesQuery = trpc.strategy.strategies.list.useQuery();

  const discoverMut = trpc.strategy.keywords.discover.useMutation({
    onSuccess: (data) => {
      toast.success(`${(data as any).keywords?.length || 0} keywords discovered!`);
      keywordsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleSaveMut = trpc.strategy.keywords.toggleSave.useMutation({
    onSuccess: () => keywordsQuery.refetch(),
  });
  const deleteKwMut = trpc.strategy.keywords.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); keywordsQuery.refetch(); },
  });
  const ideasMut = trpc.strategy.keywords.generateIdeas.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const createStrategyMut = trpc.strategy.strategies.create.useMutation({
    onSuccess: () => {
      toast.success("Strategy created!");
      strategiesQuery.refetch();
      setShowStrategyCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const enhanceMut = trpc.strategy.strategies.enhance.useMutation({
    onSuccess: () => { toast.success("Strategy enhanced!"); strategiesQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const executeMut = trpc.strategy.strategies.execute.useMutation({
    onSuccess: (data) => { toast.success(`${(data as any).generated} articles generated!`); },
    onError: (e) => toast.error(e.message),
  });
  const deleteStrategyMut = trpc.strategy.strategies.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); strategiesQuery.refetch(); },
  });

  const keywords = keywordsQuery.data || [];
  const strategies = strategiesQuery.data || [];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Map className="w-6 h-6 text-primary" />
              Strategy & Keywords
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Discover keywords, build content strategies, and execute at scale
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{keywords.length} keywords</Badge>
            <Badge variant="outline">{strategies.length} strategies</Badge>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="keywords"><Search className="w-3 h-3 mr-1" />Keywords</TabsTrigger>
            <TabsTrigger value="strategies"><Layers className="w-3 h-3 mr-1" />Strategies</TabsTrigger>
          </TabsList>

          {/* ─── Keywords Tab ─────────────────────────────── */}
          <TabsContent value="keywords" className="space-y-4">
            {/* Discovery bar */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex gap-2">
                  <Input value={topic} onChange={e => setTopic(e.target.value)}
                    placeholder="Enter a topic to discover keywords (e.g., 'AI content marketing')"
                    className="flex-1"
                    onKeyDown={e => { if (e.key === "Enter" && topic.trim()) discoverMut.mutate({ topic }); }} />
                  <Button onClick={() => discoverMut.mutate({ topic })}
                    disabled={discoverMut.isPending || !topic.trim()}>
                    {discoverMut.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />Discovering...</>
                    ) : (
                      <><Search className="w-4 h-4 mr-2" />Discover</>
                    )}
                  </Button>
                </div>
                {discoverMut.data && (
                  <p className="text-xs text-muted-foreground mt-2">{(discoverMut.data as any).recommended_strategy}</p>
                )}
              </CardContent>
            </Card>

            {/* Just-discovered results */}
            {discoverMut.data?.keywords?.length > 0 && (
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Newly Discovered ({discoverMut.data.keywords.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left py-2 font-medium">Keyword</th>
                          <th className="text-left py-2 font-medium">Volume</th>
                          <th className="text-left py-2 font-medium">Difficulty</th>
                          <th className="text-left py-2 font-medium">CPC</th>
                          <th className="text-left py-2 font-medium">Trend</th>
                          <th className="text-left py-2 font-medium">Intent</th>
                          <th className="text-left py-2 font-medium">AI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(discoverMut.data as any).keywords.map((kw: any, i: number) => (
                          <tr key={i} className="border-b border-muted/50 hover:bg-muted/30">
                            <td className="py-2 font-medium">{kw.keyword}</td>
                            <td className="py-2 text-muted-foreground">{kw.volume?.toLocaleString()}</td>
                            <td className="py-2"><DifficultyBar value={kw.difficulty} /></td>
                            <td className="py-2 text-muted-foreground">${kw.cpc}</td>
                            <td className="py-2"><TrendIcon trend={kw.trend} /></td>
                            <td className="py-2"><IntentBadge intent={kw.intent} /></td>
                            <td className="py-2">
                              {kw.ai_visibility?.ai_competition && (
                                <Badge variant="outline" className="text-xs">{kw.ai_visibility.ai_competition}</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Saved keywords */}
            {keywordsQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : keywords.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                No keywords yet. Discover your first batch above!
              </CardContent></Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">All Keywords ({keywords.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="text-left py-2 w-8"></th>
                          <th className="text-left py-2 font-medium">Keyword</th>
                          <th className="text-left py-2 font-medium">Vol</th>
                          <th className="text-left py-2 font-medium">Diff</th>
                          <th className="text-left py-2 font-medium">Intent</th>
                          <th className="text-left py-2 font-medium">Trend</th>
                          <th className="text-right py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keywords.slice(0, 100).map(kw => (
                          <tr key={kw.id} className="border-b border-muted/50 hover:bg-muted/30">
                            <td className="py-2">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                                onClick={() => toggleSaveMut.mutate({ id: kw.id })}>
                                {kw.saved ? <BookmarkCheck className="w-3 h-3 text-primary" /> : <Bookmark className="w-3 h-3" />}
                              </Button>
                            </td>
                            <td className="py-2 font-medium">{kw.keyword}</td>
                            <td className="py-2 text-muted-foreground">{kw.volume?.toLocaleString() || "—"}</td>
                            <td className="py-2"><DifficultyBar value={kw.difficulty} /></td>
                            <td className="py-2"><IntentBadge intent={kw.intent} /></td>
                            <td className="py-2"><TrendIcon trend={kw.trend} /></td>
                            <td className="py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                                  disabled={ideasMut.isPending}
                                  onClick={() => ideasMut.mutate({ keywordId: kw.id })}>
                                  <Lightbulb className="w-3 h-3 mr-1" />Ideas
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive"
                                  onClick={() => deleteKwMut.mutate({ id: kw.id })}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Blog ideas result */}
                  {ideasMut.data && (
                    <div className="mt-4 p-3 bg-primary/5 rounded-lg space-y-2 border border-primary/20">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-400" />Blog Ideas
                      </h4>
                      {(ideasMut.data as any).ideas?.map((idea: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-background rounded text-sm">
                          <span>{idea.title}</span>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-xs">{idea.format}</Badge>
                            <Badge variant="secondary" className="text-xs">{idea.estimated_difficulty}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ─── Strategies Tab ───────────────────────────── */}
          <TabsContent value="strategies" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Build pillar-cluster content strategies for topical authority</p>
              <Button onClick={() => setShowStrategyCreate(true)}><Plus className="w-4 h-4 mr-1" />New Strategy</Button>
            </div>

            {strategiesQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : strategies.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                No strategies yet. Create your first pillar-cluster plan!
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {strategies.map(strategy => {
                  const clusters = (strategy.clusters as any[]) || [];
                  const planned = clusters.filter(c => c.status === "planned").length;
                  const drafted = clusters.filter(c => c.status === "drafted").length;
                  const published = clusters.filter(c => c.status === "published").length;
                  const progress = clusters.length > 0 ? ((drafted + published) / clusters.length) * 100 : 0;
                  const isExpanded = expandedStrategy === strategy.id;

                  return (
                    <Card key={strategy.id} className={isExpanded ? "border-primary/30" : ""}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="cursor-pointer flex-1" onClick={() => setExpandedStrategy(isExpanded ? null : strategy.id)}>
                            <h3 className="font-medium text-foreground">{strategy.name}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              Keyword: {strategy.primaryKeyword} • Pillar: {strategy.pillarTopic}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs capitalize">{strategy.status}</Badge>
                            {strategy.enhanced ? <Badge className="text-xs bg-primary/10 text-primary">Enhanced</Badge> : null}
                            <Button size="sm" variant="ghost" className="text-destructive"
                              onClick={() => deleteStrategyMut.mutate({ id: strategy.id })}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{clusters.length} clusters</span>
                            <span>{planned} planned • {drafted} drafted • {published} published</span>
                          </div>
                          <Progress value={progress} className="h-1.5" />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-3">
                          {!strategy.enhanced && (
                            <Button size="sm" variant="outline"
                              disabled={enhanceMut.isPending}
                              onClick={() => enhanceMut.mutate({ id: strategy.id })}>
                              {enhanceMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                              Enhance
                            </Button>
                          )}
                          <Button size="sm" variant="outline"
                            disabled={executeMut.isPending || planned === 0}
                            onClick={() => executeMut.mutate({ id: strategy.id })}>
                            {executeMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                            Generate Articles ({planned})
                          </Button>
                        </div>

                        {/* Expanded: Cluster list */}
                        {isExpanded && clusters.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase">Cluster Topics</h4>
                            {clusters.map((cluster: any, i: number) => (
                              <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                <div className="flex items-center gap-2">
                                  {cluster.status === "published" ? <CheckCircle2 className="w-3 h-3 text-green-400" /> :
                                   cluster.status === "drafted" ? <FileText className="w-3 h-3 text-blue-400" /> :
                                   <Clock className="w-3 h-3 text-muted-foreground" />}
                                  <span>{cluster.title}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <IntentBadge intent={cluster.intent} />
                                  {cluster.volume && <span className="text-xs text-muted-foreground">{cluster.volume}</span>}
                                  <DifficultyBar value={cluster.difficulty} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Execute results */}
                        {executeMut.data && (executeMut.data as any).articles?.length > 0 && (
                          <div className="mt-4 space-y-2 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                            <h4 className="text-sm font-medium text-green-400">Generated Articles</h4>
                            {(executeMut.data as any).articles.map((article: any, i: number) => (
                              <div key={i} className="p-2 bg-background rounded">
                                <p className="text-sm font-medium">{article.title || article.cluster}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {article.word_count} words • {article.meta_description}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Strategy Dialog */}
        <Dialog open={showStrategyCreate} onOpenChange={setShowStrategyCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />Build Content Strategy
            </DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={strategyKeyword} onChange={e => setStrategyKeyword(e.target.value)}
                placeholder="Primary keyword (e.g., 'AI content marketing')" />
              <Input value={strategyName} onChange={e => setStrategyName(e.target.value)}
                placeholder="Strategy name (optional)" />
              <p className="text-xs text-muted-foreground">
                AI will generate a pillar topic + 8-12 cluster articles with keyword research for each
              </p>
              <Button onClick={() => createStrategyMut.mutate({
                primaryKeyword: strategyKeyword,
                name: strategyName || undefined,
              })} disabled={createStrategyMut.isPending || !strategyKeyword.trim()} className="w-full">
                {createStrategyMut.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Building Strategy...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />Generate Strategy</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
