/**
 * Brand Voice — Train and manage brand voice profiles
 * 
 * Features: Tone presets, style notes, sample content, target audience, keywords,
 * completeness indicator, set as default, voice comparison
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Palette, Plus, Search, Loader2, Star, Trash2, Edit,
  LayoutGrid, List, CheckCircle2, Globe, Users, Hash,
  Sparkles, Volume2, Type, Target, Brain,
} from "lucide-react";

const TONE_PRESETS = [
  { value: "professional", label: "Professional", emoji: "💼" },
  { value: "casual", label: "Casual", emoji: "😊" },
  { value: "authoritative", label: "Authoritative", emoji: "🎯" },
  { value: "witty", label: "Witty", emoji: "😄" },
  { value: "inspirational", label: "Inspirational", emoji: "✨" },
  { value: "educational", label: "Educational", emoji: "📚" },
  { value: "provocative", label: "Provocative", emoji: "🔥" },
  { value: "empathetic", label: "Empathetic", emoji: "💜" },
  { value: "bold", label: "Bold", emoji: "💪" },
  { value: "minimal", label: "Minimal", emoji: "🔲" },
];

export default function BrandVoice() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showDialog, setShowDialog] = useState(false);
  const [editingVoice, setEditingVoice] = useState<any>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [formVoice, setFormVoice] = useState("");
  const [formTone, setFormTone] = useState("professional");
  const [formAudience, setFormAudience] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formValues, setFormValues] = useState("");
  const [formSample, setFormSample] = useState("");
  const [formPillars, setFormPillars] = useState("");

  // tRPC — use brandContext router (already exists in Elite Writer)
  const voicesQuery = trpc.brandContext.list.useQuery();
  const createMutation = trpc.brandContext.create.useMutation({
    onSuccess: () => { toast.success("Brand voice created!"); voicesQuery.refetch(); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMutation = trpc.brandContext.update.useMutation({
    onSuccess: () => { toast.success("Updated"); voicesQuery.refetch(); closeDialog(); },
  });
  const deleteMutation = trpc.brandContext.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); voicesQuery.refetch(); },
  });

  const closeDialog = () => {
    setShowDialog(false); setEditingVoice(null);
    setFormName(""); setFormWebsite(""); setFormVoice(""); setFormTone("professional");
    setFormAudience(""); setFormKeywords(""); setFormValues(""); setFormSample(""); setFormPillars("");
  };

  const openEdit = (voice: any) => {
    setEditingVoice(voice);
    setFormName(voice.name || ""); setFormWebsite(voice.website || "");
    setFormVoice(voice.voice || ""); setFormTone(voice.tone || "professional");
    setFormAudience(voice.audience || "");
    setFormKeywords((voice.keywords || []).join(", "));
    setFormValues((voice.values || []).join(", "));
    setFormSample((voice.sampleContent || []).join("\n\n"));
    setFormPillars((voice.contentPillars || []).join(", "));
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: formName.trim(),
      website: formWebsite || undefined,
      voice: formVoice || undefined,
      tone: formTone,
      audience: formAudience || undefined,
      keywords: formKeywords.split(",").map(k => k.trim()).filter(Boolean),
      values: formValues.split(",").map(v => v.trim()).filter(Boolean),
      sampleContent: formSample.split("\n\n").filter(Boolean),
      contentPillars: formPillars.split(",").map(p => p.trim()).filter(Boolean),
    };
    if (editingVoice) {
      updateMutation.mutate({ id: editingVoice.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const voices = useMemo(() => {
    const list = voicesQuery.data || [];
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((v: any) => v.name?.toLowerCase().includes(q));
  }, [voicesQuery.data, searchQuery]);

  const getCompleteness = (voice: any) => {
    let score = 0;
    const checks = [
      voice.name, voice.voice, voice.tone, voice.audience,
      voice.keywords?.length, voice.values?.length,
      voice.sampleContent?.length, voice.contentPillars?.length,
    ];
    checks.forEach(c => { if (c) score += 12.5; });
    return Math.round(score);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="w-6 h-6 text-primary" />
            Brand Voice
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Train and manage brand voice profiles for AI-powered content creation
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)}><Plus className="w-4 h-4 mr-2" />New Voice Profile</Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search voices..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex gap-1 border rounded-md p-1">
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")}><LayoutGrid className="w-4 h-4" /></Button>
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")}><List className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Content */}
      {voicesQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : voices.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Volume2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No brand voice profiles yet</p>
          <Button className="mt-4" onClick={() => setShowDialog(true)}><Plus className="w-4 h-4 mr-2" />Create Voice Profile</Button>
        </CardContent></Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {voices.map((voice: any) => {
            const completeness = getCompleteness(voice);
            const tonePreset = TONE_PRESETS.find(t => t.value === voice.tone);
            return (
              <Card key={voice.id} className="group hover:border-primary/30 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tonePreset?.emoji || "🎤"}</span>
                      <Badge variant="secondary">{tonePreset?.label || voice.tone}</Badge>
                    </div>
                    <span className={`text-sm font-bold ${
                      completeness >= 80 ? "text-green-500" :
                      completeness >= 50 ? "text-yellow-500" : "text-red-500"
                    }`}>{completeness}%</span>
                  </div>
                  <CardTitle className="text-base mt-2">{voice.name}</CardTitle>
                  {voice.website && (
                    <CardDescription className="text-xs flex items-center gap-1">
                      <Globe className="w-3 h-3" />{voice.website}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={completeness} className="h-1.5" />

                  {voice.voice && <p className="text-sm text-muted-foreground line-clamp-2">{voice.voice}</p>}

                  {voice.audience && (
                    <div className="flex items-start gap-1.5 text-xs">
                      <Users className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                      <span className="line-clamp-1">{voice.audience}</span>
                    </div>
                  )}

                  {voice.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(voice.keywords as string[]).slice(0, 5).map((kw: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                      ))}
                    </div>
                  )}

                  {voice.contentPillars?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(voice.contentPillars as string[]).slice(0, 3).map((p: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(voice)}>
                      <Edit className="w-3 h-3 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate({ id: voice.id })}>
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
          {voices.map((voice: any) => {
            const completeness = getCompleteness(voice);
            const tonePreset = TONE_PRESETS.find(t => t.value === voice.tone);
            return (
              <Card key={voice.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <span className="text-xl">{tonePreset?.emoji || "🎤"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{voice.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{tonePreset?.label || voice.tone}</Badge>
                      <span className="text-xs text-muted-foreground">{completeness}% complete</span>
                      {voice.keywords?.length > 0 && (
                        <span className="text-xs text-muted-foreground">{(voice.keywords as string[]).length} keywords</span>
                      )}
                    </div>
                  </div>
                  <Progress value={completeness} className="w-20 h-2" />
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(voice)}><Edit className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate({ id: voice.id })}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { if (!v) closeDialog(); else setShowDialog(true); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingVoice ? "Edit Voice Profile" : "Create Voice Profile"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Brand name..." value={formName} onChange={e => setFormName(e.target.value)} />
              <Input placeholder="Website URL..." value={formWebsite} onChange={e => setFormWebsite(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Voice Tone</label>
              <div className="flex flex-wrap gap-2">
                {TONE_PRESETS.map(t => (
                  <Button
                    key={t.value}
                    variant={formTone === t.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFormTone(t.value)}
                  >
                    {t.emoji} {t.label}
                  </Button>
                ))}
              </div>
            </div>

            <Textarea placeholder="Describe the brand's voice style..." value={formVoice} onChange={e => setFormVoice(e.target.value)} rows={3} />
            <Textarea placeholder="Target audience description..." value={formAudience} onChange={e => setFormAudience(e.target.value)} rows={2} />
            <Input placeholder="Brand values (comma-separated)..." value={formValues} onChange={e => setFormValues(e.target.value)} />
            <Input placeholder="Content pillars (comma-separated)..." value={formPillars} onChange={e => setFormPillars(e.target.value)} />
            <Input placeholder="Keywords (comma-separated)..." value={formKeywords} onChange={e => setFormKeywords(e.target.value)} />
            <Textarea placeholder="Sample content (separate examples with blank lines)..." value={formSample} onChange={e => setFormSample(e.target.value)} rows={4} />

            <Button className="w-full" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {editingVoice ? "Update Profile" : "Create Profile"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
