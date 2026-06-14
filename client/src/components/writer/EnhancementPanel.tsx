/**
 * EnhancementPanel — Integration bridges UI for the Writer sidebar
 * 
 * Provides one-click access to:
 * 1. AI Humanizer (detect + humanize in-place)
 * 2. GEO Enhancement (boost AI search visibility)
 * 3. Publication Templates (restructure for specific publication)
 * 4. Product Integration (weave products into content)
 * 5. Full Pipeline (one-click: all enhancements)
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Shield, Globe, BookOpen, Loader2,
  ArrowUp, ArrowDown, CheckCircle2, Zap,
} from 'lucide-react';

interface EnhancementPanelProps {
  articleId: number | null;
  title: string;
  content: string;
  onContentUpdate: (newContent: string) => void;
}

export function EnhancementPanel({ articleId, title, content, onContentUpdate }: EnhancementPanelProps) {
  const [activeTab, setActiveTab] = useState("humanize");
  const [humanizeIntensity, setHumanizeIntensity] = useState<"light" | "moderate" | "heavy">("moderate");
  const [selectedPubTemplate, setSelectedPubTemplate] = useState("");
  const [geoKeywords, setGeoKeywords] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const humanizeMutation = trpc.bridges.humanizeArticle.useMutation();
  const geoEnhanceMutation = trpc.bridges.geoEnhanceArticle.useMutation();
  const templateMutation = trpc.bridges.applyPublicationTemplate.useMutation();
  const templatesQuery = trpc.bridges.getPublicationTemplates.useQuery();

  const handleHumanize = async () => {
    if (!articleId) { toast.error("Save article first"); return; }
    setIsProcessing(true);
    try {
      const result = await humanizeMutation.mutateAsync({
        articleId,
        intensity: humanizeIntensity,
      });
      setLastResult({
        type: "humanize",
        before: result.beforeAiScore,
        after: result.afterAiScore,
        improvement: result.improvement,
      });
      toast.success(`Humanized! AI score: ${result.beforeAiScore}→${result.afterAiScore} (${result.improvement > 0 ? "-" : "+"}${Math.abs(result.improvement)} points)`);
      // Trigger content refresh
      onContentUpdate("");
    } catch (err: any) {
      toast.error("Humanization failed: " + (err.message || "Try again"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGeoEnhance = async () => {
    if (!articleId) { toast.error("Save article first"); return; }
    setIsProcessing(true);
    try {
      const keywords = geoKeywords.split(",").map(k => k.trim()).filter(Boolean);
      const result = await geoEnhanceMutation.mutateAsync({
        articleId,
        targetKeywords: keywords.length > 0 ? keywords : undefined,
      });
      setLastResult({
        type: "geo",
        before: result.before,
        after: result.after,
      });
      toast.success(`GEO enhanced! Score: ${result.before.geo}→${result.after.geo}`);
      onContentUpdate("");
    } catch (err: any) {
      toast.error("GEO enhancement failed: " + (err.message || "Try again"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!articleId) { toast.error("Save article first"); return; }
    if (!selectedPubTemplate) { toast.error("Select a publication"); return; }
    setIsProcessing(true);
    try {
      const result = await templateMutation.mutateAsync({
        articleId,
        publicationSlug: selectedPubTemplate,
      });
      setLastResult({
        type: "template",
        publication: result.publication,
        wordCount: result.wordCount,
        inRange: result.inRange,
      });
      toast.success(`Restructured for ${result.publication} (${result.wordCount} words)`);
      onContentUpdate("");
    } catch (err: any) {
      toast.error("Template failed: " + (err.message || "Try again"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold">Enhancement Pipeline</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full h-8">
          <TabsTrigger value="humanize" className="text-xs px-1">
            <Shield className="w-3 h-3 mr-1" />Humanize
          </TabsTrigger>
          <TabsTrigger value="geo" className="text-xs px-1">
            <Globe className="w-3 h-3 mr-1" />GEO
          </TabsTrigger>
          <TabsTrigger value="template" className="text-xs px-1">
            <BookOpen className="w-3 h-3 mr-1" />Template
          </TabsTrigger>
        </TabsList>

        {/* ─── Humanizer Tab ─── */}
        <TabsContent value="humanize" className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            Detect AI patterns and rewrite to sound naturally human.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Intensity</label>
            <div className="flex gap-1">
              {(["light", "moderate", "heavy"] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setHumanizeIntensity(level)}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-colors ${
                    humanizeIntensity === level
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {humanizeIntensity === "light" && "Subtle adjustments — 95% original structure preserved"}
              {humanizeIntensity === "moderate" && "Natural voice rewrite — core arguments intact"}
              {humanizeIntensity === "heavy" && "Full rewrite with authentic personal voice"}
            </p>
          </div>

          <Button
            onClick={handleHumanize}
            disabled={isProcessing || !articleId}
            size="sm"
            className="w-full"
          >
            {isProcessing && activeTab === "humanize" ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Humanizing...</>
            ) : (
              <><Shield className="w-3.5 h-3.5 mr-1.5" />Humanize Article</>
            )}
          </Button>

          {lastResult?.type === "humanize" && (
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-2">
                <div className="flex items-center justify-between text-xs">
                  <span>AI Detection Score</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-red-400">{lastResult.before}</Badge>
                    <ArrowDown className="w-3 h-3 text-green-400" />
                    <Badge variant="outline" className="text-green-400">{lastResult.after}</Badge>
                  </div>
                </div>
                <p className="text-[10px] text-green-400 mt-1">
                  <CheckCircle2 className="w-3 h-3 inline mr-0.5" />
                  {lastResult.improvement} point improvement
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── GEO Enhancement Tab ─── */}
        <TabsContent value="geo" className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            Boost AI search visibility with structured data, FAQs, and citation signals.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Target Keywords (optional)</label>
            <input
              type="text"
              value={geoKeywords}
              onChange={e => setGeoKeywords(e.target.value)}
              placeholder="keyword1, keyword2, ..."
              className="w-full px-2 py-1.5 text-xs rounded border bg-background"
            />
          </div>

          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <p>Enhancements applied:</p>
            <ul className="list-disc pl-3">
              <li>Key Takeaways section</li>
              <li>Quotable definitions for AI citation</li>
              <li>Attributed claims with sources</li>
              <li>FAQ section (schema-ready)</li>
              <li>Structured data signals</li>
            </ul>
          </div>

          <Button
            onClick={handleGeoEnhance}
            disabled={isProcessing || !articleId}
            size="sm"
            className="w-full"
          >
            {isProcessing && activeTab === "geo" ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Enhancing...</>
            ) : (
              <><Globe className="w-3.5 h-3.5 mr-1.5" />GEO Enhance</>
            )}
          </Button>

          {lastResult?.type === "geo" && (
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-2 space-y-1">
                {["geo", "aeo", "seo"].map(metric => (
                  <div key={metric} className="flex items-center justify-between text-xs">
                    <span className="uppercase font-medium">{metric}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">{lastResult.before[metric]}</span>
                      <ArrowUp className="w-3 h-3 text-blue-400" />
                      <span className="text-blue-400 font-medium">{lastResult.after[metric]}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Publication Template Tab ─── */}
        <TabsContent value="template" className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            Restructure your article to match a specific publication's format and tone.
          </p>

          <Select value={selectedPubTemplate} onValueChange={setSelectedPubTemplate}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select publication..." />
            </SelectTrigger>
            <SelectContent>
              {(templatesQuery.data?.templates || []).map(t => (
                <SelectItem key={t.slug} value={t.slug} className="text-xs">
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPubTemplate && templatesQuery.data?.templates && (() => {
            const t = templatesQuery.data.templates.find(t => t.slug === selectedPubTemplate);
            if (!t) return null;
            return (
              <div className="text-[10px] text-muted-foreground space-y-1 bg-muted/50 rounded p-2">
                <p className="font-medium text-foreground">{t.name} Structure:</p>
                <ol className="list-decimal pl-3 space-y-0.5">
                  {t.structure.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
                <p className="mt-1"><strong>Words:</strong> {t.wordRange[0]}-{t.wordRange[1]}</p>
                <p><strong>Tone:</strong> {t.toneRules.slice(0, 100)}...</p>
              </div>
            );
          })()}

          <Button
            onClick={handleApplyTemplate}
            disabled={isProcessing || !articleId || !selectedPubTemplate}
            size="sm"
            className="w-full"
          >
            {isProcessing && activeTab === "template" ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Applying...</>
            ) : (
              <><BookOpen className="w-3.5 h-3.5 mr-1.5" />Apply Template</>
            )}
          </Button>

          {lastResult?.type === "template" && (
            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardContent className="p-2">
                <p className="text-xs">
                  <CheckCircle2 className="w-3 h-3 inline mr-0.5 text-purple-400" />
                  Restructured for <strong>{lastResult.publication}</strong>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {lastResult.wordCount} words
                  {lastResult.inRange
                    ? <Badge variant="outline" className="ml-1 text-green-400 text-[9px]">In range</Badge>
                    : <Badge variant="outline" className="ml-1 text-amber-400 text-[9px]">Outside range</Badge>
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {!articleId && (
        <p className="text-[10px] text-amber-400 text-center">
          Save article first to enable enhancements
        </p>
      )}
    </div>
  );
}
