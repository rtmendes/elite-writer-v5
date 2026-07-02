/**
 * Social Content Engine — Create, manage, and publish social media content
 * 
 * Features: Multi-platform content generation (X, LinkedIn, FB, Reddit, Threads),
 * threaded posts, brand context lens, batch generation, webhook publishing
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useSelection } from "@/hooks/useSelection";
import { SelectionBar } from "@/components/SelectionBar";
import {
  MessageSquare, Plus, Search, Loader2, Twitter, Linkedin,
  Facebook, Send, Trash2, Copy, Sparkles, Hash, Globe,
  Zap, BarChart3, Eye, Calendar, Edit, CheckCircle2, Webhook,
} from "lucide-react";

const PLATFORMS = [
  { value: "twitter", label: "X (Twitter)", icon: Twitter, color: "text-sky-400", bg: "bg-sky-500/10" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-blue-500", bg: "bg-blue-500/10" },
  { value: "facebook", label: "Facebook", icon: Facebook, color: "text-blue-600", bg: "bg-blue-600/10" },
  { value: "reddit", label: "Reddit", icon: MessageSquare, color: "text-orange-500", bg: "bg-orange-500/10" },
  { value: "threads", label: "Threads", icon: Hash, color: "text-purple-400", bg: "bg-purple-500/10" },
] as const;

const POST_TYPES = ["single", "thread", "carousel", "poll"] as const;
const TONES = ["professional", "casual", "witty", "authoritative", "inspirational", "provocative", "educational"];

// Statuses accepted by social.update (server enum)
const POST_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
] as const;

export default function Social() {
  const [tab, setTab] = useState("create");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "status">("newest");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Create form state
  const [platform, setPlatform] = useState<string>("twitter");
  const [postType, setPostType] = useState<string>("single");
  const [sourceContent, setSourceContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [tone, setTone] = useState("professional");
  const [language, setLanguage] = useState("en");
  const [customInstructions, setCustomInstructions] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [contextIdeas, setContextIdeas] = useState<string[]>([]);
  const [newContextIdea, setNewContextIdea] = useState("");

  // Batch state
  const [batchPlatforms, setBatchPlatforms] = useState<string[]>(["twitter", "linkedin"]);
  const [batchSource, setBatchSource] = useState("");

  // Publish state
  const [publishPostId, setPublishPostId] = useState<number | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  // tRPC queries & mutations
  const postsQuery = trpc.social.list.useQuery({ platform: filterPlatform !== "all" ? filterPlatform : undefined });
  const brandContextsQuery = trpc.brandContext.list.useQuery();
  const generateMutation = trpc.social.generate.useMutation({
    onSuccess: () => { toast.success("Post generated!"); postsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const batchMutation = trpc.social.batchGenerate.useMutation({
    onSuccess: (data) => { toast.success(`${data.posts.length} posts generated!`); postsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.social.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); postsQuery.refetch(); },
  });
  const publishMutation = trpc.social.publish.useMutation({
    onSuccess: () => { toast.success("Published via webhook!"); postsQuery.refetch(); setPublishPostId(null); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.social.update.useMutation({
    onSuccess: () => { toast.success("Updated"); postsQuery.refetch(); },
  });
  // Silent instances for bulk loops (no per-item toasts).
  const bulkUpdateMutation = trpc.social.update.useMutation();
  const bulkDeleteMutation = trpc.social.delete.useMutation();

  const posts = postsQuery.data || [];
  const filteredPosts = useMemo(() => {
    const list = posts.filter(p => !searchQuery || p.content.toLowerCase().includes(searchQuery.toLowerCase()));
    return [...list].sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "status") return (a.status || "").localeCompare(b.status || "");
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [posts, searchQuery, sortBy]);

  // Multi-select (visible-scoped, shared hook)
  const visibleIds = useMemo(() => filteredPosts.map(p => p.id), [filteredPosts]);
  const selection = useSelection<number>(visibleIds);

  const bulkSetStatus = async (status: string) => {
    if (selection.selectedList.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    for (const id of selection.selectedList) {
      try {
        await bulkUpdateMutation.mutateAsync({ id, status: status as "draft" | "approved" | "scheduled" | "published" });
        ok++;
      } catch { /* keep going */ }
    }
    await postsQuery.refetch();
    setBulkBusy(false);
    toast.success(`${ok}/${selection.selectedList.length} set to ${status}`);
  };

  const bulkDelete = async () => {
    if (selection.selectedList.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    for (const id of selection.selectedList) {
      try { await bulkDeleteMutation.mutateAsync({ id }); ok++; } catch { /* keep going */ }
    }
    await postsQuery.refetch();
    selection.clear();
    setBulkBusy(false);
    toast.success(`${ok} post(s) deleted`);
  };

  const handleGenerate = () => {
    if (!sourceContent.trim()) { toast.error("Provide source content"); return; }
    generateMutation.mutate({
      platform: platform as any,
      postType: postType as any,
      sourceContent,
      sourceUrl: sourceUrl || undefined,
      tone,
      language,
      customInstructions: customInstructions || undefined,
      contextIdeas: contextIdeas.length > 0 ? contextIdeas : undefined,
    });
  };

  const handleBatch = () => {
    if (!batchSource.trim()) { toast.error("Provide source content"); return; }
    if (batchPlatforms.length === 0) { toast.error("Select at least one platform"); return; }
    batchMutation.mutate({
      platforms: batchPlatforms as any[],
      sourceContent: batchSource,
      tone,
    });
  };

  const getPlatformInfo = (p: string) => PLATFORMS.find(x => x.value === p) || PLATFORMS[0];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-primary" />
              Social Content Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage social media content for X, LinkedIn, Facebook, Reddit & Threads
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{posts.length} posts</Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="create"><Plus className="w-3 h-3 mr-1" />Create</TabsTrigger>
            <TabsTrigger value="batch"><Zap className="w-3 h-3 mr-1" />Batch</TabsTrigger>
            <TabsTrigger value="posts"><Eye className="w-3 h-3 mr-1" />My Posts</TabsTrigger>
          </TabsList>

          {/* ─── Create Tab ──────────────────────────────── */}
          <TabsContent value="create" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: Config */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Platform</label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map(p => (
                          <SelectItem key={p.value} value={p.value}>
                            <span className="flex items-center gap-2">
                              <p.icon className={`w-3 h-3 ${p.color}`} />{p.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Post Type</label>
                    <Select value={postType} onValueChange={setPostType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {POST_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Tone</label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Source URL (optional)</label>
                    <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://..." />
                  </div>

                  {showAdvanced && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Language</label>
                        <Input value={language} onChange={e => setLanguage(e.target.value)} placeholder="en" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Custom Instructions</label>
                        <Textarea value={customInstructions} onChange={e => setCustomInstructions(e.target.value)}
                          placeholder="Any specific instructions..." rows={2} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Context Ideas</label>
                        <div className="flex gap-1 mb-1">
                          <Input value={newContextIdea} onChange={e => setNewContextIdea(e.target.value)}
                            placeholder="Specific idea to focus on" className="text-xs" />
                          <Button size="sm" variant="outline" onClick={() => {
                            if (newContextIdea.trim()) {
                              setContextIdeas(prev => [...prev, newContextIdea.trim()]);
                              setNewContextIdea("");
                            }
                          }}><Plus className="w-3 h-3" /></Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {contextIdeas.map((idea, i) => (
                            <Badge key={i} variant="secondary" className="text-xs cursor-pointer"
                              onClick={() => setContextIdeas(prev => prev.filter((_, idx) => idx !== i))}>
                              {idea} ×
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  <Button variant="ghost" size="sm" className="text-xs w-full"
                    onClick={() => setShowAdvanced(!showAdvanced)}>
                    {showAdvanced ? "Hide" : "Show"} Advanced Options
                  </Button>
                </CardContent>
              </Card>

              {/* Right: Source & Generate */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Source Content</CardTitle>
                  <CardDescription className="text-xs">Paste an article, key points, or topic you want to create a social post about</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea value={sourceContent} onChange={e => setSourceContent(e.target.value)}
                    placeholder="Paste your source article, key findings, or describe what you want to post about..."
                    rows={10} className="font-mono text-sm" />
                  <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="w-full">
                    {generateMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />Generate {getPlatformInfo(platform).label} Post</>
                    )}
                  </Button>

                  {/* Generated preview */}
                  {generateMutation.data && (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge className={getPlatformInfo(platform).bg}>
                            {getPlatformInfo(platform).label}
                          </Badge>
                          {generateMutation.data.score && (
                            <Badge variant="outline" className="text-xs">
                              Score: {Math.round(((generateMutation.data.score.engagement_potential || 0) +
                                (generateMutation.data.score.hook_strength || 0) +
                                (generateMutation.data.score.platform_fit || 0)) / 3)}/100
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{generateMutation.data.content}</p>
                        {generateMutation.data.threadParts && (
                          <div className="space-y-2 pl-3 border-l-2 border-primary/20">
                            {generateMutation.data.threadParts.map((part: string, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground">{i + 1}. {part}</p>
                            ))}
                          </div>
                        )}
                        {generateMutation.data.hashtags?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {generateMutation.data.hashtags.map((tag: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">#{tag}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline"
                            onClick={() => { navigator.clipboard.writeText(generateMutation.data.content); toast.success("Copied!"); }}>
                            <Copy className="w-3 h-3 mr-1" />Copy
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Batch Tab ───────────────────────────────── */}
          <TabsContent value="batch" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Multi-Platform Batch Generation
                </CardTitle>
                <CardDescription className="text-xs">Generate optimized posts for multiple platforms from one source</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Select Platforms</label>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(p => (
                      <Button key={p.value} size="sm"
                        variant={batchPlatforms.includes(p.value) ? "default" : "outline"}
                        onClick={() => setBatchPlatforms(prev =>
                          prev.includes(p.value)
                            ? prev.filter(x => x !== p.value)
                            : [...prev, p.value]
                        )}>
                        <p.icon className="w-3 h-3 mr-1" />{p.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Textarea value={batchSource} onChange={e => setBatchSource(e.target.value)}
                  placeholder="Paste source content..." rows={8} />
                <Button onClick={handleBatch} disabled={batchMutation.isPending} className="w-full">
                  {batchMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating {batchPlatforms.length} posts...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" />Generate for {batchPlatforms.length} Platforms</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Posts Tab ────────────────────────────────── */}
          <TabsContent value="posts" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search posts..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Platform" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Select-all + bulk actions */}
            {filteredPosts.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={selection.allSelected} onCheckedChange={selection.toggleAll} aria-label="Select all" />
                  Select all ({filteredPosts.length})
                </label>
                {selection.selected.size > 0 && <span className="text-primary font-medium">{selection.selected.size} selected</span>}
              </div>
            )}
            <SelectionBar
              count={selection.selected.size}
              statusOptions={POST_STATUSES.map(s => ({ value: s.value, label: s.label }))}
              onSetStatus={bulkSetStatus}
              onDelete={bulkDelete}
              deleteNoun="post"
              onClear={selection.clear}
              busy={bulkBusy}
            />

            {postsQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : filteredPosts.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                No posts yet. Create your first social post!
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredPosts.map(post => {
                  const pInfo = getPlatformInfo(post.platform);
                  return (
                    <Card key={post.id} className={`hover:border-primary/30 transition-colors ${selection.selected.has(post.id) ? "ring-2 ring-primary" : ""}`}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span onClick={e => e.stopPropagation()} className="shrink-0 flex items-center">
                              <Checkbox checked={selection.selected.has(post.id)} onCheckedChange={() => selection.toggle(post.id)} aria-label={`Select post ${post.id}`} />
                            </span>
                            <Badge className={pInfo.bg + " " + pInfo.color}>{pInfo.label}</Badge>
                            <Badge variant="outline" className="text-xs capitalize">{post.postType}</Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            {post.score && (
                              <Badge variant="secondary" className="text-xs">
                                <BarChart3 className="w-3 h-3 mr-1" />{post.score}
                              </Badge>
                            )}
                            <Badge variant="outline" className={`text-xs ${
                              post.status === "published" ? "text-green-400" :
                              post.status === "approved" ? "text-blue-400" :
                              "text-muted-foreground"
                            }`}>
                              {post.status}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap line-clamp-4">{post.content}</p>
                        {(post.hashtags as string[])?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(post.hashtags as string[]).map((tag, i) => (
                              <span key={i} className="text-xs text-primary/70">#{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost"
                              onClick={() => { navigator.clipboard.writeText(post.content); toast.success("Copied!"); }}>
                              <Copy className="w-3 h-3" />
                            </Button>
                            {post.status === "draft" && (
                              <Button size="sm" variant="ghost"
                                onClick={() => updateMutation.mutate({ id: post.id, status: "approved" })}>
                                <CheckCircle2 className="w-3 h-3" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost"
                              onClick={() => setPublishPostId(post.id)}>
                              <Send className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive"
                              onClick={() => deleteMutation.mutate({ id: post.id })}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Publish Dialog */}
        <Dialog open={!!publishPostId} onOpenChange={() => setPublishPostId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Webhook className="w-4 h-4" />Publish via Webhook
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://your-webhook-url.com/publish" />
              <p className="text-xs text-muted-foreground">
                Sends a POST request with the post content as JSON payload
              </p>
              <Button onClick={() => {
                if (publishPostId && webhookUrl) {
                  publishMutation.mutate({ postId: publishPostId, webhookUrl });
                }
              }} disabled={publishMutation.isPending} className="w-full">
                {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Publish
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
