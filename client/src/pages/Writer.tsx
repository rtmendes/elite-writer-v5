import { useState, useCallback, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import {
  PenTool, Save, Send, BarChart3, BookOpen, Target,
  Sparkles, ChevronRight, FileText, Zap, Eye, Download, Building2, Loader2,
  Bot, Image, Package, PanelRightClose, PanelRightOpen, Search,
  FileDown, FileType, FileCode, Globe, ChevronDown,
  Microscope, FlaskConical, ShieldCheck, AlertTriangle, Ban, CheckCircle2, Info,
} from 'lucide-react';
import { PUBLICATIONS, matchPublications, type Publication } from '@/lib/publications-data';
import { scoreArticleLocally, DIMENSION_LABELS, getScoreColor, getScoreBgColor, getTierFromScore } from '@/lib/scoring';
import { TEMPLATES, BRAND_VOICES, type WritingTemplate } from '@/lib/templates';
import type { ArticleScores } from '@/lib/store';
import { AgenticPanel } from '@/components/writer/AgenticPanel';
import { CreativePanel } from '@/components/writer/CreativePanel';
import { ProductPanel } from '@/components/writer/ProductPanel';
import { DataVizPanel } from '@/components/writer/DataVizPanel';
import { checkContentQuality, getGradeColor, getGradeBgColor, type QualityReport, type QualityIssue } from '@/lib/quality-checker';
import {
  WriterBlockNoteEditor,
  htmlToPlainText,
  htmlToMarkdown,
  parseContentToHtml,
} from '@/components/writer/BlockNoteEditor';

// ─── Research Panel (Sidebar) ───────────────────────────────
function ResearchPanel({ title, content, onInsertContent }: {
  title: string;
  content: string;
  onInsertContent: (text: string) => void;
}) {
  const { state } = useApp();
  const [deepQuery, setDeepQuery] = useState('');
  const [deepModel, setDeepModel] = useState('deepseek-r1');
  const [deepResult, setDeepResult] = useState<any>(null);
  const perplexityMutation = trpc.research.perplexity.useMutation();

  // Available research notes from the Research page
  const researchNotes = state.research || [];

  const handleDeepResearch = async () => {
    const query = deepQuery.trim() || title;
    if (!query) { toast.error('Enter a research topic or add a title'); return; }
    try {
      const result = await perplexityMutation.mutateAsync({
        query: `Conduct deep, publication-grade research on: ${query}. Include specific statistics, named sources, recent developments (2025-2026), and contrarian angles. Focus on data that would satisfy Bloomberg/WSJ editorial standards.`,
        model: 'sonar-pro',
        focusArea: 'investigative journalism research',
        maxTokens: 6000,
      });
      if (result.success) {
        setDeepResult(result);
        toast.success(`Deep research complete (${result.citations?.length || 0} citations)`);
      }
    } catch (err: any) {
      toast.error('Research failed: ' + (err.message || 'Try again'));
    }
  };

  return (
    <div className="space-y-3 p-3">
      {/* Auto-imported research from Research page */}
      {researchNotes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-blue-400">Available Research</span>
            <Badge variant="outline" className="text-[9px] ml-auto">{researchNotes.length}</Badge>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {researchNotes.slice(0, 8).map((note: any) => (
              <button
                key={note.id}
                className="w-full text-left p-2 rounded-md bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 transition-colors"
                onClick={() => {
                  const imported = `\n\n## Research: ${note.title}\n\n${note.content}\n\n${note.data_points?.map((dp: any) => `- **${dp.label}**: ${dp.value} (${dp.source})`).join('\n') || ''}`;
                  onInsertContent(imported);
                  toast.success(`Imported: ${note.title}`);
                }}
              >
                <p className="text-[11px] font-medium truncate">{note.title}</p>
                <p className="text-[9px] text-muted-foreground truncate">{note.content?.slice(0, 60)}</p>
                {note.data_points?.length > 0 && (
                  <Badge variant="outline" className="text-[8px] mt-0.5">{note.data_points.length} data points</Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Deep Research — advanced model query */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-purple-400">Deep Research</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Advanced AI research with citations — goes beyond the initial feed data.
        </p>

        <Select value={deepModel} onValueChange={setDeepModel}>
          <SelectTrigger className="h-7 text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deepseek-r1">DeepSeek R1 (Deep Reasoning)</SelectItem>
            <SelectItem value="gemini-pro">Gemini 2.5 Pro</SelectItem>
            <SelectItem value="claude-sonnet">Claude Sonnet 4</SelectItem>
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={deepQuery}
          onChange={e => setDeepQuery(e.target.value)}
          placeholder={title || 'Research topic...'}
          className="text-xs h-8"
          onKeyDown={e => e.key === 'Enter' && handleDeepResearch()}
        />

        <Button
          className="w-full h-8 text-xs gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          onClick={handleDeepResearch}
          disabled={perplexityMutation.isPending}
        >
          {perplexityMutation.isPending
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Researching...</>
            : <><Microscope className="w-3.5 h-3.5" /> Deep Research</>
          }
        </Button>
      </div>

      {/* Deep Research Results */}
      {deepResult && (
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-2 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-purple-400">Research Results</p>
              <Button
                size="sm" variant="outline"
                className="h-6 text-[9px] gap-1 border-purple-500/30 text-purple-400"
                onClick={() => {
                  onInsertContent(`\n\n## Deep Research\n\n${deepResult.content}\n`);
                  toast.success('Research imported into article');
                }}
              >
                Insert into Article
              </Button>
            </div>
            <div className="text-[10px] text-muted-foreground max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {deepResult.content?.slice(0, 2000)}
              {deepResult.content?.length > 2000 && '...'}
            </div>
            {deepResult.citations?.length > 0 && (
              <div className="pt-1 border-t border-purple-500/10">
                <p className="text-[9px] font-medium text-purple-400 mb-0.5">Citations ({deepResult.citations.length}):</p>
                {deepResult.citations.slice(0, 5).map((c: string, i: number) => (
                  <a key={i} href={c} target="_blank" rel="noreferrer" className="block text-[9px] text-blue-400 hover:underline truncate">
                    {c}
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Writer Component ──────────────────────────────────
export default function Writer() {
  const { state, addArticle, updateArticle } = useApp();
  const [, navigate] = useLocation();

  // tRPC mutations
  const scoreMutation = trpc.ai.score.useMutation();
  const draftMutation = trpc.ai.draft.useMutation();
  const saveArticleMutation = trpc.data.articles.create.useMutation();
  const updateArticleMutation = trpc.data.articles.update.useMutation();
  const googleCreateDoc = trpc.google.createDoc.useMutation();
  const [dbArticleId, setDbArticleId] = useState<number | null>(null);

  // Editor state — BlockNote stores HTML; we derive plain text for scoring/AI
  const [title, setTitle] = useState('');
  const [editorHtml, setEditorHtml] = useState('<p></p>');
  const content = useMemo(() => htmlToPlainText(editorHtml), [editorHtml]);
  const setContent = useCallback((updater: string | ((prev: string) => string)) => {
    const newText = typeof updater === 'function' ? updater(htmlToPlainText(editorHtml)) : updater;
    setEditorHtml(parseContentToHtml(newText));
  }, [editorHtml]);
  const [selectedTemplate, setSelectedTemplate] = useState('data-journalism');
  const [selectedVoice, setSelectedVoice] = useState('insight-profit');
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null);
  const [pubSearch, setPubSearch] = useState('');
  const [showPubDropdown, setShowPubDropdown] = useState(false);
  const [scores, setScores] = useState<ArticleScores | null>(null);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState('score');
  const [aiScoreResult, setAiScoreResult] = useState<any>(null);
  const [selectedBrandId, setSelectedBrandId] = useState<string>(state.brands[0]?.id || '');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeBrandObj = useMemo(() => state.brands.find(b => b.id === selectedBrandId), [state.brands, selectedBrandId]);
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const template = TEMPLATES.find(t => t.id === selectedTemplate);

  // Quality report state
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);

  // Auto-score locally on content change (debounced)
  useEffect(() => {
    if (wordCount < 50) { setScores(null); return; }
    const timer = setTimeout(() => {
      const newScores = scoreArticleLocally(content, selectedPub?.name);
      setScores(newScores);
    }, 1000);
    return () => clearTimeout(timer);
  }, [content, selectedPub, wordCount]);

  // Auto-check quality on content change (debounced)
  useEffect(() => {
    if (wordCount < 30) { setQualityReport(null); return; }
    const timer = setTimeout(() => {
      const report = checkContentQuality(content, { blockOnBritish: true });
      setQualityReport(report);
    }, 800);
    return () => clearTimeout(timer);
  }, [content, wordCount]);

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
        brandVoice: BRAND_VOICES.find(b => b.id === selectedVoice)?.name,
      });
      if (result.success && result.data) {
        setAiScoreResult(result.data);
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
      const brand = BRAND_VOICES.find(b => b.id === selectedVoice);
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
      content: editorHtml,
      word_count: wordCount,
      target_publication: selectedPub?.name,
      brand_voice: selectedVoice,
      template: selectedTemplate,
      brand_id: selectedBrandId || undefined,
      product_id: selectedProductId || undefined,
      funnel_cta: activeBrandObj?.products.find(p => p.id === selectedProductId)?.cta_text,
      scores: scores || undefined,
      status: 'draft' as const,
    };
    if (activeArticleId) {
      updateArticle(activeArticleId, articleData);
      if (dbArticleId) {
        updateArticleMutation.mutate({ id: dbArticleId, title: articleData.title, content: articleData.content, template: articleData.template, brandVoice: articleData.brand_voice, wordCount: articleData.word_count, targetPublication: articleData.target_publication, brandId: articleData.brand_id, productId: articleData.product_id, overallScore: scores?.overall });
      }
      toast.success('Article saved');
    } else {
      const newArticle = addArticle(articleData);
      setActiveArticleId(newArticle.id);
      saveArticleMutation.mutate({ title: articleData.title, content: articleData.content, template: articleData.template, brandVoice: articleData.brand_voice, wordCount: articleData.word_count, targetPublication: articleData.target_publication, brandId: articleData.brand_id, productId: articleData.product_id, overallScore: scores?.overall }, {
        onSuccess: (result) => { if (result?.id) setDbArticleId(result.id); }
      });
      toast.success('Article created and saved');
    }
  }, [title, editorHtml, content, wordCount, selectedPub, selectedVoice, selectedTemplate, scores, activeArticleId, selectedBrandId, selectedProductId, activeBrandObj, addArticle, updateArticle, dbArticleId, saveArticleMutation, updateArticleMutation]);

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

  // ─── Export Handlers ──────────────────────────────────────
  const downloadFile = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'article'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMd = () => {
    const md = htmlToMarkdown(editorHtml);
    downloadFile(new Blob([`# ${title}\n\n${md}`], { type: 'text/markdown' }), 'md');
    toast.success('Exported as Markdown');
  };

  const handleExportHtml = () => {
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
<style>body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:2rem auto;padding:0 1.5rem;line-height:1.8;color:#1a1a1a}
h1{font-size:2.2rem;margin-bottom:0.5rem}h2{font-size:1.5rem;margin-top:2rem;border-bottom:1px solid #e0e0e0;padding-bottom:0.3rem}
h3{font-size:1.2rem}img{max-width:100%;border-radius:8px}blockquote{border-left:3px solid #666;margin-left:0;padding-left:1rem;color:#555}
a{color:#1a73e8}code{background:#f5f5f5;padding:2px 6px;border-radius:3px;font-size:0.9em}
.meta{color:#666;font-size:0.9rem;margin-bottom:2rem}</style></head>
<body><h1>${title}</h1>
<div class="meta">${wordCount.toLocaleString()} words${selectedPub ? ` · ${selectedPub.name}` : ''}${scores ? ` · Score: ${scores.overall}/10` : ''}</div>
${editorHtml}</body></html>`;
    downloadFile(new Blob([html], { type: 'text/html' }), 'html');
    toast.success('Exported as HTML');
  };

  const handleExportTxt = () => {
    downloadFile(new Blob([`${title}\n${'='.repeat(title.length)}\n\n${content}`], { type: 'text/plain' }), 'txt');
    toast.success('Exported as Plain Text');
  };

  const handleExportPdf = () => {
    // Use browser print-to-PDF for clean output
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast.error('Popup blocked — allow popups for PDF export'); return; }
    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>${title}</title>
<style>@media print{@page{margin:1in}}
body{font-family:Georgia,'Times New Roman',serif;max-width:680px;margin:0 auto;padding:2rem 1.5rem;line-height:1.8;color:#1a1a1a}
h1{font-size:2rem;margin-bottom:0.25rem}h2{font-size:1.4rem;margin-top:1.8rem;page-break-after:avoid}
h3{font-size:1.15rem;page-break-after:avoid}img{max-width:100%}
blockquote{border-left:3px solid #999;margin-left:0;padding-left:1rem;color:#444}
.meta{color:#666;font-size:0.85rem;margin-bottom:2rem;border-bottom:1px solid #ddd;padding-bottom:0.75rem}
a{color:#1a73e8;text-decoration:none}</style></head>
<body><h1>${title}</h1>
<div class="meta">${wordCount.toLocaleString()} words${selectedPub ? ` · Target: ${selectedPub.name}` : ''}${scores ? ` · Score: ${scores.overall}/10` : ''}</div>
${editorHtml}
<script>setTimeout(()=>{window.print();window.close();},500)</script></body></html>`);
    printWindow.document.close();
    toast.success('PDF print dialog opened');
  };

  const handleExportGoogleDoc = async () => {
    if (!title.trim()) { toast.error('Add a title first'); return; }
    try {
      const result = await googleCreateDoc.mutateAsync({
        title: title.trim(),
        content: content,
      });
      if (result.success && result.docUrl) {
        window.open(result.docUrl, '_blank');
        toast.success('Google Doc created — opening in new tab');
      }
    } catch (err: any) {
      if (err.message?.includes('not connected') || err.message?.includes('not configured')) {
        toast.error('Google not connected. Go to Settings → Google Integration to authorize.');
      } else {
        toast.error('Google Doc export failed: ' + (err.message || 'Unknown error'));
      }
    }
  };

  // ─── Sidebar Content (shared between inline & sheet) ──────
  const sidebarContent = (
    <Tabs value={sidebarTab} onValueChange={setSidebarTab}>
      <TabsList className="w-full rounded-none border-b border-border bg-transparent h-10 grid grid-cols-4">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="score" className="text-[10px] gap-1 px-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Score
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p className="text-xs">11-Dimension Scorecard</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="write" className="text-[10px] gap-1 px-1.5">
                <Bot className="w-3.5 h-3.5" /> Write
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p className="text-xs">AI Writing + Research</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="create" className="text-[10px] gap-1 px-1.5">
                <Image className="w-3.5 h-3.5" /> Create
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p className="text-xs">Creative + Data Viz</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="publish" className="text-[10px] gap-1 px-1.5">
                <Target className="w-3.5 h-3.5" /> Publish
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p className="text-xs">Publication Match + Products</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TabsList>

      {/* ═══ Score Tab (DEFAULT) ═══ */}
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

        {/* ─── Quality Enforcement ─── */}
        {qualityReport && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold">Content Quality</span>
              </div>
              <Badge className={`font-mono text-sm px-2 ${getGradeBgColor(qualityReport.grade)}`}>
                {qualityReport.grade}
              </Badge>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-1.5 rounded bg-muted/30">
                <p className={`text-lg font-mono font-bold ${qualityReport.stats.slopCount > 3 ? 'text-red-400' : qualityReport.stats.slopCount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {qualityReport.stats.slopCount}
                </p>
                <p className="text-[9px] text-muted-foreground">AI Slop</p>
              </div>
              <div className="p-1.5 rounded bg-muted/30">
                <p className={`text-lg font-mono font-bold ${qualityReport.stats.britishCount > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                  {qualityReport.stats.britishCount}
                </p>
                <p className="text-[9px] text-muted-foreground">British</p>
              </div>
              <div className="p-1.5 rounded bg-muted/30">
                <p className={`text-lg font-mono font-bold ${qualityReport.stats.fillerCount > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {qualityReport.stats.fillerCount}
                </p>
                <p className="text-[9px] text-muted-foreground">Filler</p>
              </div>
            </div>

            {/* Readability stats */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>Avg sentence: {qualityReport.stats.avgSentenceLength} words</span>
              <span>·</span>
              <span>Grade level: {qualityReport.stats.readingGradeLevel}</span>
              <span>·</span>
              <span>{qualityReport.stats.paragraphs} ¶</span>
            </div>

            {/* Gate status */}
            {qualityReport.passesGate ? (
              <div className="flex items-center gap-1.5 p-2 rounded bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                <span className="text-[10px] text-green-400 font-medium">Passes quality gate — ready to export</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 p-2 rounded bg-red-500/10 border border-red-500/20">
                <Ban className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] text-red-400 font-medium">Blocked — fix issues below before exporting</span>
              </div>
            )}

            {/* Issues list */}
            {qualityReport.issues.length > 0 && (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {qualityReport.issues.slice(0, 20).map((issue, i) => (
                  <div key={i} className={`p-2 rounded border text-[10px] ${
                    issue.severity === 'high' ? 'border-red-500/20 bg-red-500/5' :
                    issue.severity === 'medium' ? 'border-yellow-500/20 bg-yellow-500/5' :
                    'border-border bg-muted/20'
                  }`}>
                    <div className="flex items-start gap-1.5">
                      {issue.severity === 'high' ? <Ban className="w-3 h-3 text-red-400 shrink-0 mt-0.5" /> :
                       issue.severity === 'medium' ? <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0 mt-0.5" /> :
                       <Info className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />}
                      <div>
                        <p className="font-medium">{issue.message}</p>
                        <p className="text-muted-foreground mt-0.5">→ {issue.fix}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {qualityReport.issues.length === 0 && (
              <div className="text-center py-3">
                <CheckCircle2 className="w-6 h-6 mx-auto text-green-400 mb-1" />
                <p className="text-[10px] text-green-400 font-medium">Clean copy — no quality issues detected</p>
              </div>
            )}
          </div>
        )}

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

      {/* ═══ Write Tab (AI + Research combined) ═══ */}
      <TabsContent value="write" className="mt-0">
        <Tabs defaultValue="ai" className="w-full">
          <TabsList className="w-full h-8 rounded-none bg-muted/30 grid grid-cols-2">
            <TabsTrigger value="ai" className="text-[10px] gap-1 h-7">
              <Bot className="w-3 h-3" /> AI Agent
            </TabsTrigger>
            <TabsTrigger value="research" className="text-[10px] gap-1 h-7">
              <FlaskConical className="w-3 h-3" /> Research
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ai" className="mt-0">
            <AgenticPanel
              title={title}
              content={content}
              onContentUpdate={setContent}
              onTitleUpdate={setTitle}
              targetPublication={selectedPub?.name}
              brandVoice={BRAND_VOICES.find(b => b.id === selectedVoice)?.name}
              template={selectedTemplate}
            />
          </TabsContent>
          <TabsContent value="research" className="mt-0">
            <ResearchPanel
              title={title}
              content={content}
              onInsertContent={(text) => setContent(prev => prev + text)}
            />
          </TabsContent>
        </Tabs>
      </TabsContent>

      {/* ═══ Create Tab (Creative + DataViz combined) ═══ */}
      <TabsContent value="create" className="mt-0">
        <Tabs defaultValue="creative" className="w-full">
          <TabsList className="w-full h-8 rounded-none bg-muted/30 grid grid-cols-2">
            <TabsTrigger value="creative" className="text-[10px] gap-1 h-7">
              <Image className="w-3 h-3" /> Creative
            </TabsTrigger>
            <TabsTrigger value="dataviz" className="text-[10px] gap-1 h-7">
              <BarChart3 className="w-3 h-3" /> Data Viz
            </TabsTrigger>
          </TabsList>
          <TabsContent value="creative" className="mt-0">
            <CreativePanel
              title={title}
              content={content}
              articleId={dbArticleId ?? undefined}
              onInsertContent={(md) => setContent(prev => prev + md)}
              targetPublication={selectedPub?.name}
            />
          </TabsContent>
          <TabsContent value="dataviz" className="mt-0">
            <DataVizPanel
              title={title}
              content={content}
              onInsertContent={(md) => setContent(prev => prev + md)}
            />
          </TabsContent>
        </Tabs>
      </TabsContent>

      {/* ═══ Publish Tab (Publication + Match + Products) ═══ */}
      <TabsContent value="publish" className="mt-0">
        <Tabs defaultValue="pub" className="w-full">
          <TabsList className="w-full h-8 rounded-none bg-muted/30 grid grid-cols-3">
            <TabsTrigger value="pub" className="text-[10px] gap-1 h-7">
              <BookOpen className="w-3 h-3" /> Pub
            </TabsTrigger>
            <TabsTrigger value="match" className="text-[10px] gap-1 h-7">
              <Target className="w-3 h-3" /> Match
            </TabsTrigger>
            <TabsTrigger value="products" className="text-[10px] gap-1 h-7">
              <Package className="w-3 h-3" /> Products
            </TabsTrigger>
          </TabsList>

          {/* Publication sub-tab */}
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

          {/* Match sub-tab */}
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
                  onClick={() => { setSelectedPub(pub); setPubSearch(pub.name); setSidebarTab('publish'); }}>
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

          {/* Products sub-tab */}
          <TabsContent value="products" className="mt-0">
            <ProductPanel
              title={title}
              content={content}
              brandVoice={BRAND_VOICES.find(b => b.id === selectedVoice)?.name}
            />
          </TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background shrink-0 flex-wrap">
          {/* Template */}
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

          {/* Writing Voice (renamed from Brand Voice) */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <PenTool className="w-3 h-3 mr-1 shrink-0" />
                      <SelectValue placeholder="Writing Voice" />
                    </SelectTrigger>
                    <SelectContent>
                      <DropdownMenuLabel className="text-[10px] text-muted-foreground font-normal px-2 py-1">
                        Writing style & tone preset
                      </DropdownMenuLabel>
                      {BRAND_VOICES.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Writing voice controls tone, style, and content filters</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Brand Entity (only if brands exist) */}
          {state.brands.length > 0 && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Select value={selectedBrandId} onValueChange={v => { setSelectedBrandId(v); setSelectedProductId(''); }}>
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <Building2 className="w-3 h-3 mr-1 shrink-0" />
                        <SelectValue placeholder="Brand" />
                      </SelectTrigger>
                      <SelectContent>
                        <DropdownMenuLabel className="text-[10px] text-muted-foreground font-normal px-2 py-1">
                          Business entity for monetization
                        </DropdownMenuLabel>
                        {state.brands.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Brand links articles to a business for product CTA tracking</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Product CTA */}
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
            <Badge
              className={`font-mono text-xs cursor-pointer hover:opacity-80 ${getScoreBgColor(scores.overall)}`}
              onClick={() => { setSidebarOpen(true); setSidebarTab('score'); }}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {scores.overall}/10
            </Badge>
          )}

          {qualityReport && (
            <Badge
              className={`font-mono text-xs cursor-pointer hover:opacity-80 ${getGradeBgColor(qualityReport.grade)}`}
              onClick={() => { setSidebarOpen(true); setSidebarTab('score'); }}
            >
              <ShieldCheck className="w-3 h-3 mr-1" />
              {qualityReport.grade}{qualityReport.stats.slopCount > 0 ? ` · ${qualityReport.stats.slopCount} slop` : ''}
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

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                <Download className="w-3 h-3" /> Export <ChevronDown className="w-3 h-3 ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs">Download</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleExportPdf} className="text-xs gap-2">
                <FileDown className="w-3.5 h-3.5" /> PDF (Print)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportHtml} className="text-xs gap-2">
                <FileCode className="w-3.5 h-3.5" /> HTML (Formatted)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportTxt} className="text-xs gap-2">
                <FileType className="w-3.5 h-3.5" /> Plain Text (.txt)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportMd} className="text-xs gap-2">
                <FileText className="w-3.5 h-3.5" /> Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">Google Workspace</DropdownMenuLabel>
              <DropdownMenuItem onClick={handleExportGoogleDoc} className="text-xs gap-2" disabled={googleCreateDoc.isPending}>
                <Globe className="w-3.5 h-3.5" />
                {googleCreateDoc.isPending ? 'Creating...' : 'Create Google Doc'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleSave}>
            <Save className="w-3 h-3" /> Save
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={handleCreatePitch}>
            <Send className="w-3 h-3" /> Create Pitch
          </Button>

          {/* Sidebar toggle */}
          <Button
            variant="ghost" size="sm"
            className="h-8 w-8 p-0 hidden lg:flex"
            onClick={() => setSidebarOpen(prev => !prev)}
            title={sidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>

          {/* Mobile sidebar trigger (shows as Sheet/drawer on smaller screens) */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 lg:hidden">
                <PanelRightOpen className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0 overflow-y-auto">
              {sidebarContent}
            </SheetContent>
          </Sheet>
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

        {/* Rich Text Editor (BlockNote) */}
        <div className="flex-1 overflow-hidden">
          <WriterBlockNoteEditor
            value={editorHtml}
            onValueChange={setEditorHtml}
            placeholder="Start writing your article... Type / for slash commands."
          />
        </div>
      </div>

      {/* Inline Sidebar — visible on lg+ when open */}
      {sidebarOpen && (
        <aside className="w-80 border-l border-border bg-card overflow-y-auto hidden lg:block shrink-0 transition-all">
          {sidebarContent}
        </aside>
      )}
    </div>
  );
}
