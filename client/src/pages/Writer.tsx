import { useState, useCallback, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import {
  PenTool, Save, Send, BarChart3, BookOpen, Target,
  Sparkles, ChevronRight, FileText, Zap, Eye, Download, Building2, Loader2
} from 'lucide-react';
import { PUBLICATIONS, matchPublications, type Publication } from '@/lib/publications-data';
import { scoreArticleLocally, DIMENSION_LABELS, getScoreColor, getScoreBgColor, getTierFromScore } from '@/lib/scoring';
import { TEMPLATES, BRAND_VOICES, type WritingTemplate } from '@/lib/templates';
import type { ArticleScores } from '@/lib/store';

export default function Writer() {
  const { state, addArticle, updateArticle } = useApp();
  const [, navigate] = useLocation();

  // tRPC mutations
  const scoreMutation = trpc.ai.score.useMutation();
  const draftMutation = trpc.ai.draft.useMutation();
  const saveArticleMutation = trpc.data.articles.create.useMutation();
  const updateArticleMutation = trpc.data.articles.update.useMutation();
  const [dbArticleId, setDbArticleId] = useState<number | null>(null);

  // Editor state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('data-journalism');
  const [selectedBrand, setSelectedBrand] = useState('insight-profit');
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null);
  const [pubSearch, setPubSearch] = useState('');
  const [showPubDropdown, setShowPubDropdown] = useState(false);
  const [scores, setScores] = useState<ArticleScores | null>(null);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState('score');
  const [aiScoreResult, setAiScoreResult] = useState<any>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>(state.brands[0]?.id || '');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  const activeBrandObj = useMemo(() => state.brands.find(b => b.id === selectedBrandId), [state.brands, selectedBrandId]);
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const template = TEMPLATES.find(t => t.id === selectedTemplate);

  // Auto-score locally on content change (debounced)
  useEffect(() => {
    if (wordCount < 50) { setScores(null); return; }
    const timer = setTimeout(() => {
      const newScores = scoreArticleLocally(content, selectedPub?.name);
      setScores(newScores);
    }, 1000);
    return () => clearTimeout(timer);
  }, [content, selectedPub, wordCount]);

  // Publication search
  const pubResults = useMemo(() => {
    if (!pubSearch.trim()) return [];
    return PUBLICATIONS.filter(p =>
      p.name.toLowerCase().includes(pubSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(pubSearch.toLowerCase()) ||
      p.topics.toLowerCase().includes(pubSearch.toLowerCase())
    ).slice(0, 8);
  }, [pubSearch]);

  // Matched publications based on score
  const matchedPubs = useMemo(() => {
    if (!scores || wordCount < 100) return [];
    const category = selectedPub?.category || 'Business';
    return matchPublications(title + ' ' + content.slice(0, 500), category, scores.overall).slice(0, 10);
  }, [scores, title, content, selectedPub, wordCount]);

  // AI Score via backend
  const handleAiScore = async () => {
    if (wordCount < 50) { toast.error('Write at least 50 words first'); return; }
    try {
      const result = await scoreMutation.mutateAsync({
        title,
        content,
        targetPublication: selectedPub?.name,
        brandVoice: BRAND_VOICES.find(b => b.id === selectedBrand)?.name,
      });
      if (result.success && result.data) {
        setAiScoreResult(result.data);
        // Map AI scores to local format
        const d = result.data.dimensions || {};
        const aiScores: ArticleScores = {
          clarity_structure: Math.round((d.clarity?.score || 50) / 10),
          hook_engagement: Math.round((d.hook?.score || 50) / 10),
          voice_tone: Math.round((d.voice?.score || 50) / 10),
          data_evidence: Math.round((d.evidence?.score || 50) / 10),
          originality_angle: Math.round((d.originality?.score || 50) / 10),
          publication_fit: Math.round((d.authority?.score || 50) / 10),
          timeliness: Math.round((d.timeliness?.score || 50) / 10),
          actionability: Math.round((d.actionability?.score || 50) / 10),
          expertise_depth: Math.round((d.depth?.score || 50) / 10),
          readability: Math.round((d.structure?.score || 50) / 10),
          conclusion_cta: Math.round((d.seo?.score || 50) / 10),
          overall: Math.round((result.data.overall || 50) / 10),
        };
        setScores(aiScores);
        const tokens = result.usage?.total_tokens || 0;
        toast.success(`AI scored: ${result.data.overall}/100 (${tokens} tokens)`);
      }
    } catch (err: any) {
      toast.error('AI scoring failed: ' + (err.message || 'Unknown error'));
    }
  };

  // AI Draft via backend
  const handleAiDraft = async () => {
    if (!title.trim()) { toast.error('Add a title first'); return; }
    try {
      const tmpl = TEMPLATES.find(t => t.id === selectedTemplate);
      const brand = BRAND_VOICES.find(b => b.id === selectedBrand);
      const result = await draftMutation.mutateAsync({
        topic: title,
        template: tmpl?.name,
        brandVoice: brand?.name,
        targetPublication: selectedPub?.name,
        outline: content.slice(0, 2000) || undefined,
        wordCount: template?.wordCountRange[1] || 1500,
      });
      if (result.success && result.text) {
        setContent(prev => prev ? prev + '\n\n---\n\n' + result.text : result.text);
        const tokens = result.usage?.total_tokens || 0;
        toast.success(`Draft generated (${tokens} tokens)`);
      }
    } catch (err: any) {
      toast.error('AI draft failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleSave = useCallback(() => {
    if (!title.trim()) { toast.error('Please add a title'); return; }
    const articleData = {
      title: title.trim(),
      content,
      word_count: wordCount,
      target_publication: selectedPub?.name,
      brand_voice: selectedBrand,
      template: selectedTemplate,
      brand_id: selectedBrandId || undefined,
      product_id: selectedProductId || undefined,
      funnel_cta: activeBrandObj?.products.find(p => p.id === selectedProductId)?.cta_text,
      scores: scores || undefined,
      status: 'draft' as const,
    };
    if (activeArticleId) {
      updateArticle(activeArticleId, articleData);
      // Also persist to database
      if (dbArticleId) {
        updateArticleMutation.mutate({ id: dbArticleId, title: articleData.title, content: articleData.content, template: articleData.template, brandVoice: articleData.brand_voice, wordCount: articleData.word_count, targetPublication: articleData.target_publication, brandId: articleData.brand_id, productId: articleData.product_id, overallScore: scores?.overall });
      }
      toast.success('Article saved');
    } else {
      const newArticle = addArticle(articleData);
      setActiveArticleId(newArticle.id);
      // Also persist to database
      saveArticleMutation.mutate({ title: articleData.title, content: articleData.content, template: articleData.template, brandVoice: articleData.brand_voice, wordCount: articleData.word_count, targetPublication: articleData.target_publication, brandId: articleData.brand_id, productId: articleData.product_id, overallScore: scores?.overall }, {
        onSuccess: (result) => { if (result?.id) setDbArticleId(result.id); }
      });
      toast.success('Article created and saved');
    }
  }, [title, content, wordCount, selectedPub, selectedBrand, selectedTemplate, scores, activeArticleId, selectedBrandId, selectedProductId, activeBrandObj, addArticle, updateArticle]);

  const handleCreatePitch = () => {
    if (!selectedPub) { toast.error('Select a target publication first'); return; }
    handleSave();
    navigate('/pitches');
    toast.info('Navigate to Pitches to create your pitch');
  };

  const insertTemplate = () => {
    if (!template) return;
    const structure = template.structure.map((s, i) => `## ${i + 1}. ${s}\n\n[Write content here]\n`).join('\n');
    setContent(prev => prev + (prev ? '\n\n' : '') + structure);
    toast.success(`${template.name} template inserted`);
  };

  const handleExport = (format: string) => {
    const blob = new Blob([`# ${title}\n\n${content}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'article'}.${format === 'md' ? 'md' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background shrink-0 flex-wrap">
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATES.filter(t => t.category === 'article').map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
              <SelectItem value="---marketing" disabled>--- Marketing ---</SelectItem>
              {TEMPLATES.filter(t => t.category === 'marketing').map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
              <SelectItem value="---social" disabled>--- Social ---</SelectItem>
              {TEMPLATES.filter(t => t.category === 'social').map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedBrand} onValueChange={setSelectedBrand}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Brand Voice" />
            </SelectTrigger>
            <SelectContent>
              {BRAND_VOICES.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {state.brands.length > 0 && (
            <Select value={selectedBrandId} onValueChange={v => { setSelectedBrandId(v); setSelectedProductId(''); }}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <Building2 className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                {state.brands.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {activeBrandObj && activeBrandObj.products.length > 0 && (
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Product CTA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No product CTA</SelectItem>
                {activeBrandObj.products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} (${p.price})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={insertTemplate}>
            <FileText className="w-3 h-3" /> Insert Template
          </Button>

          <div className="flex-1" />

          <span className="text-xs text-muted-foreground font-mono">{wordCount} words</span>

          {scores && (
            <Badge className={`font-mono text-xs ${getScoreBgColor(scores.overall)}`}>
              <Sparkles className="w-3 h-3 mr-1" />
              {scores.overall}/10
            </Badge>
          )}

          <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            disabled={scoreMutation.isPending || wordCount < 50}
            onClick={handleAiScore}>
            {scoreMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {scoreMutation.isPending ? 'Scoring...' : 'AI Score'}
          </Button>

          <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            disabled={draftMutation.isPending || !title.trim()}
            onClick={handleAiDraft}>
            {draftMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {draftMutation.isPending ? 'Writing...' : 'AI Draft'}
          </Button>

          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => handleExport('md')}>
            <Download className="w-3 h-3" /> Export
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleSave}>
            <Save className="w-3 h-3" /> Save
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={handleCreatePitch}>
            <Send className="w-3 h-3" /> Create Pitch
          </Button>
        </div>

        {/* Title */}
        <div className="px-6 pt-6 pb-2">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Article Title..."
            className="w-full text-2xl font-bold bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
            style={{ fontFamily: "'Merriweather', serif" }}
          />
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Start writing your article...&#10;&#10;Tip: Select a template above and click 'Insert Template' to get started with a proven structure."
            className="w-full h-full min-h-[500px] bg-transparent border-none outline-none resize-none text-sm leading-relaxed placeholder:text-muted-foreground/30"
            style={{ fontFamily: "'Merriweather', serif", fontSize: '15px', lineHeight: '1.8' }}
          />
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-80 border-l border-border bg-card overflow-y-auto hidden lg:block">
        <Tabs value={sidebarTab} onValueChange={setSidebarTab}>
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-10">
            <TabsTrigger value="score" className="text-xs flex-1">Score</TabsTrigger>
            <TabsTrigger value="pub" className="text-xs flex-1">Publication</TabsTrigger>
            <TabsTrigger value="match" className="text-xs flex-1">Match</TabsTrigger>
          </TabsList>

          {/* Score Tab */}
          <TabsContent value="score" className="p-4 space-y-4 mt-0">
            <div className="text-center py-4">
              <div className={`text-4xl font-bold font-mono ${scores ? getScoreColor(scores.overall) : 'text-muted-foreground'}`}>
                {scores ? scores.overall : '--'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Overall Score</p>
              {scores && (
                <Badge variant="outline" className="mt-2 text-xs">{getTierFromScore(scores.overall)} Publication Ready</Badge>
              )}
            </div>

            {scores ? (
              <div className="space-y-2.5">
                {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
                  const score = scores[key as keyof ArticleScores] as number;
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={`font-mono font-semibold ${getScoreColor(score)}`}>{score}</span>
                      </div>
                      <Progress value={score * 10} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-xs text-muted-foreground">Write at least 50 words to see your score</p>
              </div>
            )}

            {/* AI Score Details */}
            {aiScoreResult && (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-xs font-medium text-purple-400">AI Editorial Assessment</p>
                <p className="text-xs text-muted-foreground">{aiScoreResult.summary}</p>
                {aiScoreResult.improvements && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Improvements:</p>
                    {aiScoreResult.improvements.map((imp: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <ChevronRight className="w-3 h-3 shrink-0 mt-0.5 text-purple-400" />
                        {imp}
                      </div>
                    ))}
                  </div>
                )}
                {aiScoreResult.recommendedTier && (
                  <Badge variant="outline" className="text-[10px]">Recommended: {aiScoreResult.recommendedTier}</Badge>
                )}
              </div>
            )}

            {/* Word count targets */}
            {template && (
              <Card className="border-border">
                <CardContent className="p-3">
                  <p className="text-xs font-medium mb-1">Word Count Target</p>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{template.wordCountRange[0].toLocaleString()}</span>
                    <span className="font-mono">{wordCount.toLocaleString()}</span>
                    <span>{template.wordCountRange[1].toLocaleString()}</span>
                  </div>
                  <Progress value={Math.min(100, (wordCount / template.wordCountRange[1]) * 100)} className="h-1.5" />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Publication Tab */}
          <TabsContent value="pub" className="p-4 space-y-4 mt-0">
            <div>
              <label className="text-xs font-medium mb-1.5 block">Target Publication</label>
              <div className="relative">
                <Input
                  value={pubSearch}
                  onChange={e => { setPubSearch(e.target.value); setShowPubDropdown(true); }}
                  onFocus={() => setShowPubDropdown(true)}
                  placeholder="Search 176+ publications..."
                  className="text-xs"
                />
                {showPubDropdown && pubResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                    {pubResults.map(pub => (
                      <button key={pub.id} className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors"
                        onClick={() => { setSelectedPub(pub); setPubSearch(pub.name); setShowPubDropdown(false); }}>
                        <span className="font-medium">{pub.name}</span>
                        <span className="text-muted-foreground ml-2">{pub.category}</span>
                        <span className="text-muted-foreground ml-2">{pub.pay_structure}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedPub && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3 space-y-2">
                  <h4 className="font-semibold text-sm">{selectedPub.name}</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Category:</span> {selectedPub.category}</div>
                    <div><span className="text-muted-foreground">Pay:</span> {selectedPub.pay_structure}</div>
                    <div><span className="text-muted-foreground">Traffic:</span> {selectedPub.traffic_monthly}</div>
                    <div><span className="text-muted-foreground">Accept:</span> {selectedPub.acceptance_rate ?? 'N/A'}%</div>
                  </div>
                  {selectedPub.article_styles && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Styles:</span> {selectedPub.article_styles}
                    </div>
                  )}
                  {selectedPub.editors.length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Editor:</span> {selectedPub.editors[0].name}
                      {selectedPub.editors[0].email && (
                        <span className="text-primary ml-1">{selectedPub.editors[0].email}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {template && (
              <Card className="border-border">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs">Template: {template.name}</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                  <div className="space-y-1">
                    {template.structure.map((s, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px]">
                        <span className="text-primary font-mono shrink-0">{i + 1}.</span>
                        <span className="text-muted-foreground">{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {template.bestFor.map(pub => (
                      <Badge key={pub} variant="outline" className="text-[10px]">{pub}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Match Tab */}
          <TabsContent value="match" className="p-4 space-y-3 mt-0">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Publication Matches</span>
            </div>

            {matchedPubs.length === 0 ? (
              <div className="text-center py-6">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-xs text-muted-foreground">Write more content to see publication matches</p>
              </div>
            ) : (
              matchedPubs.map(pub => (
                <button key={pub.id} className="w-full text-left"
                  onClick={() => { setSelectedPub(pub); setPubSearch(pub.name); setSidebarTab('pub'); }}>
                  <Card className="border-border hover:border-primary/30 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{pub.name}</span>
                        <Badge variant="outline" className="text-[10px] font-mono">{pub.matchScore}%</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{pub.tier}</span>
                        <span>|</span>
                        <span>{pub.pay_structure}</span>
                      </div>
                      <Progress value={pub.matchScore} className="h-1 mt-1.5" />
                    </CardContent>
                  </Card>
                </button>
              ))
            )}
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}
