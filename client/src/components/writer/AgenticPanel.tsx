/**
 * AgenticPanel — AI-powered autonomous writing panel
 * Controls: model selection, autonomous draft, enhance, rewrite, fact-check, SEO, continue
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Sparkles, Bot, Zap, RefreshCw, ShieldCheck, Search,
  PenTool, ArrowRight, Loader2, Wand2, Brain, RotateCcw,
} from 'lucide-react';

interface AgenticPanelProps {
  title: string;
  content: string;
  onContentUpdate: (content: string) => void;
  onTitleUpdate: (title: string) => void;
  targetPublication?: string;
  brandVoice?: string;
  template?: string;
}

export function AgenticPanel({
  title, content, onContentUpdate, onTitleUpdate,
  targetPublication, brandVoice, template,
}: AgenticPanelProps) {
  const [selectedModel, setSelectedModel] = useState('claude-sonnet');
  const [activeTab, setActiveTab] = useState('draft');
  const [topic, setTopic] = useState('');
  const [rewriteStyle, setRewriteStyle] = useState<string>('journalistic');
  const [enhanceInstruction, setEnhanceInstruction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const modelsQuery = trpc.agentic.models.useQuery();
  const autonomousDraft = trpc.agentic.autonomousDraft.useMutation();
  const enhanceSection = trpc.agentic.enhanceSection.useMutation();
  const rewrite = trpc.agentic.rewrite.useMutation();
  const factCheck = trpc.agentic.factCheck.useMutation();
  const optimizeSEO = trpc.agentic.optimizeSEO.useMutation();
  const continueWriting = trpc.agentic.continueWriting.useMutation();

  const models = modelsQuery.data?.models || [];
  const isBusy = autonomousDraft.isPending || enhanceSection.isPending ||
                 rewrite.isPending || factCheck.isPending || optimizeSEO.isPending || continueWriting.isPending;

  const handleAutonomousDraft = async () => {
    const draftTopic = topic || title;
    if (!draftTopic.trim()) { toast.error('Enter a topic or article title'); return; }
    try {
      const result = await autonomousDraft.mutateAsync({
        topic: draftTopic,
        targetPublication,
        brandVoice,
        template,
        model: selectedModel,
        wordCount: 2000,
        depth: 'standard',
      });
      if (result.success && result.content) {
        onContentUpdate(result.content);
        if (result.headline) onTitleUpdate(result.headline);
        setLastResult({ type: 'draft', research: result.research, outline: result.outline, usage: result.usage });
        toast.success(`Autonomous draft complete — ${result.wordCount} words, ${result.usage?.totalTokens || 0} tokens`);
      }
    } catch (err: any) {
      toast.error('Autonomous draft failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleEnhance = async () => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    if (!enhanceInstruction.trim()) { toast.error('Enter an enhancement instruction'); return; }
    try {
      const result = await enhanceSection.mutateAsync({
        content,
        instruction: enhanceInstruction,
        model: selectedModel,
        targetPublication,
      });
      if (result.success) {
        onContentUpdate(result.enhancedContent);
        toast.success('Content enhanced');
      }
    } catch (err: any) {
      toast.error('Enhancement failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleRewrite = async () => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await rewrite.mutateAsync({
        content,
        style: rewriteStyle as any,
        model: selectedModel,
        targetPublication,
      });
      if (result.success) {
        onContentUpdate(result.rewrittenContent);
        toast.success(`Rewritten in ${rewriteStyle} style`);
      }
    } catch (err: any) {
      toast.error('Rewrite failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleFactCheck = async () => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await factCheck.mutateAsync({ content, model: selectedModel });
      if (result.success) {
        setLastResult({ type: 'factCheck', data: result.data });
        toast.success(`Fact check complete — ${result.data?.overallConfidence || 0}% confidence`);
      }
    } catch (err: any) {
      toast.error('Fact check failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleSEO = async () => {
    if (!content.trim() || !title.trim()) { toast.error('Need title and content'); return; }
    try {
      const result = await optimizeSEO.mutateAsync({ title, content, model: selectedModel });
      if (result.success) {
        setLastResult({ type: 'seo', data: result.data });
        toast.success(`SEO analysis: ${result.data?.currentScore || 0}/100`);
      }
    } catch (err: any) {
      toast.error('SEO optimization failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleContinue = async () => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await continueWriting.mutateAsync({
        content,
        model: selectedModel,
        wordCount: 300,
        brandVoice,
        targetPublication,
      });
      if (result.success) {
        onContentUpdate(content + '\n\n' + result.continuation);
        toast.success('Content continued');
      }
    } catch (err: any) {
      toast.error('Continue failed: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-3 p-3">
      {/* Model Selector */}
      <div>
        <label className="text-[11px] font-medium text-muted-foreground mb-1 block">AI Model</label>
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="h-8 text-xs">
            <Brain className="w-3 h-3 mr-1.5 text-purple-400" />
            <SelectValue placeholder="Select model..." />
          </SelectTrigger>
          <SelectContent>
            {models.map(m => (
              <SelectItem key={m.id} value={m.id}>
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground ml-2 text-[10px]">{m.provider}</span>
              </SelectItem>
            ))}
            {models.length === 0 && (
              <SelectItem value="claude-sonnet">Claude Sonnet 4</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3 h-8">
          <TabsTrigger value="draft" className="text-[10px]">Draft</TabsTrigger>
          <TabsTrigger value="enhance" className="text-[10px]">Enhance</TabsTrigger>
          <TabsTrigger value="tools" className="text-[10px]">Tools</TabsTrigger>
        </TabsList>

        {/* Autonomous Draft Tab */}
        <TabsContent value="draft" className="space-y-2 mt-2">
          <Input
            placeholder="Topic for autonomous draft..."
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="text-xs h-8"
          />
          <Button
            className="w-full h-9 text-xs gap-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            onClick={handleAutonomousDraft}
            disabled={isBusy}
          >
            {autonomousDraft.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            {autonomousDraft.isPending ? 'Researching & Writing...' : 'Autonomous Draft'}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            AI researches the topic, creates an outline, and writes a complete article
          </p>

          <Button
            variant="outline" size="sm"
            className="w-full h-8 text-xs gap-1.5"
            onClick={handleContinue}
            disabled={isBusy || !content.trim()}
          >
            {continueWriting.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
            Continue Writing (+300 words)
          </Button>

          {/* Research results from last draft */}
          {lastResult?.type === 'draft' && lastResult.research && (
            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardContent className="p-2 space-y-1.5">
                <p className="text-[10px] font-semibold text-purple-400">Research Findings</p>
                {lastResult.research.keyFacts?.slice(0, 3).map((f: string, i: number) => (
                  <p key={i} className="text-[10px] text-muted-foreground">• {f}</p>
                ))}
                {lastResult.research.statistics?.slice(0, 2).map((s: any, i: number) => (
                  <p key={i} className="text-[10px] text-blue-400">📊 {s.stat} ({s.source})</p>
                ))}
                {lastResult.usage && (
                  <p className="text-[9px] text-muted-foreground/60 font-mono">
                    {lastResult.usage.totalTokens?.toLocaleString()} tokens used
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Enhance Tab */}
        <TabsContent value="enhance" className="space-y-2 mt-2">
          <Input
            placeholder="Enhancement instruction..."
            value={enhanceInstruction}
            onChange={e => setEnhanceInstruction(e.target.value)}
            className="text-xs h-8"
          />
          <Button
            className="w-full h-8 text-xs gap-1.5"
            variant="outline"
            onClick={handleEnhance}
            disabled={isBusy || !content.trim()}
          >
            {enhanceSection.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            Enhance Content
          </Button>

          <div className="grid grid-cols-2 gap-1.5">
            <Select value={rewriteStyle} onValueChange={setRewriteStyle}>
              <SelectTrigger className="h-8 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="journalistic">Journalistic</SelectItem>
                <SelectItem value="storytelling">Storytelling</SelectItem>
                <SelectItem value="data-driven">Data-Driven</SelectItem>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="persuasive">Persuasive</SelectItem>
                <SelectItem value="conversational">Conversational</SelectItem>
                <SelectItem value="executive">Executive Brief</SelectItem>
                <SelectItem value="simplify">Simplify</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm"
              className="h-8 text-[10px] gap-1"
              onClick={handleRewrite}
              disabled={isBusy || !content.trim()}
            >
              {rewrite.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Rewrite
            </Button>
          </div>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-2 mt-2">
          <Button
            variant="outline" size="sm"
            className="w-full h-8 text-xs gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10"
            onClick={handleFactCheck}
            disabled={isBusy || !content.trim()}
          >
            {factCheck.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
            Fact Check
          </Button>

          <Button
            variant="outline" size="sm"
            className="w-full h-8 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            onClick={handleSEO}
            disabled={isBusy || !content.trim() || !title.trim()}
          >
            {optimizeSEO.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            SEO Optimization
          </Button>

          {/* Fact Check Results */}
          {lastResult?.type === 'factCheck' && lastResult.data && (
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-green-400">Fact Check Results</p>
                  <Badge variant="outline" className="text-[9px] font-mono">
                    {lastResult.data.overallConfidence}% confidence
                  </Badge>
                </div>
                {lastResult.data.claims?.slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px]">
                    <span className={c.status === 'verified' ? 'text-green-400' : c.status === 'questionable' ? 'text-amber-400' : 'text-red-400'}>
                      {c.status === 'verified' ? '✓' : c.status === 'questionable' ? '⚠' : '✗'}
                    </span>
                    <span className="text-muted-foreground">{c.claim?.slice(0, 80)}{c.claim?.length > 80 ? '...' : ''}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* SEO Results */}
          {lastResult?.type === 'seo' && lastResult.data && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-amber-400">SEO Analysis</p>
                  <Badge variant="outline" className="text-[9px] font-mono">
                    {lastResult.data.currentScore}/100
                  </Badge>
                </div>
                {lastResult.data.optimizedTitle && (
                  <div className="text-[10px]">
                    <span className="text-muted-foreground">Better title: </span>
                    <button
                      className="text-blue-400 hover:underline"
                      onClick={() => { onTitleUpdate(lastResult.data.optimizedTitle); toast.success('Title updated'); }}
                    >
                      {lastResult.data.optimizedTitle}
                    </button>
                  </div>
                )}
                {lastResult.data.metaDescription && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Meta: {lastResult.data.metaDescription}
                  </p>
                )}
                {lastResult.data.contentSuggestions?.slice(0, 3).map((s: string, i: number) => (
                  <p key={i} className="text-[10px] text-muted-foreground">• {s}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
