/**
 * Content Studio — Multi-platform content creation and management
 * 
 * Features: 9 platforms × 8 content types × 6 statuses, char count,
 * copy/publish workflow, grid/list views, multi-select filters
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  PenTool, Plus, Search, Loader2, LayoutGrid, List, Copy,
  Send, Trash2, Edit, Eye, CheckCircle2, Clock, Archive,
  FileText, Linkedin, Twitter, Instagram, Facebook, Hash,
  Globe, Mail, Newspaper, Sparkles,
} from "lucide-react";

const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, charLimit: 3000 },
  { value: "twitter", label: "X / Twitter", icon: Twitter, charLimit: 280 },
  { value: "instagram", label: "Instagram", icon: Instagram, charLimit: 2200 },
  { value: "facebook", label: "Facebook", icon: Facebook, charLimit: 63206 },
  { value: "bluesky", label: "Bluesky", icon: Globe, charLimit: 300 },
  { value: "blog", label: "Blog", icon: FileText, charLimit: 50000 },
  { value: "newsletter", label: "Newsletter", icon: Mail, charLimit: 50000 },
  { value: "threads", label: "Threads", icon: Hash, charLimit: 500 },
  { value: "press", label: "Press Release", icon: Newspaper, charLimit: 50000 },
];

const CONTENT_TYPES = [
  { value: "post", label: "Post" },
  { value: "thread", label: "Thread" },
  { value: "article", label: "Article" },
  { value: "carousel", label: "Carousel" },
  { value: "story", label: "Story" },
  { value: "reel", label: "Reel" },
  { value: "press_release", label: "Press Release" },
  { value: "newsletter", label: "Newsletter" },
];

const STATUSES = [
  { value: "draft", label: "Draft", icon: Edit, color: "bg-slate-500/10 text-slate-500" },
  { value: "review", label: "Review", icon: Eye, color: "bg-yellow-500/10 text-yellow-500" },
  { value: "approved", label: "Approved", icon: CheckCircle2, color: "bg-green-500/10 text-green-500" },
  { value: "scheduled", label: "Scheduled", icon: Clock, color: "bg-blue-500/10 text-blue-500" },
  { value: "published", label: "Published", icon: Send, color: "bg-purple-500/10 text-purple-500" },
  { value: "archived", label: "Archived", icon: Archive, color: "bg-muted text-muted-foreground" },
];

export default function ContentStudio() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formPlatform, setFormPlatform] = useState("linkedin");
  const [formType, setFormType] = useState("post");
  const [formHashtags, setFormHashtags] = useState("");
  const [formCta, setFormCta] = useState("");

  // tRPC
  const itemsQuery = trpc.studio.list.useQuery({
    platform: filterPlatform !== "all" ? filterPlatform : undefined,
    contentType: filterType !== "all" ? filterType : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
  });
  const createMutation = trpc.studio.create.useMutation({
    onSuccess: () => { toast.success("Content created!"); itemsQuery.refetch(); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMutation = trpc.studio.update.useMutation({
    onSuccess: () => { toast.success("Updated"); itemsQuery.refetch(); closeDialog(); },
  });
  const deleteMutation = trpc.studio.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); itemsQuery.refetch(); },
  });
  const publishMutation = trpc.studio.publish.useMutation({
    onSuccess: () => { toast.success("Published!"); itemsQuery.refetch(); },
  });

  const closeDialog = () => {
    setShowCreateDialog(false);
    setEditingItem(null);
    setFormTitle(""); setFormBody(""); setFormPlatform("linkedin");
    setFormType("post"); setFormHashtags(""); setFormCta("");
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setFormTitle(item.title); setFormBody(item.body || "");
    setFormPlatform(item.platform); setFormType(item.contentType);
    setFormHashtags(item.metadata?.hashtags?.join(", ") || "");
    setFormCta(item.metadata?.cta || "");
    setShowCreateDialog(true);
  };

  const handleSave = () => {
    if (!formTitle.trim()) { toast.error("Title is required"); return; }
    const metadata = {
      hashtags: formHashtags.split(",").map(h => h.trim()).filter(Boolean),
      cta: formCta || undefined,
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, title: formTitle, body: formBody, platform: formPlatform, contentType: formType, metadata });
    } else {
      createMutation.mutate({ title: formTitle, body: formBody, platform: formPlatform, contentType: formType, metadata });
    }
  };

  const items = useMemo(() => {
    const list = itemsQuery.data || [];
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((i: any) => i.title?.toLowerCase().includes(q) || i.body?.toLowerCase().includes(q));
  }, [itemsQuery.data, searchQuery]);

  const charLimit = PLATFORMS.find(p => p.value === formPlatform)?.charLimit || 3000;
  const charCount = formBody.length;
  const charPct = Math.min((charCount / charLimit) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PenTool className="w-6 h-6 text-primary" />
            Content Studio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, manage, and publish content across 9 platforms
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}><Plus className="w-4 h-4 mr-2" />New Content</Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search content..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={filterPlatform} onValueChange={setFilterPlatform}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CONTENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1 border rounded-md p-1">
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")}><LayoutGrid className="w-4 h-4" /></Button>
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")}><List className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {STATUSES.map(s => {
          const count = (itemsQuery.data || []).filter((i: any) => i.status === s.value).length;
          return (
            <Card key={s.value} className="cursor-pointer hover:border-primary/30" onClick={() => setFilterStatus(s.value)}>
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Content */}
      {itemsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <PenTool className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No content items yet</p>
          <Button className="mt-4" onClick={() => setShowCreateDialog(true)}><Plus className="w-4 h-4 mr-2" />Create Content</Button>
        </CardContent></Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item: any) => {
            const platObj = PLATFORMS.find(p => p.value === item.platform);
            const PlatIcon = platObj?.icon || Globe;
            const statusObj = STATUSES.find(s => s.value === item.status);
            return (
              <Card key={item.id} className="group hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PlatIcon className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="outline" className="text-xs">{item.contentType}</Badge>
                    </div>
                    <Badge className={`text-xs ${statusObj?.color || ""}`}>{statusObj?.label || item.status}</Badge>
                  </div>
                  <CardTitle className="text-base mt-2 line-clamp-2">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.body && <p className="text-sm text-muted-foreground line-clamp-3">{item.body}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.charCount || 0} chars</span>
                    <span>{platObj?.label}</span>
                  </div>
                  {item.metadata?.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(item.metadata.hashtags as string[]).slice(0, 4).map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">#{tag}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(item)}>
                      <Edit className="w-3 h-3 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(item.body || ""); toast.success("Copied!"); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    {item.status !== "published" && (
                      <Button size="sm" variant="default" onClick={() => publishMutation.mutate({ id: item.id })}>
                        <Send className="w-3 h-3" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate({ id: item.id })}>
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
          {items.map((item: any) => {
            const platObj = PLATFORMS.find(p => p.value === item.platform);
            const PlatIcon = platObj?.icon || Globe;
            const statusObj = STATUSES.find(s => s.value === item.status);
            return (
              <Card key={item.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <PlatIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{item.contentType}</Badge>
                      <Badge className={`text-xs ${statusObj?.color || ""}`}>{statusObj?.label}</Badge>
                      <span className="text-xs text-muted-foreground">{item.charCount || 0} chars</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Edit className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate({ id: item.id })}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={v => { if (!v) closeDialog(); else setShowCreateDialog(true); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? "Edit Content" : "Create Content"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <Input placeholder="Title..." value={formTitle} onChange={e => setFormTitle(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={formPlatform} onValueChange={setFormPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Textarea placeholder="Write your content..." value={formBody} onChange={e => setFormBody(e.target.value)} rows={8} className="min-h-[200px]" />
              <div className="flex items-center justify-between mt-1">
                <span className={`text-xs ${charCount > charLimit ? "text-destructive" : "text-muted-foreground"}`}>
                  {charCount.toLocaleString()} / {charLimit.toLocaleString()} chars
                </span>
                <div className="w-32 bg-muted rounded-full h-1.5">
                  <div className={`rounded-full h-1.5 transition-all ${charPct > 100 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(charPct, 100)}%` }} />
                </div>
              </div>
            </div>
            <Input placeholder="Hashtags (comma-separated)..." value={formHashtags} onChange={e => setFormHashtags(e.target.value)} />
            <Input placeholder="Call-to-action..." value={formCta} onChange={e => setFormCta(e.target.value)} />
            <Button className="w-full" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {editingItem ? "Update Content" : "Create Content"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
