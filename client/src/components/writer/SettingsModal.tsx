/**
 * Settings Config Modal — Flight-Sim Style Controller
 * 
 * Grouped settings popup for granular Writer configuration:
 * - AI Behavior (model, temperature, depth, max tokens)
 * - Content Filters (US English, slop threshold, brand rules, quality gates)
 * - Export Defaults (format, naming, Google Doc folder)
 * - Scoring (min publish score, auto-score trigger, dimension weights)
 * - Templates (save/load custom presets)
 */

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Settings, Bot, ShieldCheck, FileDown, Sparkles, LayoutTemplate,
  Save, RotateCcw, Thermometer, Gauge, Languages, Ban, Cpu,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

// ─── Settings Types ─────────────────────────────────────────

export type WriterSettings = {
  // AI Behavior
  ai: {
    defaultModel: string;
    temperature: number;
    depth: 'quick' | 'standard' | 'deep';
    maxTokens: number;
    autoResearch: boolean;
    researchModel: string;
  };
  // Per-tier model overrides (Settings → Models panel)
  // Empty string = use server default for that tier
  models: {
    fast: string;      // draft, research, humanize, expand, continue
    standard: string;  // publish-grade proofread pass
    cheap: string;     // scoring, headlines
    pipeline: string;  // queue.generateArticle main model
  };
  // Content Filters
  filters: {
    enforceUsEnglish: boolean;
    maxSlopAllowed: number;
    blockOnSlop: boolean;
    blockOnBritish: boolean;
    minPublishScore: number;
    autoScoreAfterWords: number;
    slopSeverityLevel: 'strict' | 'moderate' | 'relaxed';
    customBannedPhrases: string[];
  };
  // Export Defaults
  exports: {
    defaultFormat: 'pdf' | 'html' | 'txt' | 'md' | 'gdoc';
    includeMetaHeader: boolean;
    includeScoreFooter: boolean;
    fileNamePattern: string;
  };
  // Scoring
  scoring: {
    autoScore: boolean;
    minPublishGrade: 'A' | 'B' | 'C';
    showQualityBadge: boolean;
    dimensionWeights: Record<string, number>;
  };
};

const DEFAULT_SETTINGS: WriterSettings = {
  ai: {
    defaultModel: 'claude-sonnet',
    temperature: 0.7,
    depth: 'standard',
    maxTokens: 4096,
    autoResearch: false,
    researchModel: 'deepseek-r1',
  },
  models: {
    fast: '',      // '' = use server default (google/gemini-2.5-flash)
    standard: '',  // '' = use server default (anthropic/claude-sonnet-4.6)
    cheap: '',     // '' = use server default (anthropic/claude-haiku-4.5)
    pipeline: '',  // '' = use server default (google/gemini-2.5-flash)
  },
  filters: {
    enforceUsEnglish: true,
    maxSlopAllowed: 3,
    blockOnSlop: true,
    blockOnBritish: true,
    minPublishScore: 6,
    autoScoreAfterWords: 200,
    slopSeverityLevel: 'moderate',
    customBannedPhrases: [],
  },
  exports: {
    defaultFormat: 'pdf',
    includeMetaHeader: true,
    includeScoreFooter: false,
    fileNamePattern: '{title}_{date}',
  },
  scoring: {
    autoScore: true,
    minPublishGrade: 'B',
    showQualityBadge: true,
    dimensionWeights: {},
  },
};

const STORAGE_KEY = 'elite-writer-settings';

export function loadSettings(): WriterSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed, ai: { ...DEFAULT_SETTINGS.ai, ...parsed.ai }, models: { ...DEFAULT_SETTINGS.models, ...parsed.models }, filters: { ...DEFAULT_SETTINGS.filters, ...parsed.filters }, exports: { ...DEFAULT_SETTINGS.exports, ...parsed.exports }, scoring: { ...DEFAULT_SETTINGS.scoring, ...parsed.scoring } };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: WriterSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// ─── Settings Modal Component ───────────────────────────────

export function SettingsModal({ onSettingsChange }: { onSettingsChange?: (settings: WriterSettings) => void }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<WriterSettings>(loadSettings);
  const [newPhrase, setNewPhrase] = useState('');
  const { data: orModels = [] } = trpc.ai.listModels.useQuery(undefined, { enabled: open, staleTime: 3600_000 });

  const update = <K extends keyof WriterSettings>(
    section: K,
    field: string,
    value: any,
  ) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const handleSave = () => {
    saveSettings(settings);
    onSettingsChange?.(settings);
    toast.success('Settings saved');
    setOpen(false);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    toast.info('Settings reset to defaults');
  };

  const addBannedPhrase = () => {
    const phrase = newPhrase.trim().toLowerCase();
    if (!phrase) return;
    if (settings.filters.customBannedPhrases.includes(phrase)) {
      toast.error('Phrase already exists');
      return;
    }
    update('filters', 'customBannedPhrases', [...settings.filters.customBannedPhrases, phrase]);
    setNewPhrase('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Writer Settings">
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Writer Configuration
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ai" className="mt-4">
          <TabsList className="w-full grid grid-cols-6">
            <TabsTrigger value="ai" className="text-xs gap-1">
              <Bot className="w-3.5 h-3.5" /> AI
            </TabsTrigger>
            <TabsTrigger value="models" className="text-xs gap-1">
              <Cpu className="w-3.5 h-3.5" /> Models
            </TabsTrigger>
            <TabsTrigger value="filters" className="text-xs gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Filters
            </TabsTrigger>
            <TabsTrigger value="export" className="text-xs gap-1">
              <FileDown className="w-3.5 h-3.5" /> Export
            </TabsTrigger>
            <TabsTrigger value="scoring" className="text-xs gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Scoring
            </TabsTrigger>
            <TabsTrigger value="presets" className="text-xs gap-1">
              <LayoutTemplate className="w-3.5 h-3.5" /> Presets
            </TabsTrigger>
          </TabsList>

          {/* ═══ AI Behavior ═══ */}
          <TabsContent value="ai" className="space-y-5 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Bot className="w-4 h-4" /> Default AI Model
              </Label>
              <Select value={settings.ai.defaultModel} onValueChange={v => update('ai', 'defaultModel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-sonnet">Claude Sonnet 4 (Anthropic)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (OpenAI)</SelectItem>
                  <SelectItem value="gemini-pro">Gemini 2.5 Pro (Google)</SelectItem>
                  <SelectItem value="deepseek-r1">DeepSeek R1 (Deep Reasoning)</SelectItem>
                  <SelectItem value="llama-70b">Llama 3.3 70B (Meta)</SelectItem>
                  <SelectItem value="qwen-72b">Qwen 72B</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for AI Draft, AI Score, and autonomous writing agents</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Thermometer className="w-4 h-4" /> Temperature: {settings.ai.temperature.toFixed(1)}
              </Label>
              <Slider
                value={[settings.ai.temperature * 10]}
                onValueChange={([v]) => update('ai', 'temperature', v / 10)}
                min={0} max={10} step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0.0 — Precise</span>
                <span>0.7 — Balanced</span>
                <span>1.0 — Creative</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Research Depth</Label>
              <Select value={settings.ai.depth} onValueChange={v => update('ai', 'depth', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick (3-5 key facts, fast)</SelectItem>
                  <SelectItem value="standard">Standard (10+ facts, multiple angles)</SelectItem>
                  <SelectItem value="deep">Deep (comprehensive, multi-source, 30s+)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Gauge className="w-4 h-4" /> Max Tokens: {settings.ai.maxTokens.toLocaleString()}
              </Label>
              <Slider
                value={[settings.ai.maxTokens]}
                onValueChange={([v]) => update('ai', 'maxTokens', v)}
                min={1024} max={16384} step={512}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1K — Short</span>
                <span>4K — Standard</span>
                <span>16K — Long-form</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Deep Research Model</Label>
              <Select value={settings.ai.researchModel} onValueChange={v => update('ai', 'researchModel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deepseek-r1">DeepSeek R1 (Best for reasoning)</SelectItem>
                  <SelectItem value="gemini-pro">Gemini 2.5 Pro (Best for synthesis)</SelectItem>
                  <SelectItem value="claude-sonnet">Claude Sonnet 4 (Best for writing)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o (Best all-around)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Auto-Research on Draft</Label>
                <p className="text-xs text-muted-foreground">Automatically runs deep research before AI drafting</p>
              </div>
              <Switch checked={settings.ai.autoResearch} onCheckedChange={v => update('ai', 'autoResearch', v)} />
            </div>
          </TabsContent>

          {/* ═══ Content Filters ═══ */}
          <TabsContent value="filters" className="space-y-5 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Languages className="w-4 h-4" /> Enforce US English
                </Label>
                <p className="text-xs text-muted-foreground">Flag British spellings (colour → color, analyse → analyze)</p>
              </div>
              <Switch checked={settings.filters.enforceUsEnglish} onCheckedChange={v => update('filters', 'enforceUsEnglish', v)} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Ban className="w-4 h-4" /> Block Export on British
                </Label>
                <p className="text-xs text-muted-foreground">Prevent export if British spellings are present</p>
              </div>
              <Switch checked={settings.filters.blockOnBritish} onCheckedChange={v => update('filters', 'blockOnBritish', v)} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">AI Slop Tolerance</Label>
              <Select value={settings.filters.slopSeverityLevel} onValueChange={v => update('filters', 'slopSeverityLevel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="strict">Strict — Flag all AI patterns (0 tolerance)</SelectItem>
                  <SelectItem value="moderate">Moderate — Flag high + medium severity</SelectItem>
                  <SelectItem value="relaxed">Relaxed — Only flag worst offenders</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Max Slop Phrases Before Block: {settings.filters.maxSlopAllowed}</Label>
              <Slider
                value={[settings.filters.maxSlopAllowed]}
                onValueChange={([v]) => update('filters', 'maxSlopAllowed', v)}
                min={0} max={10} step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0 — Zero tolerance</span>
                <span>3 — Standard</span>
                <span>10 — Permissive</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Block Export on Slop</Label>
                <p className="text-xs text-muted-foreground">Prevent export if slop count exceeds threshold</p>
              </div>
              <Switch checked={settings.filters.blockOnSlop} onCheckedChange={v => update('filters', 'blockOnSlop', v)} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Custom Banned Phrases</Label>
              <div className="flex gap-2">
                <Input
                  value={newPhrase}
                  onChange={e => setNewPhrase(e.target.value)}
                  placeholder="Add phrase to ban..."
                  className="text-xs"
                  onKeyDown={e => e.key === 'Enter' && addBannedPhrase()}
                />
                <Button size="sm" variant="outline" onClick={addBannedPhrase}>Add</Button>
              </div>
              {settings.filters.customBannedPhrases.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {settings.filters.customBannedPhrases.map((phrase, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/10"
                      onClick={() => update('filters', 'customBannedPhrases', settings.filters.customBannedPhrases.filter((_, j) => j !== i))}>
                      {phrase} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Min Score to Publish: {settings.filters.minPublishScore}/10</Label>
              <Slider
                value={[settings.filters.minPublishScore]}
                onValueChange={([v]) => update('filters', 'minPublishScore', v)}
                min={1} max={10} step={1}
                className="w-full"
              />
            </div>
          </TabsContent>

          {/* ═══ Export Defaults ═══ */}
          <TabsContent value="export" className="space-y-5 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Default Export Format</Label>
              <Select value={settings.exports.defaultFormat} onValueChange={v => update('exports', 'defaultFormat', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF (Print-to-PDF)</SelectItem>
                  <SelectItem value="html">HTML (Formatted, Georgia serif)</SelectItem>
                  <SelectItem value="txt">Plain Text (.txt)</SelectItem>
                  <SelectItem value="md">Markdown (.md)</SelectItem>
                  <SelectItem value="gdoc">Google Doc (auto-create)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">File Name Pattern</Label>
              <Input
                value={settings.exports.fileNamePattern}
                onChange={e => update('exports', 'fileNamePattern', e.target.value)}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Variables: {'{title}'}, {'{date}'}, {'{publication}'}, {'{score}'}, {'{template}'}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Include Meta Header</Label>
                <p className="text-xs text-muted-foreground">Add word count, publication, date to exported files</p>
              </div>
              <Switch checked={settings.exports.includeMetaHeader} onCheckedChange={v => update('exports', 'includeMetaHeader', v)} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Include Score Footer</Label>
                <p className="text-xs text-muted-foreground">Add quality scores to exported files</p>
              </div>
              <Switch checked={settings.exports.includeScoreFooter} onCheckedChange={v => update('exports', 'includeScoreFooter', v)} />
            </div>
          </TabsContent>

          {/* ═══ Scoring ═══ */}
          <TabsContent value="scoring" className="space-y-5 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Auto-Score</Label>
                <p className="text-xs text-muted-foreground">Automatically score content as you write</p>
              </div>
              <Switch checked={settings.scoring.autoScore} onCheckedChange={v => update('scoring', 'autoScore', v)} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Show Quality Badge</Label>
                <p className="text-xs text-muted-foreground">Display quality grade (A-F) in toolbar</p>
              </div>
              <Switch checked={settings.scoring.showQualityBadge} onCheckedChange={v => update('scoring', 'showQualityBadge', v)} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Min Grade to Publish</Label>
              <Select value={settings.scoring.minPublishGrade} onValueChange={v => update('scoring', 'minPublishGrade', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A — Only publish excellence</SelectItem>
                  <SelectItem value="B">B — Publish good+ quality</SelectItem>
                  <SelectItem value="C">C — Publish acceptable quality</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Auto-Score After: {settings.filters.autoScoreAfterWords} words
              </Label>
              <Slider
                value={[settings.filters.autoScoreAfterWords]}
                onValueChange={([v]) => update('filters', 'autoScoreAfterWords', v)}
                min={50} max={500} step={50}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Start auto-scoring after this many words</p>
            </div>
          </TabsContent>

          {/* ═══ Models ═══ */}
          <TabsContent value="models" className="space-y-5 mt-4">
            <p className="text-xs text-muted-foreground">
              Pick the model for each tier. Leave blank to use the server default.
              Choices persist across sessions and override all task defaults.
            </p>

            {([
              { key: 'fast' as const,     label: 'Draft / Research / Humanize / Expand', hint: 'Default: google/gemini-2.5-flash (~5–10s)' },
              { key: 'standard' as const, label: 'Publish-grade Proofread',               hint: 'Default: anthropic/claude-sonnet-4.6' },
              { key: 'cheap' as const,    label: 'Scoring / Headlines',                   hint: 'Default: anthropic/claude-haiku-4.5' },
              { key: 'pipeline' as const, label: 'Full Pipeline (queue)',                 hint: 'Default: google/gemini-2.5-flash' },
            ] as const).map(({ key, label, hint }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm font-medium">{label}</Label>
                <p className="text-[10px] text-muted-foreground">{hint}</p>
                <Select
                  value={settings.models[key] || '__default__'}
                  onValueChange={v => update('models', key, v === '__default__' ? '' : v)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Server default" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="__default__" className="text-xs text-muted-foreground">
                      Server default
                    </SelectItem>
                    {orModels.length === 0 && (
                      <SelectItem value="__loading__" disabled className="text-xs">
                        Loading models…
                      </SelectItem>
                    )}
                    {orModels.map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.name}
                        {Number(m.pricing.prompt) === 0 && (
                          <Badge variant="secondary" className="ml-2 text-[10px] px-1 py-0">free</Badge>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </TabsContent>

          {/* ═══ Presets ═══ */}
          <TabsContent value="presets" className="space-y-5 mt-4">
            <div className="text-center py-8">
              <LayoutTemplate className="w-12 h-12 mx-auto text-muted-foreground opacity-40 mb-3" />
              <p className="text-sm font-medium">Template Presets</p>
              <p className="text-xs text-muted-foreground mt-1">
                Save your current settings as a named preset for quick switching.
                <br />Coming soon — save per-publication and per-brand presets.
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="outline" size="sm" className="text-xs" disabled>
                  Save as Preset
                </Button>
                <Button variant="outline" size="sm" className="text-xs" disabled>
                  Load Preset
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
          <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={handleReset}>
            <RotateCcw className="w-3 h-3" /> Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="text-xs gap-1" onClick={handleSave}>
              <Save className="w-3 h-3" /> Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
