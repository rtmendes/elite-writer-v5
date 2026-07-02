/**
 * Content Library — My Content + Asset Library + Image Presets
 * 
 * GistStack-inspired content management hub:
 * - Save social posts, article excerpts, quotes, templates
 * - Image library with brand consistency tracking
 * - Custom image prompt presets
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useSelection } from "@/hooks/useSelection";
import { SelectionBar } from "@/components/SelectionBar";
import {
  Library, Plus, Search, Loader2, Star, StarOff, Trash2,
  Copy, Image, FileText, Quote, Lightbulb, LayoutTemplate,
  Palette, Wand2, Tag,
} from "lucide-react";

const CONTENT_TYPES = [
  { value: "social_post", label: "Social Posts", icon: FileText },
  { value: "article_excerpt", label: "Excerpts", icon: FileText },
  { value: "quote", label: "Quotes", icon: Quote },
  { value: "idea", label: "Ideas", icon: Lightbulb },
  { value: "template", label: "Templates", icon: LayoutTemplate },
] as const;

export default function ContentLibrary() {
  const [tab, setTab] = useState("content");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Save form
  const [saveType, setSaveType] = useState<string>("idea");
  const [saveTitle, setSaveTitle] = useState("");
  const [saveContent, setSaveContent] = useState("");
  const [saveTags, setSaveTags] = useState("");

  // Image save form
  const [showImageSave, setShowImageSave] = useState(false);
  const [imageName, setImageName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageStyle, setImageStyle] = useState("");
  const [imageTags, setImageTags] = useState("");

  // Preset form
  const [showPresetSave, setShowPresetSave] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetPrefix, setPresetPrefix] = useState("");
  const [presetSuffix, setPresetSuffix] = useState("");
  const [presetModel, setPresetModel] = useState("");
  const [presetStyle, setPresetStyle] = useState("");

  // tRPC
  const contentQuery = trpc.library.content.list.useQuery({
    type: filterType !== "all" ? filterType : undefined,
    search: search || undefined,
  });
  const imagesQuery = trpc.library.images.list.useQuery({ search: search || undefined });
  const presetsQuery = trpc.library.presets.list.useQuery();

  const saveContentMut = trpc.library.content.save.useMutation({
    onSuccess: () => { toast.success("Saved!"); contentQuery.refetch(); setShowSaveDialog(false); resetSaveForm(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteContentMut = trpc.library.content.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); contentQuery.refetch(); },
  });
  const toggleStarMut = trpc.library.content.toggleStar.useMutation({
    onSuccess: () => contentQuery.refetch(),
  });
  const saveImageMut = trpc.library.images.save.useMutation({
    onSuccess: () => { toast.success("Image saved!"); imagesQuery.refetch(); setShowImageSave(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteImageMut = trpc.library.images.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); imagesQuery.refetch(); },
  });
  const savePresetMut = trpc.library.presets.save.useMutation({
    onSuccess: () => { toast.success("Preset saved!"); presetsQuery.refetch(); setShowPresetSave(false); },
    onError: (e) => toast.error(e.message),
  });
  const deletePresetMut = trpc.library.presets.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); presetsQuery.refetch(); },
  });

  // Bulk mutation instances (no per-item onSuccess toast — bulk handlers toast once)
  const bulkDeleteContentMut = trpc.library.content.delete.useMutation();
  const bulkDeleteImageMut = trpc.library.images.delete.useMutation();
  const bulkDeletePresetMut = trpc.library.presets.delete.useMutation();
  const [bulkBusy, setBulkBusy] = useState(false);

  const resetSaveForm = () => { setSaveTitle(""); setSaveContent(""); setSaveTags(""); };

  const [sortBy, setSortBy] = useState<'newest' | 'title' | 'type'>('newest');
  const contentItems = useMemo(() => {
    const list = contentQuery.data || [];
    if (sortBy === 'title') return [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sortBy === 'type') return [...list].sort((a, b) => (a.type || '').localeCompare(b.type || ''));
    return list;
  }, [contentQuery.data, sortBy]);
  const images = imagesQuery.data || [];
  const presets = presetsQuery.data || [];

  // Multi-select per tab (UI standard: every collection gets multi-select + bulk actions).
  // Library entities have no status concept, so bulk Delete only.
  const contentSel = useSelection(contentItems.map(i => i.id));
  const imagesSel = useSelection(images.map(i => i.id));
  const presetsSel = useSelection(presets.map(p => p.id));

  const bulkDeleteContent = async () => {
    setBulkBusy(true);
    let ok = 0;
    for (const id of contentSel.selectedList) {
      try { await bulkDeleteContentMut.mutateAsync({ id }); ok++; } catch { /* keep going */ }
    }
    await contentQuery.refetch();
    contentSel.clear();
    setBulkBusy(false);
    toast.success(`${ok} item(s) deleted`);
  };

  const bulkDeleteImages = async () => {
    setBulkBusy(true);
    let ok = 0;
    for (const id of imagesSel.selectedList) {
      try { await bulkDeleteImageMut.mutateAsync({ id }); ok++; } catch { /* keep going */ }
    }
    await imagesQuery.refetch();
    imagesSel.clear();
    setBulkBusy(false);
    toast.success(`${ok} image(s) deleted`);
  };

  const bulkDeletePresets = async () => {
    setBulkBusy(true);
    let ok = 0;
    for (const id of presetsSel.selectedList) {
      try { await bulkDeletePresetMut.mutateAsync({ id }); ok++; } catch { /* keep going */ }
    }
    await presetsQuery.refetch();
    presetsSel.clear();
    setBulkBusy(false);
    toast.success(`${ok} preset(s) deleted`);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Library className="w-6 h-6 text-primary" />
              Content Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your saved content, images, and prompt presets
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{contentItems.length} items</Badge>
            <Badge variant="outline">{images.length} images</Badge>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="content"><FileText className="w-3 h-3 mr-1" />My Content</TabsTrigger>
            <TabsTrigger value="images"><Image className="w-3 h-3 mr-1" />Asset Library</TabsTrigger>
            <TabsTrigger value="presets"><Palette className="w-3 h-3 mr-1" />Image Presets</TabsTrigger>
          </TabsList>

          {/* ─── Content Tab ─────────────────────────────── */}
          <TabsContent value="content" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search content..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {CONTENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="h-9 text-xs rounded-md border border-input bg-background px-2" title="Sort">
                <option value="newest">Newest</option>
                <option value="title">Title A→Z</option>
                <option value="type">Type</option>
              </select>
              <Button onClick={() => setShowSaveDialog(true)}><Plus className="w-4 h-4 mr-1" />Save New</Button>
            </div>

            {contentItems.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={contentSel.allSelected} onCheckedChange={contentSel.toggleAll} aria-label="Select all" />
                  Select all ({contentItems.length})
                </label>
                {contentSel.selected.size > 0 && <span className="text-primary font-medium">{contentSel.selected.size} selected</span>}
              </div>
            )}

            <SelectionBar
              count={contentSel.selected.size}
              onDelete={bulkDeleteContent}
              deleteNoun="item"
              onClear={contentSel.clear}
              busy={bulkBusy}
            />

            {contentQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : contentItems.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                No saved content yet. Save your best social posts, quotes, and ideas here!
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {contentItems.map(item => (
                  <Card key={item.id} className={`hover:border-primary/30 transition-colors ${contentSel.selected.has(item.id) ? "ring-2 ring-primary" : ""}`}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={contentSel.selected.has(item.id)}
                            onCheckedChange={() => contentSel.toggle(item.id)}
                            aria-label={`Select ${item.title || "item"}`}
                          />
                          <Badge variant="secondary" className="text-xs capitalize">{item.type.replace("_", " ")}</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => toggleStarMut.mutate({ id: item.id })}>
                            {item.starred ? <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> : <StarOff className="w-3 h-3" />}
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => { navigator.clipboard.writeText(item.content); toast.success("Copied!"); }}>
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => deleteContentMut.mutate({ id: item.id })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {item.title && <p className="text-sm font-medium">{item.title}</p>}
                      <p className="text-sm text-muted-foreground line-clamp-3">{item.content}</p>
                      {(item.tags as string[])?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(item.tags as string[]).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs"><Tag className="w-2 h-2 mr-1" />{tag}</Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Images Tab ──────────────────────────────── */}
          <TabsContent value="images" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search images..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button onClick={() => setShowImageSave(true)}><Plus className="w-4 h-4 mr-1" />Add Image</Button>
            </div>

            {images.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={imagesSel.allSelected} onCheckedChange={imagesSel.toggleAll} aria-label="Select all" />
                  Select all ({images.length})
                </label>
                {imagesSel.selected.size > 0 && <span className="text-primary font-medium">{imagesSel.selected.size} selected</span>}
              </div>
            )}

            <SelectionBar
              count={imagesSel.selected.size}
              onDelete={bulkDeleteImages}
              deleteNoun="image"
              onClear={imagesSel.clear}
              busy={bulkBusy}
            />

            {imagesQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : images.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                No images saved. Build your brand asset library!
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {images.map(img => (
                  <Card key={img.id} className={`overflow-hidden hover:border-primary/30 transition-colors group ${imagesSel.selected.has(img.id) ? "ring-2 ring-primary" : ""}`}>
                    <div className="aspect-square bg-muted relative">
                      <img src={img.imageUrl} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur rounded-md p-1.5" onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={imagesSel.selected.has(img.id)}
                          onCheckedChange={() => imagesSel.toggle(img.id)}
                          aria-label={`Select ${img.name}`}
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(img.imageUrl); toast.success("URL copied!"); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteImageMut.mutate({ id: img.id })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-2">
                      <p className="text-xs font-medium truncate">{img.name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {img.style && <Badge variant="outline" className="text-xs">{img.style}</Badge>}
                        {img.model && <Badge variant="secondary" className="text-xs">{img.model}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Presets Tab ─────────────────────────────── */}
          <TabsContent value="presets" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Save and reuse custom image prompt configurations for consistent brand imagery</p>
              <Button onClick={() => setShowPresetSave(true)}><Plus className="w-4 h-4 mr-1" />New Preset</Button>
            </div>

            {presets.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox checked={presetsSel.allSelected} onCheckedChange={presetsSel.toggleAll} aria-label="Select all" />
                  Select all ({presets.length})
                </label>
                {presetsSel.selected.size > 0 && <span className="text-primary font-medium">{presetsSel.selected.size} selected</span>}
              </div>
            )}

            <SelectionBar
              count={presetsSel.selected.size}
              onDelete={bulkDeletePresets}
              deleteNoun="preset"
              onClear={presetsSel.clear}
              busy={bulkBusy}
            />

            {presetsQuery.isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : presets.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                No presets yet. Create reusable image prompt templates!
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {presets.map(preset => (
                  <Card key={preset.id} className={presetsSel.selected.has(preset.id) ? "ring-2 ring-primary" : ""}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={presetsSel.selected.has(preset.id)}
                            onCheckedChange={() => presetsSel.toggle(preset.id)}
                            aria-label={`Select ${preset.name}`}
                          />
                          <h3 className="text-sm font-medium flex items-center gap-2">
                            <Wand2 className="w-4 h-4 text-primary" />{preset.name}
                          </h3>
                        </div>
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => deletePresetMut.mutate({ id: preset.id })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      {preset.promptPrefix && (
                        <div className="text-xs"><span className="text-muted-foreground">Prefix: </span><code className="bg-muted px-1 rounded">{preset.promptPrefix}</code></div>
                      )}
                      {preset.promptSuffix && (
                        <div className="text-xs"><span className="text-muted-foreground">Suffix: </span><code className="bg-muted px-1 rounded">{preset.promptSuffix}</code></div>
                      )}
                      <div className="flex gap-1">
                        {preset.model && <Badge variant="outline" className="text-xs">{preset.model}</Badge>}
                        {preset.style && <Badge variant="secondary" className="text-xs">{preset.style}</Badge>}
                        {preset.characterConsistency ? <Badge className="text-xs bg-green-500/10 text-green-400">Consistent</Badge> : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Save Content Dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>Save to Library</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={saveType} onValueChange={setSaveType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="Title (optional)" />
              <Textarea value={saveContent} onChange={e => setSaveContent(e.target.value)} placeholder="Content..." rows={5} />
              <Input value={saveTags} onChange={e => setSaveTags(e.target.value)} placeholder="Tags (comma-separated)" />
              <Button onClick={() => saveContentMut.mutate({
                type: saveType as any, title: saveTitle || undefined,
                content: saveContent, tags: saveTags.split(",").map(t => t.trim()).filter(Boolean),
              })} disabled={saveContentMut.isPending} className="w-full">
                {saveContentMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Save Image Dialog */}
        <Dialog open={showImageSave} onOpenChange={setShowImageSave}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Image to Library</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={imageName} onChange={e => setImageName(e.target.value)} placeholder="Image name" />
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Image URL" />
              <Textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="Prompt used (optional)" rows={2} />
              <div className="grid grid-cols-2 gap-2">
                <Input value={imageStyle} onChange={e => setImageStyle(e.target.value)} placeholder="Style" />
                <Input value={imageTags} onChange={e => setImageTags(e.target.value)} placeholder="Tags (comma-sep)" />
              </div>
              <Button onClick={() => saveImageMut.mutate({
                name: imageName, imageUrl, prompt: imagePrompt || undefined,
                style: imageStyle || undefined, tags: imageTags.split(",").map(t => t.trim()).filter(Boolean),
              })} disabled={saveImageMut.isPending} className="w-full">Save Image</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Save Preset Dialog */}
        <Dialog open={showPresetSave} onOpenChange={setShowPresetSave}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Image Preset</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Preset name" />
              <Textarea value={presetPrefix} onChange={e => setPresetPrefix(e.target.value)} placeholder="Prompt prefix (added before your prompt)" rows={2} />
              <Textarea value={presetSuffix} onChange={e => setPresetSuffix(e.target.value)} placeholder="Prompt suffix (added after your prompt)" rows={2} />
              <div className="grid grid-cols-2 gap-2">
                <Input value={presetModel} onChange={e => setPresetModel(e.target.value)} placeholder="AI Model" />
                <Input value={presetStyle} onChange={e => setPresetStyle(e.target.value)} placeholder="Style" />
              </div>
              <Button onClick={() => savePresetMut.mutate({
                name: presetName, promptPrefix: presetPrefix || undefined,
                promptSuffix: presetSuffix || undefined, model: presetModel || undefined, style: presetStyle || undefined,
              })} disabled={savePresetMut.isPending} className="w-full">Save Preset</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
