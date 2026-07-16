/**
 * Content Studio — Multi-platform content creation, enrichment & publishing
 *
 * Enhanced: brand filter, image preview, offer/affiliate links, metadata panel,
 * hooks display, target audience, AI enrichment status, bulk actions
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ListSelectionBar, SelectCheck, useSelection } from "@/components/list-selection";
import { EditDrawer, type FieldDef } from "@/components/admin/EditDrawer";
import { SavedViewBar, type ViewConfig } from "@/components/admin/SavedViewBar";
import {
  PenTool, Plus, Search, Loader2, LayoutGrid, List, Copy,
  Send, Trash2, Edit, Eye, CheckCircle2, Clock, Archive,
  FileText, Linkedin, Twitter, Instagram, Facebook, Hash,
  Globe, Mail, Newspaper, Sparkles, Image, Link2, Target,
  Zap, Tag, ExternalLink, Building2, TrendingUp,
} from "lucide-react";

/* ─── Constants ──────────────────────────────────────────── */
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

const BRAND_COLORS: Record<string, string> = {
  InsightProfit: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "Funded First": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "Family Gift Studio": "bg-pink-500/10 text-pink-600 border-pink-500/20",
  "Faith Promises": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "Second Spring": "bg-violet-500/10 text-violet-600 border-violet-500/20",
};

/* ─── EditDrawer fields (short-content: full record incl. body) ─── */
const STUDIO_FIELDS: FieldDef[] = [
  { key: "title", label: "Title", type: "text", group: "Content" },
  { key: "body", label: "Body", type: "textarea", rows: 10, group: "Content", placeholder: "Write the full content…" },
  { key: "tags", label: "Tags", type: "tags", group: "Content" },
  { key: "status", label: "Status", type: "select", group: "Meta", options: STATUSES.map(s => ({ value: s.value, label: s.label })) },
  { key: "platform", label: "Platform", type: "select", group: "Meta", options: PLATFORMS.map(p => ({ value: p.value, label: p.label })) },
  { key: "contentType", label: "Content Type", type: "select", group: "Meta", options: CONTENT_TYPES.map(t => ({ value: t.value, label: t.label })) },
  { key: "createdAt", label: "Created", type: "readonly", group: "Pipeline", format: (v) => (v ? new Date(String(v)).toLocaleString() : "—") },
];

/* ─── Helper: parse studioMeta safely ────────────────────── */
function parseMeta(item: any) {
  if (!item) return null;
  // Backend may return studioMeta as JSON string or parsed object
  const raw = item.studioMeta || item.metadata;
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

/* ─── Component ──────────────────────────────────────────── */
export default function ContentStudio() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [sortBy, setSortBy] = useState<"updated" | "title" | "status">("updated");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [drawerItem, setDrawerItem] = useState<any>(null);
  const [activeViewId, setActiveViewId] = useState<number | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formPlatform, setFormPlatform] = useState("linkedin");
  const [formType, setFormType] = useState("post");
  const [formHashtags, setFormHashtags] = useState("");
  const [formCta, setFormCta] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formPublishUrl, setFormPublishUrl] = useState("");
  const [formBrandId, setFormBrandId] = useState("none");

  // tRPC queries
  const brandsQuery = trpc.studio.listBrands.useQuery();
  const itemsQuery = trpc.studio.list.useQuery({
    platform: filterPlatform !== "all" ? filterPlatform : undefined,
    contentType: filterType !== "all" ? filterType : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
    brandId: filterBrand !== "all" ? parseInt(filterBrand) : undefined,
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

  const brandMap = useMemo(() => {
    const m: Record<number, string> = {};
    (brandsQuery.data || []).forEach((b: any) => { m[b.id] = b.name; });
    return m;
  }, [brandsQuery.data]);

  const closeDialog = () => {
    setShowCreateDialog(false);
    setEditingItem(null);
    setFormTitle(""); setFormBody(""); setFormPlatform("linkedin");
    setFormType("post"); setFormHashtags(""); setFormCta("");
    setFormImageUrl(""); setFormPublishUrl(""); setFormBrandId("none");
  };

  const openEdit = (item: any) => {
    const meta = parseMeta(item);
    setEditingItem(item);
    setFormTitle(item.title); setFormBody(item.body || "");
    setFormPlatform(item.platform); setFormType(item.contentType);
    setFormHashtags(meta?.hashtags?.join(", ") || item.metadata?.hashtags?.join(", ") || "");
    setFormCta(meta?.cta || item.metadata?.cta || "");
    setFormImageUrl(item.imageUrl || "");
    setFormPublishUrl(item.publishUrl || "");
    setFormBrandId(item.brandId ? String(item.brandId) : "none");
    setShowCreateDialog(true);
  };

  const handleSave = () => {
    if (!formTitle.trim()) { toast.error("Title is required"); return; }
    const metadata = {
      hashtags: formHashtags.split(",").map(h => h.trim()).filter(Boolean),
      cta: formCta || undefined,
    };
    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id, title: formTitle, body: formBody,
        platform: formPlatform, contentType: formType, metadata,
        imageUrl: formImageUrl || undefined,
        publishUrl: formPublishUrl || undefined,
      });
    } else {
      createMutation.mutate({
        title: formTitle, body: formBody,
        platform: formPlatform, contentType: formType, metadata,
        imageUrl: formImageUrl || undefined,
        brandId: formBrandId !== "none" ? parseInt(formBrandId) : undefined,
      });
    }
  };

  const items = useMemo(() => {
    let list = itemsQuery.data || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i: any) => i.title?.toLowerCase().includes(q) || i.body?.toLowerCase().includes(q));
    }
    return [...list].sort((a: any, b: any) => {
      if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
      if (sortBy === "status") return (a.status || "").localeCompare(b.status || "");
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
  }, [itemsQuery.data, searchQuery, sortBy]);

  const { selected, toggle, allSelected, toggleAll, clear } = useSelection(
    useMemo(() => items.map((i: any) => ({ id: i.id as number })), [items])
  );

  // Stable drawer record — synthesize `tags` from metadata.hashtags for editing.
  const drawerRecord = useMemo(
    () => (drawerItem ? { ...drawerItem, tags: parseMeta(drawerItem)?.hashtags ?? [] } : null),
    [drawerItem]
  );

  // Saved-views: current snapshot + apply handler wired to page state.
  const currentConfig: ViewConfig = {
    search: searchQuery,
    filters: { platform: filterPlatform, contentType: filterType, status: filterStatus, brand: filterBrand },
    sort: { field: sortBy, dir: "desc" },
    mode: viewMode === "grid" ? "gallery" : "list",
  };
  const applyView = (id: number | null, config: ViewConfig | null) => {
    setActiveViewId(id);
    if (!config) {
      setSearchQuery(""); setFilterPlatform("all"); setFilterType("all");
      setFilterStatus("all"); setFilterBrand("all"); setSortBy("updated"); setViewMode("grid");
      return;
    }
    setSearchQuery(config.search ?? "");
    const f = config.filters ?? {};
    setFilterPlatform((f.platform as string) ?? "all");
    setFilterType((f.contentType as string) ?? "all");
    setFilterStatus((f.status as string) ?? "all");
    setFilterBrand((f.brand as string) ?? "all");
    if (config.sort?.field) setSortBy(config.sort.field as typeof sortBy);
    if (config.mode) setViewMode(config.mode === "list" ? "list" : "grid");
  };

  const bulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} item${selected.size === 1 ? "" : "s"}?`)) return;
    for (const id of selected) await deleteMutation.mutateAsync({ id: id as number });
    clear();
    toast.success("Deleted");
  };
  const bulkSetStatus = async (status: string) => {
    for (const id of selected) await updateMutation.mutateAsync({ id: id as number, status });
    clear();
    toast.success(`Updated ${selected.size} item(s)`);
  };

  const charLimit = PLATFORMS.find(p => p.value === formPlatform)?.charLimit || 3000;
  const charCount = formBody.length;
  const charPct = Math.min((charCount / charLimit) * 100, 100);

  // Enrichment stats
  const enrichedCount = useMemo(() => {
    return (itemsQuery.data || []).filter((i: any) => {
      const m = parseMeta(i);
      return m?.enriched;
    }).length;
  }, [itemsQuery.data]);

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
            {(itemsQuery.data || []).length} pieces · {enrichedCount} enriched · {Object.keys(brandMap).length} brands
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />New Content
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search content..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={filterBrand} onValueChange={setFilterBrand}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Brands" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {(brandsQuery.data || []).map((b: any) => (
              <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="h-9 text-xs rounded-md border border-input bg-background px-2" title="Sort">
          <option value="updated">Recently updated</option>
          <option value="title">Title A→Z</option>
          <option value="status">Status</option>
        </select>
        <div className="flex gap-1 border rounded-md p-1">
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")}>
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <SavedViewBar
        page="content-studio"
        currentConfig={currentConfig}
        activeViewId={activeViewId}
        onApply={applyView}
      />

      <ListSelectionBar
        selected={selected}
        clear={clear}
        onDelete={bulkDelete}
        statusOptions={STATUSES.map(s => ({ value: s.value, label: s.label }))}
        onSetStatus={bulkSetStatus}
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {STATUSES.map(s => {
          const count = (itemsQuery.data || []).filter((i: any) => i.status === s.value).length;
          return (
            <Card key={s.value} className={`cursor-pointer hover:border-primary/30 ${filterStatus === s.value ? "border-primary" : ""}`} onClick={() => setFilterStatus(filterStatus === s.value ? "all" : s.value)}>
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
          <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />Create Content
          </Button>
        </CardContent></Card>
      ) : viewMode === "grid" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <SelectCheck checked={allSelected} onToggle={toggleAll} title="Select all" />
            <span>Select all</span>
          </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item: any) => {
            const platObj = PLATFORMS.find(p => p.value === item.platform);
            const PlatIcon = platObj?.icon || Globe;
            const statusObj = STATUSES.find(s => s.value === item.status);
            const meta = parseMeta(item);
            const brandName = item.brandId ? brandMap[item.brandId] : null;
            const brandColor = brandName ? (BRAND_COLORS[brandName] || "bg-muted text-muted-foreground") : "";
            return (
              <Card key={item.id} className={`group hover:border-primary/30 transition-colors overflow-hidden ${selected.has(item.id) ? "ring-1 ring-primary/40" : ""}`}>
                {/* Image Preview */}
                {item.imageUrl && (
                  <div className="h-40 w-full overflow-hidden bg-muted relative">
                    <div className="absolute top-2 left-2 z-10" onClick={e => e.stopPropagation()}>
                      <SelectCheck checked={selected.has(item.id)} onToggle={() => toggle(item.id)} />
                    </div>
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!item.imageUrl && (
                        <SelectCheck checked={selected.has(item.id)} onToggle={() => toggle(item.id)} />
                      )}
                      <PlatIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Badge variant="outline" className="text-xs">{item.contentType}</Badge>
                      {brandName && (
                        <Badge variant="outline" className={`text-xs ${brandColor}`}>
                          <Building2 className="w-3 h-3 mr-1" />{brandName}
                        </Badge>
                      )}
                    </div>
                    <Badge className={`text-xs shrink-0 ${statusObj?.color || ""}`}>{statusObj?.label || item.status}</Badge>
                  </div>
                  <CardTitle className="text-base mt-2 line-clamp-2 cursor-pointer hover:text-primary" onClick={() => setDetailItem(item)}>
                    {item.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.body && <p className="text-sm text-muted-foreground line-clamp-3">{item.body}</p>}

                  {/* Metadata badges */}
                  {meta?.enriched && (
                    <div className="space-y-2">
                      {meta.hashtags?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(meta.hashtags as string[]).slice(0, 5).map((tag: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">#{tag}</Badge>
                          ))}
                          {meta.hashtags.length > 5 && (
                            <Badge variant="secondary" className="text-xs">+{meta.hashtags.length - 5}</Badge>
                          )}
                        </div>
                      )}
                      {meta.cta && (
                        <p className="text-xs text-primary/80 flex items-center gap-1">
                          <Target className="w-3 h-3" />{meta.cta.slice(0, 80)}{meta.cta.length > 80 ? "…" : ""}
                        </p>
                      )}
                      {meta.offers?.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Link2 className="w-3 h-3 text-emerald-500" />
                          <span className="text-xs text-emerald-600">{meta.offers.length} offer{meta.offers.length > 1 ? "s" : ""} linked</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.charCount || 0} chars</span>
                    <div className="flex items-center gap-2">
                      {meta?.enriched && <Sparkles className="w-3 h-3 text-amber-500" />}
                      <span>{platObj?.label}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setDrawerItem(item)}>
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
        </div>
      ) : (
        /* ─── List View ──────────────────────────────────── */
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <SelectCheck checked={allSelected} onToggle={toggleAll} title="Select all" />
            <span>Select all</span>
          </div>
          {items.map((item: any) => {
            const platObj = PLATFORMS.find(p => p.value === item.platform);
            const PlatIcon = platObj?.icon || Globe;
            const statusObj = STATUSES.find(s => s.value === item.status);
            const meta = parseMeta(item);
            const brandName = item.brandId ? brandMap[item.brandId] : null;
            const brandColor = brandName ? (BRAND_COLORS[brandName] || "bg-muted text-muted-foreground") : "";
            return (
              <Card key={item.id} className={`hover:border-primary/30 transition-colors ${selected.has(item.id) ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <SelectCheck checked={selected.has(item.id)} onToggle={() => toggle(item.id)} className="shrink-0" />
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                  ) : (
                    <PlatIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate cursor-pointer hover:text-primary" onClick={() => setDetailItem(item)}>{item.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {brandName && <Badge variant="outline" className={`text-xs ${brandColor}`}>{brandName}</Badge>}
                      <Badge variant="outline" className="text-xs">{item.contentType}</Badge>
                      <Badge className={`text-xs ${statusObj?.color || ""}`}>{statusObj?.label}</Badge>
                      <span className="text-xs text-muted-foreground">{item.charCount || 0} chars</span>
                      {meta?.enriched && <Sparkles className="w-3 h-3 text-amber-500" />}
                      {meta?.offers?.length > 0 && <Link2 className="w-3 h-3 text-emerald-500" />}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setDrawerItem(item)}><Edit className="w-3 h-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(item.body || ""); toast.success("Copied!"); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate({ id: item.id })}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Detail / Preview Dialog ───────────────────── */}
      <Dialog open={!!detailItem} onOpenChange={v => { if (!v) setDetailItem(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailItem && (() => {
            const meta = parseMeta(detailItem);
            const brandName = detailItem.brandId ? brandMap[detailItem.brandId] : null;
            const platObj = PLATFORMS.find(p => p.value === detailItem.platform);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl">{detailItem.title}</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="content" className="mt-4">
                  <TabsList>
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="metadata">Metadata & SEO</TabsTrigger>
                    <TabsTrigger value="offers">Offers & Links</TabsTrigger>
                  </TabsList>

                  {/* Content Tab */}
                  <TabsContent value="content" className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {brandName && <Badge variant="outline">{brandName}</Badge>}
                      <Badge variant="outline">{platObj?.label}</Badge>
                      <Badge variant="outline">{detailItem.contentType}</Badge>
                      <Badge>{detailItem.status}</Badge>
                    </div>
                    {detailItem.imageUrl && (
                      <img src={detailItem.imageUrl} alt="" className="w-full max-h-64 object-cover rounded-lg" />
                    )}
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap bg-muted/50 rounded-lg p-4 max-h-[400px] overflow-y-auto">
                      {detailItem.body}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => { openEdit(detailItem); setDetailItem(null); }}>
                        <Edit className="w-4 h-4 mr-2" />Edit
                      </Button>
                      <Button variant="outline" onClick={() => { navigator.clipboard.writeText(detailItem.body || ""); toast.success("Copied!"); }}>
                        <Copy className="w-4 h-4 mr-2" />Copy
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Metadata Tab */}
                  <TabsContent value="metadata" className="space-y-4">
                    {meta?.enriched ? (
                      <>
                        {/* Hashtags */}
                        <div>
                          <h4 className="text-sm font-semibold flex items-center gap-1 mb-2"><Tag className="w-4 h-4" />Hashtags</h4>
                          <div className="flex flex-wrap gap-1">
                            {(meta.hashtags || []).map((tag: string, i: number) => (
                              <Badge key={i} variant="secondary">#{tag}</Badge>
                            ))}
                          </div>
                        </div>

                        {/* Hooks */}
                        {meta.hooks?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold flex items-center gap-1 mb-2"><Zap className="w-4 h-4" />Hook Variations</h4>
                            <div className="space-y-2">
                              {meta.hooks.map((hook: string, i: number) => (
                                <div key={i} className="p-3 bg-muted/50 rounded-lg text-sm flex items-start gap-2">
                                  <span className="text-xs bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                  <span>{hook}</span>
                                  <Button size="sm" variant="ghost" className="shrink-0 ml-auto" onClick={() => { navigator.clipboard.writeText(hook); toast.success("Hook copied!"); }}>
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* CTA */}
                        {meta.cta && (
                          <div>
                            <h4 className="text-sm font-semibold flex items-center gap-1 mb-2"><Target className="w-4 h-4" />Call to Action</h4>
                            <p className="p-3 bg-primary/5 border border-primary/10 rounded-lg text-sm">{meta.cta}</p>
                          </div>
                        )}

                        {/* Target Audience */}
                        {meta.targetAudience && (
                          <div>
                            <h4 className="text-sm font-semibold flex items-center gap-1 mb-2"><TrendingUp className="w-4 h-4" />Target Audience</h4>
                            <p className="text-sm text-muted-foreground">{meta.targetAudience}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>No AI metadata yet — enrichment may still be in progress</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Offers Tab */}
                  <TabsContent value="offers" className="space-y-4">
                    {meta?.offers?.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-1"><Link2 className="w-4 h-4" />Linked Offers</h4>
                        {meta.offers.map((offer: any, i: number) => (
                          <Card key={i}>
                            <CardContent className="p-4 flex items-center justify-between">
                              <div>
                                <p className="font-medium">{offer.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">{offer.type}</Badge>
                                  <a href={offer.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                    {offer.url} <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(offer.url); toast.success("URL copied!"); }}>
                                <Copy className="w-3 h-3 mr-1" />Copy
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>No offers linked yet</p>
                      </div>
                    )}
                    {detailItem.publishUrl && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Publish URL</h4>
                        <a href={detailItem.publishUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                          {detailItem.publishUrl} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ─── Create / Edit Dialog ────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={v => { if (!v) closeDialog(); else setShowCreateDialog(true); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingItem ? "Edit Content" : "Create Content"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <Input placeholder="Title..." value={formTitle} onChange={e => setFormTitle(e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
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
              <Select value={formBrandId} onValueChange={setFormBrandId}>
                <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Brand</SelectItem>
                  {(brandsQuery.data || []).map((b: any) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image URL */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-muted-foreground" />
                <Input placeholder="Image URL..." value={formImageUrl} onChange={e => setFormImageUrl(e.target.value)} />
              </div>
              {formImageUrl && (
                <img src={formImageUrl} alt="Preview" className="w-full max-h-40 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>

            {/* Body */}
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

            {/* Publish / Offer URL */}
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              <Input placeholder="Publish URL or affiliate link..." value={formPublishUrl} onChange={e => setFormPublishUrl(e.target.value)} />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {editingItem ? "Update Content" : "Create Content"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Drawer (Payload-style, autosave) ───────── */}
      <EditDrawer
        open={!!drawerItem}
        onClose={() => setDrawerItem(null)}
        title={drawerItem?.title ?? "Content"}
        record={drawerRecord as unknown as Record<string, unknown> | null}
        fields={STUDIO_FIELDS}
        onSave={async (patch) => {
          if (!drawerItem) return;
          const upd: any = { id: drawerItem.id };
          if ("title" in patch) upd.title = patch.title;
          if ("body" in patch) upd.body = patch.body;
          if ("status" in patch) upd.status = patch.status;
          if ("platform" in patch) upd.platform = patch.platform;
          if ("contentType" in patch) upd.contentType = patch.contentType;
          if ("tags" in patch) upd.metadata = { ...(parseMeta(drawerItem) || {}), hashtags: patch.tags };
          await updateMutation.mutateAsync(upd);
          await itemsQuery.refetch();
        }}
      />
    </div>
  );
}
