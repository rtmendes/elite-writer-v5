/**
 * DataVizPanel — GIVE Engine integration for the Writer sidebar
 * 
 * Allows users to:
 * 1. Describe a visualization in natural language
 * 2. Generate interactive data visualizations via GIVE's 4-agent pipeline
 * 3. Preview the rendered viz in an iframe
 * 4. Get an embed URL and insert it into the article
 * 5. Score generated visualizations against the $10K Value Scorecard
 */
import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  BarChart3, Loader2, Sparkles, Plus, Copy, Eye,
  ExternalLink, RefreshCw, Lightbulb, Code2, CheckCircle2,
  ChevronRight, Gauge, Zap, TrendingUp
} from 'lucide-react';

interface DataVizPanelProps {
  title: string;
  content: string;
  onInsertContent: (markdown: string) => void;
}

interface VizResult {
  code: string;
  decision: any;
  metadata: any;
  embedUrl?: string;
  iframeCode?: string;
  score?: any;
}

// Example prompts for quick start
const QUICK_PROMPTS = [
  { label: "Revenue Trend", prompt: "Animated area chart showing 6-month revenue growth with annotations", icon: TrendingUp },
  { label: "Comparison Chart", prompt: "Side-by-side bar chart comparing key metrics across categories", icon: BarChart3 },
  { label: "Data Dashboard", prompt: "Multi-metric dashboard with KPI cards, trend line, and breakdown pie chart", icon: Gauge },
];

// ── Extract key stats from article text ─────────────────────────────────────
function extractArticleStats(text: string): Array<{ label: string; value: string; source: string }> {
  const stats: Array<{ label: string; value: string; source: string }> = [];
  // Match patterns like "X% of Y" or "grew by X%" or "N million/billion" etc.
  const patterns = [
    /(\d+(?:\.\d+)?)\s*%\s+(?:of\s+)?([a-zA-Z][^,.]{3,40})/g,
    /([a-zA-Z][^,.]{3,30})\s+(?:grew?|increased?|decreased?|rose?|fell?|dropped?)\s+(?:by\s+)?(\d+(?:\.\d+)?\s*%)/gi,
    /(\$[\d,.]+(?:\s*(?:million|billion|trillion|M|B|T))?)\s+(?:in\s+|for\s+)?([a-zA-Z][^,.]{3,40})/g,
    /(\d+(?:\.\d+)?)\s*(?:million|billion|trillion)\s+([a-zA-Z][^,.]{3,40})/gi,
  ];
  const seen = new Set<string>();
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null && stats.length < 8) {
      const val = m[1], label = m[2]?.trim().slice(0, 50);
      if (!label || seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      stats.push({ label, value: val, source: 'Article' });
    }
  }
  return stats;
}

// ── Generate a minimal fallback SVG bar chart ────────────────────────────────
function buildFallbackSvg(
  stats: Array<{ label: string; value: string }>,
  chartTitle: string
): string {
  const nums = stats.map(s => parseFloat(s.value.replace(/[^0-9.]/g, '')) || 0);
  const max = Math.max(...nums, 1);
  const W = 480, H = 280, PAD = 48, BAR_GAP = 8;
  const barW = Math.max(16, Math.floor((W - PAD * 2 - BAR_GAP * (stats.length - 1)) / Math.max(stats.length, 1)));
  const bars = stats.map((s, i) => {
    const h = Math.round(((nums[i] || 0) / max) * (H - PAD * 2));
    const x = PAD + i * (barW + BAR_GAP);
    const y = H - PAD - h;
    return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="#6366f1" opacity="0.85"/>
<text x="${x + barW / 2}" y="${H - PAD + 14}" text-anchor="middle" font-size="9" fill="#9ca3af">${s.label.slice(0, 12)}</text>
<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="#e5e7eb" font-weight="600">${s.value}</text>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;background:#111;border-radius:8px">
<text x="${W / 2}" y="22" text-anchor="middle" font-size="13" fill="#f3f4f6" font-weight="600" font-family="system-ui">${chartTitle.slice(0, 60)}</text>
${bars}
</svg>`;
}

export function DataVizPanel({ title, content, onInsertContent }: DataVizPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [dataInput, setDataInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState('');
  const [result, setResult] = useState<VizResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [history, setHistory] = useState<VizResult[]>([]);
  const [caption, setCaption] = useState('');
  const [source, setSource] = useState('');
  // Data-clarity step
  const [clarityStep, setClarityStep] = useState<'idle' | 'confirming'>('idle');
  const [extractedStats, setExtractedStats] = useState<Array<{ label: string; value: string; source: string }>>([]);
  const [pendingPrompt, setPendingPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const visualizeMutation = trpc.give.visualize.useMutation();
  const embedMutation = trpc.give.embed.useMutation();
  const scoreMutation = trpc.give.score.useMutation();

  // Step 1: extract stats → show data-clarity panel → wait for confirm
  const handleGenerate = useCallback(async (overridePrompt?: string) => {
    const p = overridePrompt || prompt;
    if (!p.trim()) {
      toast.error('Describe the visualization you want');
      return;
    }

    // Data-clarity: extract key stats first, show confirmation panel
    if (clarityStep === 'idle') {
      const stats = extractArticleStats(content);
      setExtractedStats(stats);
      setPendingPrompt(p);
      setClarityStep('confirming');
      return;
    }
  }, [prompt, content, clarityStep]);

  // Step 2: user confirmed → actually generate
  const handleConfirmedGenerate = useCallback(async () => {
    const p = pendingPrompt;
    setClarityStep('idle');
    setIsGenerating(true);
    setGenerationPhase('Routing');

    const contextPrompt = title || content
      ? `${p}\n\nContext from article:\nTitle: ${title}\nContent excerpt: ${content.slice(0, 2000)}`
      : p;

    let parsedData: any = {};
    if (dataInput.trim()) {
      try {
        parsedData = JSON.parse(dataInput);
      } catch {
        parsedData = { raw: dataInput };
      }
    }
    // Inject extracted stats into data payload if available
    if (extractedStats.length > 0) {
      parsedData = { ...parsedData, articleStats: extractedStats };
    }

    try {
      setGenerationPhase('Generating code');
      const vizResult = await visualizeMutation.mutateAsync({
        prompt: contextPrompt,
        data: parsedData,
      });

      if (!vizResult.success || !vizResult.code) {
        throw new Error(vizResult.error || 'Visualization generation failed');
      }

      setGenerationPhase('Creating embed');

      let embedUrl: string | undefined;
      let iframeCode: string | undefined;

      try {
        const embedResult = await embedMutation.mutateAsync({
          code: vizResult.code,
          data: parsedData,
        });
        embedUrl = embedResult.embedUrl ?? undefined;
        iframeCode = embedResult.iframeCode ?? undefined;
      } catch (embedErr: any) {
        // GIVE down — use native SVG chart as fallback
        console.warn('[DataVizPanel] GIVE embed failed, using native fallback:', embedErr.message);
        toast.info('GIVE engine unavailable — using native chart', { duration: 4000 });
        const fallbackSvg = buildFallbackSvg(
          extractedStats.length > 0 ? extractedStats : [{ label: 'Data', value: '—' }],
          title || p
        );
        // Treat SVG as inline code instead of iframe
        embedUrl = undefined;
        iframeCode = `<figure style="margin:1.5rem 0">${fallbackSvg}<figcaption style="text-align:center;font-size:0.8rem;color:#9ca3af;margin-top:0.5rem">${caption || p.slice(0, 80)}</figcaption></figure>`;
      }

      const newResult: VizResult = {
        code: vizResult.code,
        decision: vizResult.decision,
        metadata: vizResult.metadata,
        embedUrl,
        iframeCode,
      };

      setResult(newResult);
      setHistory(prev => [newResult, ...prev.slice(0, 9)]);
      setPreviewOpen(true);

      const timeStr = vizResult.metadata?.totalTime
        ? `${(vizResult.metadata.totalTime / 1000).toFixed(1)}s`
        : '';
      toast.success(`Visualization created${timeStr ? ` in ${timeStr}` : ''} — $0.008`);
    } catch (err: any) {
      toast.error('Generation failed: ' + (err.message || 'Unknown error'), { duration: 8000 });
    } finally {
      setIsGenerating(false);
      setGenerationPhase('');
    }
  }, [pendingPrompt, title, content, dataInput, extractedStats, caption, visualizeMutation, embedMutation]);

  const handleScore = useCallback(async () => {
    if (!result?.code) {
      toast.error('Generate a visualization first');
      return;
    }
    try {
      const scoreResult = await scoreMutation.mutateAsync({
        code: result.code,
        prompt,
      });
      setResult(prev => prev ? { ...prev, score: scoreResult } : prev);
      toast.success('Quality score calculated — $0.008');
    } catch (err: any) {
      toast.error('Scoring failed: ' + (err.message || 'Unknown error'));
    }
  }, [result, prompt, scoreMutation]);

  const handleInsertEmbed = useCallback(() => {
    if (!result?.embedUrl && !result?.iframeCode) {
      toast.error('No visualization to insert');
      return;
    }
    const captionLine = caption.trim() ? `\n*${caption.trim()}${source.trim() ? ` — Source: ${source.trim()}` : ''}*` : '';
    let html: string;
    if (result.embedUrl) {
      html = `\n\n<figure>\n<iframe src="${result.embedUrl}" width="100%" height="500" frameborder="0" style="border-radius:12px;background:#0A0A0B;"></iframe>${captionLine ? `\n<figcaption style="text-align:center;font-size:0.8rem;color:#9ca3af;margin-top:0.5rem">${caption.trim()}${source.trim() ? ` — Source: ${source.trim()}` : ''}</figcaption>` : ''}\n</figure>\n\n`;
    } else {
      html = `\n\n${result.iframeCode}${captionLine}\n\n`;
    }
    onInsertContent(html);
    toast.success('Visualization inserted');
  }, [result, caption, source, onInsertContent]);

  const handleCopyEmbed = useCallback(() => {
    if (result?.iframeCode) {
      navigator.clipboard.writeText(result.iframeCode);
      toast.success('Embed code copied');
    }
  }, [result]);

  const handleAutoPrompt = useCallback(() => {
    if (!content.trim()) {
      toast.error('Write some article content first');
      return;
    }
    // Extract data-heavy sections or numbers from content
    const hasNumbers = /\d+[%$,.]?\d*/.test(content);
    const auto = hasNumbers
      ? `Create an interactive data visualization based on the key statistics and figures in this article. Highlight the most impactful numbers with animations.`
      : `Create an engaging infographic-style visualization summarizing the main concepts from this article. Use a clean dashboard layout.`;
    setPrompt(auto);
    toast.info('Prompt auto-generated from article content');
  }, [content]);

  return (
    <div className="space-y-3 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center">
            <Zap className="w-3 h-3 text-indigo-400" />
          </div>
          <span className="text-xs font-semibold text-indigo-400">GIVE Engine</span>
        </div>
        <Badge variant="outline" className="text-[9px] font-mono border-indigo-500/30 text-indigo-400">
          $0.008/viz
        </Badge>
      </div>

      {/* Auto-suggest button */}
      <Button
        variant="outline" size="sm"
        className="w-full h-8 text-xs gap-1.5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
        onClick={handleAutoPrompt}
        disabled={isGenerating || !content.trim()}
      >
        <Lightbulb className="w-3 h-3" />
        Auto-suggest from Article
      </Button>

      {/* Prompt input */}
      <div className="space-y-1.5">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the visualization you want...&#10;&#10;e.g. 'Animated bar chart showing startup funding rounds with hover details'"
          className="w-full h-20 px-2.5 py-2 rounded-md border border-border bg-background text-xs resize-none placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleGenerate();
            }
          }}
        />

        {/* Optional data */}
        <details className="group">
          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
            <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
            Custom data (JSON)
          </summary>
          <textarea
            value={dataInput}
            onChange={e => setDataInput(e.target.value)}
            placeholder='{"labels": ["Q1", "Q2"], "values": [100, 200]}'
            className="w-full h-16 mt-1.5 px-2.5 py-2 rounded-md border border-border bg-background text-[10px] font-mono resize-none placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
          />
        </details>
      </div>

      {/* Data-clarity confirmation panel */}
      {clarityStep === 'confirming' && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-semibold text-amber-400">Data I'll visualize</span>
            </div>
            {extractedStats.length > 0 ? (
              <div className="space-y-0.5">
                {extractedStats.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground truncate max-w-[160px]">{s.label}</span>
                    <span className="font-mono font-semibold text-amber-300">{s.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">No stats extracted — will visualize based on prompt only.</p>
            )}
            <div className="flex gap-1.5">
              <Button size="sm" className="flex-1 h-7 text-[10px] gap-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleConfirmedGenerate}>
                <Sparkles className="w-3 h-3" /> Confirm & Generate
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setClarityStep('idle')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate button */}
      <Button
        size="sm"
        className="w-full h-9 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
        onClick={() => handleGenerate()}
        disabled={isGenerating || !prompt.trim() || clarityStep === 'confirming'}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{generationPhase}...</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            Generate Visualization
          </>
        )}
      </Button>

      {/* Caption + source */}
      <div className="flex gap-1.5">
        <Input
          placeholder="Caption (optional)"
          value={caption}
          onChange={e => setCaption(e.target.value)}
          className="text-[10px] h-7 flex-1"
        />
        <Input
          placeholder="Source"
          value={source}
          onChange={e => setSource(e.target.value)}
          className="text-[10px] h-7 w-24"
        />
      </div>

      {/* Quick prompts */}
      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground font-medium">Quick Start</p>
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp.label}
            onClick={() => { setPrompt(qp.prompt); handleGenerate(qp.prompt); }}
            disabled={isGenerating}
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-[10px] text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/5 transition-colors disabled:opacity-50"
          >
            <qp.icon className="w-3 h-3 shrink-0" />
            {qp.label}
          </button>
        ))}
      </div>

      {/* Result */}
      {result && (
        <Card className="border-indigo-500/20 bg-indigo-500/5">
          <CardContent className="p-2.5 space-y-2">
            {/* Decision info */}
            {result.decision && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] font-medium text-green-400">Generated</span>
                  {result.metadata?.totalTime && (
                    <span className="text-[9px] text-muted-foreground font-mono">
                      {(result.metadata.totalTime / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                {result.decision.visualizationType && (
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[8px] font-mono px-1 py-0">
                      {result.decision.visualizationType}
                    </Badge>
                    {result.decision.animationType && (
                      <Badge variant="outline" className="text-[8px] font-mono px-1 py-0">
                        {result.decision.animationType}
                      </Badge>
                    )}
                  </div>
                )}
                {result.decision.reasoning && (
                  <p className="text-[9px] text-muted-foreground leading-relaxed">
                    {result.decision.reasoning.slice(0, 150)}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="sm" variant="outline"
                className="h-7 text-[10px] gap-1"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="w-3 h-3" /> Preview
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-[10px] gap-1 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                onClick={handleInsertEmbed}
              >
                <Plus className="w-3 h-3" /> Insert
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-[10px] gap-1"
                onClick={handleCopyEmbed}
              >
                <Copy className="w-3 h-3" /> Copy Embed
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-[10px] gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                onClick={handleScore}
                disabled={scoreMutation.isPending}
              >
                {scoreMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Gauge className="w-3 h-3" />
                )}
                Score
              </Button>
            </div>

            {/* Score display */}
            {result.score && (
              <div className="border-t border-indigo-500/20 pt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-amber-400">Quality Score</span>
                  <span className="text-sm font-bold font-mono text-amber-400">
                    {result.score.overall || result.score.score || '--'}/100
                  </span>
                </div>
                {result.score.dimensions && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {Object.entries(result.score.dimensions as Record<string, any>).slice(0, 6).map(([key, val]) => (
                      <div key={key} className="flex justify-between text-[9px]">
                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="font-mono">{typeof val === 'object' ? val.score : val}</span>
                      </div>
                    ))}
                  </div>
                )}
                {result.score.feedback && (
                  <p className="text-[9px] text-muted-foreground italic">
                    {typeof result.score.feedback === 'string' ? result.score.feedback.slice(0, 120) : ''}
                  </p>
                )}
              </div>
            )}

            {/* Embed URL */}
            {result.embedUrl && (
              <a
                href={result.embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Open standalone
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-medium">Recent ({history.length})</p>
          {history.slice(1, 4).map((h, i) => (
            <button
              key={i}
              onClick={() => { setResult(h); setPreviewOpen(true); }}
              className="flex items-center gap-2 w-full text-left px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              <Code2 className="w-3 h-3 shrink-0 text-indigo-400/50" />
              <span className="truncate">
                {h.decision?.visualizationType || 'Visualization'} — {h.decision?.reasoning?.slice(0, 40) || 'Generated'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Data Visualization Preview
              {result?.decision?.visualizationType && (
                <Badge variant="outline" className="text-[10px] font-mono ml-2">
                  {result.decision.visualizationType}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-4">
            {result?.embedUrl ? (
              <div className="rounded-xl overflow-hidden border border-border" style={{ background: '#0A0A0B' }}>
                <iframe
                  src={result.embedUrl}
                  width="100%"
                  height="500"
                  frameBorder="0"
                  style={{ borderRadius: '12px', background: '#0A0A0B' }}
                  sandbox="allow-scripts allow-same-origin"
                  title="GIVE Visualization Preview"
                />
              </div>
            ) : result?.code ? (
              <div className="rounded-xl overflow-hidden border border-border" style={{ background: '#0A0A0B' }}>
                <iframe
                  srcDoc={buildPreviewHtml(result.code)}
                  width="100%"
                  height="500"
                  frameBorder="0"
                  style={{ borderRadius: '12px', background: '#0A0A0B' }}
                  sandbox="allow-scripts"
                  title="GIVE Visualization Preview"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                No visualization to preview
              </div>
            )}
            {/* Action bar */}
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs gap-1.5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
                onClick={handleInsertEmbed}
              >
                <Plus className="w-3.5 h-3.5" /> Insert in Article
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={handleCopyEmbed}
              >
                <Copy className="w-3.5 h-3.5" /> Copy Embed Code
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs gap-1.5"
                onClick={() => { setPreviewOpen(false); handleGenerate(); }}
                disabled={isGenerating}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </Button>
              {result?.embedUrl && (
                <a
                  href={result.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto"
                >
                  <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" /> Open Full
                  </Button>
                </a>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Build a self-contained HTML page for previewing React code in an iframe.
 * This mirrors GIVE's /embed page renderer.
 */
function buildPreviewHtml(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/recharts@2.15.0/umd/Recharts.min.js" crossorigin></script>
<script src="https://unpkg.com/framer-motion@12.6.0/dist/framer-motion.js" crossorigin></script>
<link href="https://cdn.tailwindcss.com" rel="stylesheet" />
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { margin: 0; padding: 16px; background: #0A0A0B; color: #FAFAFA; font-family: system-ui, -apple-system, sans-serif; overflow: auto; }
  #root { width: 100%; min-height: 400px; }
</style>
</head>
<body>
<div id="root"></div>
<script>
try {
  const { useState, useEffect, useRef, useMemo } = React;
  const { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
          RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
          XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
          RadialBarChart, RadialBar, Treemap, ComposedChart, Scatter } = Recharts;
  const { motion, AnimatePresence } = window["framer-motion"] || {};

  ${code}

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(GeneratedVisualization, { data: {}, parameters: {} }));
} catch (err) {
  document.getElementById('root').innerHTML = '<div style="color:#F87171;padding:20px;font-family:monospace;font-size:13px;">Error rendering visualization:<br/>' + err.message + '</div>';
}
</script>
</body>
</html>`;
}
