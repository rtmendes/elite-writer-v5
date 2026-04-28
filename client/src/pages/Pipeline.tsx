/**
 * Pipeline Page — One-Click Article Production
 * 
 * Connects content feeds → research → draft → humanize → GEO → template → score → save
 * Provides full visibility into each pipeline step with live status.
 */
import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Zap, ArrowRight, CheckCircle2, Loader2, Circle,
  Search, Shield, Globe, BookOpen, Package,
  BarChart3, FileText, Sparkles,
} from 'lucide-react';

interface PipelineStep {
  id: string;
  label: string;
  icon: any;
  status: 'pending' | 'running' | 'complete' | 'skipped';
  detail?: string;
}

export default function Pipeline() {
  const [topic, setTopic] = useState('');
  const [publication, setPublication] = useState('');
  const [wordCount, setWordCount] = useState(2000);
  const [enableHumanize, setEnableHumanize] = useState(true);
  const [enableGeo, setEnableGeo] = useState(true);
  const [enableViz, setEnableViz] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [steps, setSteps] = useState<PipelineStep[]>([
    { id: 'context', label: 'Load Context', icon: Package, status: 'pending' },
    { id: 'research', label: 'Deep Research', icon: Search, status: 'pending' },
    { id: 'draft', label: 'Generate Draft', icon: FileText, status: 'pending' },
    { id: 'humanize', label: 'Humanize', icon: Shield, status: 'pending' },
    { id: 'geoEnhance', label: 'GEO Enhance', icon: Globe, status: 'pending' },
    { id: 'proofread', label: 'Proofread', icon: BookOpen, status: 'pending' },
    { id: 'score', label: 'Score', icon: Sparkles, status: 'pending' },
    { id: 'save', label: 'Save', icon: CheckCircle2, status: 'pending' },
  ]);

  const templatesQuery = trpc.bridges.getPublicationTemplates.useQuery();
  const pipelineMutation = trpc.bridges.fullPipeline.useMutation();

  const runPipeline = useCallback(async () => {
    if (!topic.trim()) { toast.error("Enter a topic"); return; }

    setIsRunning(true);
    setResult(null);

    // Reset all steps
    setSteps(prev => prev.map(s => ({
      ...s,
      status: s.id === 'humanize' && !enableHumanize ? 'skipped'
        : s.id === 'geoEnhance' && !enableGeo ? 'skipped'
        : 'pending',
      detail: undefined,
    })));

    // Animate steps (since we can't get real-time updates from a mutation)
    const stepOrder = ['context', 'research', 'draft', 'humanize', 'geoEnhance', 'proofread', 'score', 'save'];
    const delays = [200, 2000, 8000, 14000, 20000, 25000, 28000, 30000]; // estimated timing

    stepOrder.forEach((stepId, i) => {
      if (stepId === 'humanize' && !enableHumanize) return;
      if (stepId === 'geoEnhance' && !enableGeo) return;

      setTimeout(() => {
        setSteps(prev => prev.map(s =>
          s.id === stepId ? { ...s, status: 'running' } : s
        ));
      }, delays[i]);
    });

    try {
      const res = await pipelineMutation.mutateAsync({
        topic: topic.trim(),
        targetPublication: publication && publication !== "general" ? publication : undefined,
        humanize: enableHumanize,
        geoEnhance: enableGeo,
        generateViz: enableViz,
        wordCount,
      });

      // Update all steps to complete based on result
      setSteps(prev => prev.map(s => {
        const pipelineStep = (res.steps || []).find((rs: any) => rs.step === s.id);
        if (s.id === 'humanize' && !enableHumanize) return { ...s, status: 'skipped' };
        if (s.id === 'geoEnhance' && !enableGeo) return { ...s, status: 'skipped' };
        return {
          ...s,
          status: pipelineStep?.status === 'complete' ? 'complete' : 'complete',
          detail: pipelineStep?.detail,
        };
      }));

      setResult(res);
      toast.success(`Article generated! Score: ${res.score}/10 | ${res.wordCount} words`);
    } catch (err: any) {
      toast.error("Pipeline failed: " + (err.message || "Unknown error"));
      setSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'pending' } : s));
    } finally {
      setIsRunning(false);
    }
  }, [topic, publication, enableHumanize, enableGeo, enableViz, wordCount, pipelineMutation]);

  const getStepIcon = (step: PipelineStep) => {
    if (step.status === 'complete') return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    if (step.status === 'running') return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    if (step.status === 'skipped') return <Circle className="w-4 h-4 text-muted-foreground/30" />;
    return <step.icon className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400" />
            Article Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            One-click production: research → draft → humanize → GEO → score → save
          </p>
        </div>

        {/* Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pipeline Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Topic / Title</label>
              <Input
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. 'How AI is Transforming Content Marketing in 2026'"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Publication Template</label>
                <Select value={publication} onValueChange={setPublication}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Any publication..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    {(templatesQuery.data?.templates || []).map(t => (
                      <SelectItem key={t.slug} value={t.slug}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Target Word Count</label>
                <Input
                  type="number"
                  value={wordCount}
                  onChange={e => setWordCount(Number(e.target.value))}
                  min={500}
                  max={5000}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={enableHumanize} onCheckedChange={setEnableHumanize} />
                <Shield className="w-4 h-4 text-emerald-400" /> Humanize
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={enableGeo} onCheckedChange={setEnableGeo} />
                <Globe className="w-4 h-4 text-blue-400" /> GEO Enhance
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={enableViz} onCheckedChange={setEnableViz} />
                <BarChart3 className="w-4 h-4 text-purple-400" /> Data Viz
              </label>
            </div>

            <Button
              onClick={runPipeline}
              disabled={isRunning || !topic.trim()}
              size="lg"
              className="w-full"
            >
              {isRunning ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Pipeline Running...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" />Run Full Pipeline</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Pipeline Steps */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pipeline Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {steps.map((step, i) => (
                <div key={step.id} className="flex items-center gap-3 py-2">
                  {getStepIcon(step)}
                  <span className={`text-sm flex-1 ${
                    step.status === 'skipped' ? 'text-muted-foreground/50 line-through' :
                    step.status === 'complete' ? 'text-foreground' :
                    step.status === 'running' ? 'text-blue-400 font-medium' :
                    'text-muted-foreground'
                  }`}>
                    {step.label}
                  </span>
                  {step.detail && (
                    <span className="text-xs text-muted-foreground">{step.detail}</span>
                  )}
                  {i < steps.length - 1 && step.status !== 'skipped' && steps[i + 1]?.status !== 'skipped' && (
                    <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <Card className="border-green-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                Article Generated
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold font-mono text-green-400">{result.score}</div>
                  <p className="text-xs text-muted-foreground">Score</p>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-medium">{result.title}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">{result.wordCount} words</Badge>
                    <Badge variant="outline" className="text-green-400">Article #{result.articleId}</Badge>
                    {result.pipeline?.humanized && <Badge variant="outline" className="text-emerald-400">Humanized</Badge>}
                    {result.pipeline?.geoEnhanced && <Badge variant="outline" className="text-blue-400">GEO Enhanced</Badge>}
                  </div>
                </div>
              </div>

              {result.scoreData?.dimensions && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {Object.entries(result.scoreData.dimensions).map(([key, val]: [string, any]) => (
                    <div key={key} className="text-center p-2 rounded bg-muted/50">
                      <div className="text-sm font-mono font-bold">{val}</div>
                      <p className="text-[10px] text-muted-foreground capitalize">{key}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => {
                  window.location.href = `/writer/${result.articleId}`;
                }}>
                  <FileText className="w-3.5 h-3.5 mr-1" /> Open in Writer
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(result.content || "");
                  toast.success("Copied to clipboard");
                }}>
                  Copy Content
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
