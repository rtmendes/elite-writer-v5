/**
 * GEO Suite — Generative Engine Optimization + AI Humanizer + Content Quality
 * 
 * Blazly-inspired features:
 * - GEO project management & AI monitoring
 * - Brand sentiment analysis across LLMs
 * - Competitor AI visibility comparison
 * - AI citation flow tracking
 * - AI Humanizer & Content Quality Suite
 * - GEO/AEO Content Writer
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Globe, Plus, Loader2, Trash2, Search, Eye, Brain,
  Target, BarChart3, Shield, Sparkles, FileText, Wand2,
  CheckCircle2, AlertTriangle, XCircle, TrendingUp, Radar,
  Copy,
} from "lucide-react";

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? "text-green-400" : score >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>{score}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default function Geo() {
  const [tab, setTab] = useState("projects");

  // Project form
  const [showCreate, setShowCreate] = useState(false);
  const [projName, setProjName] = useState("");
  const [projUrl, setProjUrl] = useState("");
  const [projCompetitors, setProjCompetitors] = useState("");
  const [projKeywords, setProjKeywords] = useState("");

  // Page score form
  const [scoreUrl, setScoreUrl] = useState("");
  const [selectedProject, setSelectedProject] = useState<number | null>(null);

  // Citation flow
  const [citationKeyword, setCitationKeyword] = useState("");

  // Humanizer
  const [humanizerText, setHumanizerText] = useState("");
  const [humanizerIntensity, setHumanizerIntensity] = useState<string>("moderate");

  // Quality Suite
  const [qualityText, setQualityText] = useState("");
  const [qualityKeyword, setQualityKeyword] = useState("");

  // GEO Writer
  const [geoWriterKeyword, setGeoWriterKeyword] = useState("");
  const [geoWriterType, setGeoWriterType] = useState("blog_post");

  // tRPC
  const projectsQuery = trpc.geo.projects.list.useQuery();
  const createProject = trpc.geo.projects.create.useMutation({
    onSuccess: () => { toast.success("Project created!"); projectsQuery.refetch(); setShowCreate(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteProject = trpc.geo.projects.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); projectsQuery.refetch(); },
  });
  const monitorMut = trpc.geo.monitor.useMutation({
    onSuccess: (data) => { toast.success(`Monitoring complete! Score: ${data.overallScore}`); projectsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const sentimentMut = trpc.geo.brandSentiment.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const competitorMut = trpc.geo.competitorAnalysis.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const scorePageMut = trpc.geo.scorePage.useMutation({
    onError: (e) => toast.error(e.message),
  });
  const citationMut = trpc.geo.citationFlow.useMutation({
    onError: (e) => toast.error(e.message),
  });

  // Humanizer mutations
  const detectMut = trpc.humanizer.detectAI.useMutation({ onError: (e) => toast.error(e.message) });
  const humanizeMut = trpc.humanizer.humanize.useMutation({ onError: (e) => toast.error(e.message) });
  const qualityMut = trpc.humanizer.qualityCheck.useMutation({ onError: (e) => toast.error(e.message) });
  const geoWriterMut = trpc.humanizer.generateGeoContent.useMutation({ onError: (e) => toast.error(e.message) });
  const seoScoreMut = trpc.humanizer.seoScore.useMutation({ onError: (e) => toast.error(e.message) });

  const projects = projectsQuery.data || [];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            GEO Suite
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generative Engine Optimization • AI Humanizer • Content Quality
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="projects"><Radar className="w-3 h-3 mr-1" />GEO Projects</TabsTrigger>
            <TabsTrigger value="citation"><Target className="w-3 h-3 mr-1" />Citation Flow</TabsTrigger>
            <TabsTrigger value="humanizer"><Wand2 className="w-3 h-3 mr-1" />Humanizer</TabsTrigger>
            <TabsTrigger value="quality"><Shield className="w-3 h-3 mr-1" />Quality Suite</TabsTrigger>
            <TabsTrigger value="writer"><FileText className="w-3 h-3 mr-1" />GEO Writer</TabsTrigger>
          </TabsList>

          {/* ─── GEO Projects ────────────────────────────── */}
          <TabsContent value="projects" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Track your brand's visibility across AI search engines</p>
              <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" />New Project</Button>
            </div>

            {projectsQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : projects.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                No GEO projects yet. Create one to start monitoring AI visibility.
              </CardContent></Card>
            ) : (
              <div className="space-y-4">
                {projects.map(project => {
                  const meta = project.metadata as any || {};
                  return (
                    <Card key={project.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-medium text-foreground">{project.name}</h3>
                            <p className="text-xs text-muted-foreground">{project.websiteUrl}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {project.overallGeoScore !== null && (
                              <Badge className={project.overallGeoScore >= 70 ? "bg-green-500/10 text-green-400" :
                                project.overallGeoScore >= 40 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}>
                                GEO Score: {project.overallGeoScore}
                              </Badge>
                            )}
                            <Button size="sm" variant="ghost" className="text-destructive"
                              onClick={() => deleteProject.mutate({ id: project.id })}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Keywords & Competitors */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(project.monitorKeywords as string[])?.map((kw, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                          ))}
                        </div>

                        {/* LLM Visibility bars */}
                        {meta.llm_visibility && (
                          <div className="grid grid-cols-4 gap-3 mb-3">
                            {Object.entries(meta.llm_visibility as Record<string, number>).map(([llm, score]) => (
                              <div key={llm} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="capitalize">{llm}</span>
                                  <span className="text-muted-foreground">{score as number}</span>
                                </div>
                                <Progress value={Math.min(100, score as number)} className="h-1.5" />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline"
                            disabled={monitorMut.isPending}
                            onClick={() => monitorMut.mutate({ projectId: project.id })}>
                            {monitorMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                            Monitor
                          </Button>
                          <Button size="sm" variant="outline"
                            disabled={sentimentMut.isPending}
                            onClick={() => sentimentMut.mutate({ projectId: project.id })}>
                            {sentimentMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Brain className="w-3 h-3 mr-1" />}
                            Sentiment
                          </Button>
                          <Button size="sm" variant="outline"
                            disabled={competitorMut.isPending}
                            onClick={() => competitorMut.mutate({ projectId: project.id })}>
                            {competitorMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <BarChart3 className="w-3 h-3 mr-1" />}
                            Competitors
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => { setSelectedProject(project.id); setScoreUrl(project.websiteUrl); }}>
                            <Target className="w-3 h-3 mr-1" />Score Page
                          </Button>
                        </div>

                        {/* Sentiment Results */}
                        {sentimentMut.data && sentimentMut.variables?.projectId === project.id && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge>{(sentimentMut.data as any).overall_sentiment}</Badge>
                              <span className="text-sm">Score: {(sentimentMut.data as any).sentiment_score}/100</span>
                            </div>
                            {(sentimentMut.data as any).strengths?.map((s: string, i: number) => (
                              <div key={i} className="text-xs text-green-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />{s}
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

            {/* Score Page Dialog */}
            {selectedProject && (
              <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Score Page for GEO/AEO</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input value={scoreUrl} onChange={e => setScoreUrl(e.target.value)} placeholder="Page URL to score" />
                    <Button onClick={() => scorePageMut.mutate({ projectId: selectedProject, pageUrl: scoreUrl })}
                      disabled={scorePageMut.isPending} className="w-full">
                      {scorePageMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Target className="w-4 h-4 mr-2" />}
                      Analyze Page
                    </Button>
                    {scorePageMut.data && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-4 py-3">
                          <ScoreBadge score={(scorePageMut.data as any).geoScore} label="GEO" />
                          <ScoreBadge score={(scorePageMut.data as any).aeoScore} label="AEO" />
                          <ScoreBadge score={(scorePageMut.data as any).seoScore} label="SEO" />
                        </div>
                        {(scorePageMut.data as any).recommendations?.map((r: string, i: number) => (
                          <div key={i} className="text-xs flex items-start gap-1">
                            <TrendingUp className="w-3 h-3 text-primary shrink-0 mt-0.5" />{r}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>

          {/* ─── Citation Flow ────────────────────────────── */}
          <TabsContent value="citation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">AI Citation Flow Analysis</CardTitle>
                <CardDescription className="text-xs">See which sources AI models cite for any keyword</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={citationKeyword} onChange={e => setCitationKeyword(e.target.value)}
                    placeholder="Enter keyword to analyze..." className="flex-1" />
                  <Button onClick={() => citationMut.mutate({ keyword: citationKeyword })}
                    disabled={citationMut.isPending || !citationKeyword.trim()}>
                    {citationMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>

                {citationMut.data && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Top Citation Sources for "{(citationMut.data as any).keyword}"</h4>
                    <div className="space-y-2">
                      {(citationMut.data as any).citationSources?.map((source: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <span className="text-sm">{source.source}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{source.citation_type}</Badge>
                            <Badge variant="secondary" className="text-xs">{source.authority}/100</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Badge className={`text-xs ${
                      (citationMut.data as any).difficulty === "easy" ? "bg-green-500/10 text-green-400" :
                      (citationMut.data as any).difficulty === "medium" ? "bg-amber-500/10 text-amber-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>Difficulty: {(citationMut.data as any).difficulty}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Humanizer ────────────────────────────────── */}
          <TabsContent value="humanizer" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-primary" />AI Humanizer
                  </CardTitle>
                  <CardDescription className="text-xs">Detect AI patterns and humanize your content</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea value={humanizerText} onChange={e => setHumanizerText(e.target.value)}
                    placeholder="Paste your text here (min 50 chars)..." rows={8} />
                  <Select value={humanizerIntensity} onValueChange={setHumanizerIntensity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light — subtle tweaks</SelectItem>
                      <SelectItem value="moderate">Moderate — natural rewrite</SelectItem>
                      <SelectItem value="heavy">Heavy — complete reimagining</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button onClick={() => detectMut.mutate({ text: humanizerText })}
                      disabled={detectMut.isPending || humanizerText.length < 50} variant="outline" className="flex-1">
                      {detectMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                      Detect AI
                    </Button>
                    <Button onClick={() => humanizeMut.mutate({ text: humanizerText, intensity: humanizerIntensity as any })}
                      disabled={humanizeMut.isPending || humanizerText.length < 50} className="flex-1">
                      {humanizeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Humanize
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Results panel */}
              <div className="space-y-4">
                {detectMut.data && (
                  <Card className="border-primary/20">
                    <CardContent className="pt-4 space-y-2">
                      <h4 className="text-sm font-medium">AI Detection Results</h4>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className={`text-3xl font-bold ${
                            (detectMut.data as any).ai_score > 70 ? "text-red-400" :
                            (detectMut.data as any).ai_score > 40 ? "text-amber-400" : "text-green-400"
                          }`}>{(detectMut.data as any).ai_score}%</div>
                          <div className="text-xs text-muted-foreground">AI Score</div>
                        </div>
                        <Badge className={
                          (detectMut.data as any).verdict === "likely_human" ? "bg-green-500/10 text-green-400" :
                          (detectMut.data as any).verdict === "mixed" ? "bg-amber-500/10 text-amber-400" :
                          "bg-red-500/10 text-red-400"
                        }>{(detectMut.data as any).verdict?.replace("_", " ")}</Badge>
                      </div>
                      {(detectMut.data as any).patterns_detected?.map((p: any, i: number) => (
                        <div key={i} className="text-xs flex items-start gap-1">
                          {p.severity === "high" ? <XCircle className="w-3 h-3 text-red-400 shrink-0" /> :
                           p.severity === "medium" ? <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" /> :
                           <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />}
                          {p.pattern}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {humanizeMut.data && (
                  <Card className="border-green-500/20">
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Humanized Version</h4>
                        <div className="flex gap-2 text-xs">
                          <Badge variant="outline">Before: {(humanizeMut.data as any).estimated_ai_score_before}%</Badge>
                          <Badge className="bg-green-500/10 text-green-400">After: {(humanizeMut.data as any).estimated_ai_score_after}%</Badge>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap max-h-60 overflow-auto">
                        {(humanizeMut.data as any).humanized_text}
                      </p>
                      <Button size="sm" variant="outline" onClick={() => {
                        navigator.clipboard.writeText((humanizeMut.data as any).humanized_text);
                        toast.success("Copied!");
                      }}><Copy className="w-3 h-3 mr-1" />Copy</Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ─── Quality Suite ────────────────────────────── */}
          <TabsContent value="quality" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />Content Quality Dashboard
                </CardTitle>
                <CardDescription className="text-xs">Check AI score, originality, SEO, and readability in one pass</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea value={qualityText} onChange={e => setQualityText(e.target.value)}
                  placeholder="Paste content to analyze..." rows={6} />
                <Input value={qualityKeyword} onChange={e => setQualityKeyword(e.target.value)}
                  placeholder="Target keyword (optional)" />
                <div className="flex gap-2">
                  <Button onClick={() => qualityMut.mutate({ text: qualityText, targetKeyword: qualityKeyword || undefined })}
                    disabled={qualityMut.isPending || qualityText.length < 50} className="flex-1">
                    {qualityMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                    Full Quality Check
                  </Button>
                  <Button variant="outline" onClick={() => seoScoreMut.mutate({ text: qualityText, targetKeyword: qualityKeyword || undefined })}
                    disabled={seoScoreMut.isPending || qualityText.length < 50}>
                    {seoScoreMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                    SEO Only
                  </Button>
                </div>

                {qualityMut.data && (
                  <div className="space-y-3 pt-3 border-t">
                    <div className="grid grid-cols-5 gap-3">
                      <ScoreBadge score={(qualityMut.data as any).ai_score} label="AI" />
                      <ScoreBadge score={(qualityMut.data as any).originality_score} label="Original" />
                      <ScoreBadge score={(qualityMut.data as any).seo_score} label="SEO" />
                      <ScoreBadge score={(qualityMut.data as any).readability_score} label="Readable" />
                      <ScoreBadge score={(qualityMut.data as any).overall_quality} label="Overall" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-lg">{(qualityMut.data as any).grade}</Badge>
                      <p className="text-sm text-muted-foreground">{(qualityMut.data as any).summary}</p>
                    </div>
                    {(qualityMut.data as any).top_issues?.map((issue: any, i: number) => (
                      <div key={i} className="text-xs flex items-start gap-1 p-2 bg-muted/50 rounded">
                        {issue.severity === "critical" ? <XCircle className="w-3 h-3 text-red-400 shrink-0" /> :
                         issue.severity === "warning" ? <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" /> :
                         <CheckCircle2 className="w-3 h-3 text-blue-400 shrink-0" />}
                        <div><span className="font-medium">{issue.issue}:</span> {issue.fix}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── GEO Writer ───────────────────────────────── */}
          <TabsContent value="writer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />GEO/AEO Content Writer
                </CardTitle>
                <CardDescription className="text-xs">Generate content optimized for AI search engine visibility</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input value={geoWriterKeyword} onChange={e => setGeoWriterKeyword(e.target.value)}
                    placeholder="Target keyword" />
                  <Select value={geoWriterType} onValueChange={setGeoWriterType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blog_post">Blog Post</SelectItem>
                      <SelectItem value="landing_page">Landing Page</SelectItem>
                      <SelectItem value="faq">FAQ Page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => geoWriterMut.mutate({
                  targetKeyword: geoWriterKeyword, contentType: geoWriterType as any,
                })} disabled={geoWriterMut.isPending || !geoWriterKeyword.trim()} className="w-full">
                  {geoWriterMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Generate GEO Content
                </Button>

                {geoWriterMut.data && (
                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-foreground">{(geoWriterMut.data as any).title}</h3>
                      {(geoWriterMut.data as any).geo_score_estimate && (
                        <Badge className="bg-primary/10 text-primary">GEO: {(geoWriterMut.data as any).geo_score_estimate}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{(geoWriterMut.data as any).meta_description}</p>
                    <div className="prose prose-sm dark:prose-invert max-h-96 overflow-auto p-3 bg-muted/50 rounded text-sm whitespace-pre-wrap">
                      {(geoWriterMut.data as any).content}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText((geoWriterMut.data as any).content);
                      toast.success("Content copied!");
                    }}><Copy className="w-3 h-3 mr-1" />Copy Content</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Project Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle>New GEO Project</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={projName} onChange={e => setProjName(e.target.value)} placeholder="Project name" />
              <Input value={projUrl} onChange={e => setProjUrl(e.target.value)} placeholder="Website URL (https://...)" />
              <Input value={projKeywords} onChange={e => setProjKeywords(e.target.value)}
                placeholder="Monitor keywords (comma-separated)" />
              <Input value={projCompetitors} onChange={e => setProjCompetitors(e.target.value)}
                placeholder="Competitor URLs (comma-separated)" />
              <Button onClick={() => createProject.mutate({
                name: projName, websiteUrl: projUrl,
                monitorKeywords: projKeywords.split(",").map(k => k.trim()).filter(Boolean),
                competitors: projCompetitors.split(",").map(c => c.trim()).filter(Boolean),
              })} disabled={createProject.isPending} className="w-full">
                {createProject.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Project
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
