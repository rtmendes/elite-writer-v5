/**
 * ArticleDetailModal — V4 Giststack deep-view modal ported to V5
 * 
 * Features:
 * - Full article detail view with key topics, entities, data signals
 * - "Enrich with AI" deep research (scrapes article → extracts quotes, stats, counter-arguments)
 * - "Send to Editor" with full structured content packet (→ Writer with research_notes)
 * - "Save Brief" to research notes
 * - Per-article AI scoring with viral_score, sentiment, niche_tags, hook suggestions
 */

import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Brain, Sparkles, PenTool, Bookmark, ExternalLink, Users, Building2,
  BarChart3, Zap, Quote, AlertTriangle, Target, Clock, Loader2,
  Lightbulb, TrendingUp, BookOpen, Send, Star, DollarSign, Percent, FileText,
} from 'lucide-react';
import { matchArticleToPublications, type PublicationMatch } from '@/lib/publication-matcher';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface FeedItemForModal {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  relevance_score: number;
  saved?: boolean;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
  publishedAt?: string;
  feedCategory?: string;
  hot?: boolean;
}

interface ArticleScore {
  viral_score: number;
  sentiment: string;
  niche_tags: string[];
  reasoning: string;
  hook_suggestions: string[];
  suggested_publications: string[];
}

interface ArticleIntelligence {
  expert_quotes: string[];
  key_statistics: string[];
  contradictory_viewpoints: string[];
  key_entities: {
    people: string[];
    organizations: string[];
  };
  content_brief: {
    recommended_angle?: string;
    news_peg?: string;
    unique_angle?: string;
    editor_pitch?: string;
    competitive_angle?: string;
    suggested_headline?: string;
    target_word_count?: number;
    urgency?: string;
  };
}

interface Props {
  item: FeedItemForModal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER — Client-side entity extraction (from V4)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function extractEntities(text: string) {
  const people: string[] = [];
  const orgs: string[] = [];
  const seen = new Set<string>();
  const matches = text.match(/\b([A-Z][a-z]{1,15}(?:\s+[A-Z][a-z]{1,15}){1,3})\b/g) || [];
  const orgTerms = new Set(['Inc', 'Corp', 'LLC', 'Ltd', 'Co', 'Group', 'Institute', 'Foundation', 'University', 'College', 'Bank', 'Capital', 'Fund', 'Association']);
  const stopWords = new Set(['The', 'This', 'That', 'These', 'Those', 'Their', 'There', 'Here', 'When', 'Where', 'What', 'Which', 'How', 'Why', 'Who', 'Some', 'Many', 'Most', 'More', 'Also', 'Just', 'Then', 'Than', 'With', 'From', 'Into', 'Over']);
  for (const m of matches) {
    const key = m.toLowerCase();
    if (seen.has(key) || stopWords.has(m.split(' ')[0])) continue;
    if (m.split(' ').length < 2) continue;
    seen.add(key);
    const lastWord = m.split(' ').pop() || '';
    if (orgTerms.has(lastWord)) {
      if (orgs.length < 5) orgs.push(m);
    } else {
      if (people.length < 5) people.push(m);
    }
  }
  return { people, orgs };
}

function extractDataSignals(text: string): string[] {
  const signals = new Set<string>();
  (text.match(/\b\d+(?:\.\d+)?%/g) || []).forEach(s => signals.add(s));
  (text.match(/\$[\d,]+(?:\.\d+)?[BMKbmk]?\b/g) || []).forEach(s => signals.add(s));
  (text.match(/\b\d{1,3}(?:,\d{3})+\b/g) || []).forEach(s => signals.add(s));
  (text.match(/\b\d+(?:\.\d+)?x\b/gi) || []).forEach(s => signals.add(s.toLowerCase()));
  return [...signals].slice(0, 8);
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function ArticleDetailModal({ item, open, onOpenChange }: Props) {
  const { addIdea, addResearch } = useApp();

  const [aiScore, setAiScore] = useState<ArticleScore | null>(null);
  const [intelligence, setIntelligence] = useState<ArticleIntelligence | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const scoreArticleMutation = trpc.news.scoreArticle.useMutation();
  const enrichArticleMutation = trpc.news.enrichArticle.useMutation();

  // Publication match intelligence — hooks must be called before any early return
  const pubMatches = useMemo(() => 
    item ? matchArticleToPublications(item.title, item.summary, item.category, item.source, item.relevance_score) : [],
    [item?.title, item?.summary, item?.category, item?.source, item?.relevance_score]
  );

  if (!item) return null;

  const text = `${item.title} ${item.summary}`;
  const entities = extractEntities(text);
  const dataSignals = extractDataSignals(text);
  const sentimentEmoji = item.sentiment === 'positive' ? '😊' : item.sentiment === 'negative' ? '😟' : item.sentiment === 'mixed' ? '🤔' : '😐';

  // ── AI Score ──
  const handleScore = async () => {
    setIsScoring(true);
    try {
      const result = await scoreArticleMutation.mutateAsync({
        title: item.title,
        description: item.summary,
        source: item.source,
        url: item.url,
      });
      setAiScore({
        viral_score: result.viral_score,
        sentiment: result.sentiment,
        niche_tags: result.niche_tags,
        reasoning: result.reasoning,
        hook_suggestions: result.hook_suggestions,
        suggested_publications: result.suggested_publications,
      });
      toast.success(`Scored: ${result.viral_score}/100 viral potential`);
    } catch (err: any) {
      toast.error(err.message || 'Scoring failed');
    } finally {
      setIsScoring(false);
    }
  };

  // ── Deep Research / Enrich ──
  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
      const result = await enrichArticleMutation.mutateAsync({
        url: item.url,
        title: item.title,
        description: item.summary,
      });
      setIntelligence(result.intelligence);
      toast.success(`Enriched — ${result.article_text_length.toLocaleString()} chars analyzed`);
    } catch (err: any) {
      toast.error(err.message || 'Enrichment failed');
    } finally {
      setIsEnriching(false);
    }
  };

  // ── Send to Editor (creates idea + research note, navigates to Writer) ──
  const handleSendToEditor = () => {
    const brief = intelligence?.content_brief || {};
    const score = aiScore;

    // Create research note first
    const researchNote = addResearch({
      title: item.title,
      content: JSON.stringify({
        version: 1,
        news_peg: brief.news_peg || score?.reasoning || '',
        story_angle: brief.unique_angle || item.summary,
        editor_pitch: brief.editor_pitch || '',
        urgency: brief.urgency || `Published ${relativeTime(item.publishedAt)} · ${item.source}`,
        competitive_angle: brief.competitive_angle || '',
        key_sources: [`${item.source} — ${item.url}`],
        summary: item.title,
        full_content: item.summary,
        key_trends: score?.niche_tags || [],
        data_points: intelligence?.key_statistics?.map(s => ({ stat: s, source_name: item.source, source_url: item.url })) || [],
        expert_sources: intelligence?.expert_quotes?.map(q => {
          const parts = q.split(' — ');
          return { name: parts[1] || 'Source', title: parts[2] || '', why_them: parts[0] || q, url: item.url };
        }) || [],
        counterintuitive_angles: intelligence?.contradictory_viewpoints || [],
        sources: [{ title: item.title, url: item.url, name: item.source }],
        suggested_headline: brief.suggested_headline,
        recommended_angle: brief.recommended_angle,
      }),
      sources: [item.url],
      data_points: intelligence?.key_statistics?.map(s => ({
        label: 'Statistic',
        value: s,
        source: item.source,
      })) || [],
    });

    // Create idea linked to research
    const idea = addIdea({
      title: brief.suggested_headline || item.title,
      angle: brief.recommended_angle || item.summary,
      category: item.category,
      news_peg: brief.news_peg || score?.reasoning || item.source,
      status: 'researching',
      score: score?.viral_score,
      matched_publications: score?.suggested_publications || pubMatches.slice(0, 5).map(m => m.publication.name),
    });

    onOpenChange(false);
    toast.success('Research packet sent to Ideas → open Writer to start drafting', {
      action: {
        label: 'Go to Ideas',
        onClick: () => window.location.href = '/ideas',
      },
    });
  };

  // ── Save as Brief ──
  const handleSaveBrief = () => {
    addResearch({
      title: item.title,
      content: JSON.stringify({
        recommended_angle: { headline: item.title, angle: item.summary, why_now: aiScore?.reasoning || '' },
        key_trends: aiScore?.niche_tags || [],
        hook_suggestions: aiScore?.hook_suggestions || [],
        sources: [{ title: item.title, url: item.url }],
        intelligence: intelligence || null,
      }),
      sources: [item.url],
      data_points: [],
    });
    toast.success('Saved as Research Brief!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
            <span className="text-xs text-muted-foreground">{item.source}</span>
            {item.hot && (
              <Badge variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-500 border-amber-500/30">
                🔥 HOT
              </Badge>
            )}
            {item.sentiment && (
              <Badge variant="outline" className="text-[10px]">
                {sentimentEmoji} {item.sentiment}
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-xs font-mono text-amber-400">
                {aiScore ? aiScore.viral_score : item.relevance_score}%
              </span>
            </div>
          </div>
          <DialogTitle className="text-lg leading-snug pr-8">{item.title}</DialogTitle>
          {item.publishedAt && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3" />
              {new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              <span className="opacity-60">({relativeTime(item.publishedAt)})</span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* AI Score Section */}
          {aiScore && (
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">AI Score</span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-2xl font-bold text-indigo-400">{aiScore.viral_score}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
              </div>
              <p className="text-sm text-foreground/80">{aiScore.reasoning}</p>
              {aiScore.niche_tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {aiScore.niche_tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
              )}
              {aiScore.hook_suggestions.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" /> Hook Suggestions
                  </div>
                  <ul className="space-y-1">
                    {aiScore.hook_suggestions.map((hook, i) => (
                      <li key={i} className="text-xs text-foreground/80 pl-3 border-l-2 border-indigo-500/30">{hook}</li>
                    ))}
                  </ul>
                </div>
              )}
              {aiScore.suggested_publications.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Target className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target:</span>
                  {aiScore.suggested_publications.map((pub, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{pub}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Key Topics (from heuristic) */}
          {(entities.people.length > 0 || entities.orgs.length > 0) && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <Users className="w-3 h-3 text-purple-500" /> Key Entities
              </div>
              <div className="flex flex-wrap gap-2">
                {entities.people.map((p, i) => (
                  <Badge key={`p${i}`} variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">{p}</Badge>
                ))}
                {entities.orgs.map((o, i) => (
                  <Badge key={`o${i}`} variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                    <Building2 className="w-2.5 h-2.5 mr-0.5" />{o}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Data Signals */}
          {dataSignals.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-blue-500" /> Data Signals
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dataSignals.map((d, i) => (
                  <Badge key={i} className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">{d}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Article Excerpt */}
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Article Excerpt</div>
            <p className="text-sm leading-relaxed text-foreground/80">{item.summary || 'No excerpt available. Click Open Article to view the full text.'}</p>
          </div>

          <Separator />

          {/* Deep Research Intelligence (after enrichment) */}
          {intelligence && (
            <div className="rounded-lg border border-indigo-500/15 bg-indigo-500/[0.03] p-4 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Brain className="w-4 h-4" /> AI Research Intelligence
              </div>

              {/* Content Brief */}
              {intelligence.content_brief?.recommended_angle && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> Content Brief
                  </div>
                  <div className="grid gap-2 text-xs">
                    {intelligence.content_brief.recommended_angle && (
                      <div className="pl-3 border-l-2 border-amber-500/30">
                        <span className="font-semibold text-amber-400">Angle:</span>{' '}
                        <span className="text-foreground/80">{intelligence.content_brief.recommended_angle}</span>
                      </div>
                    )}
                    {intelligence.content_brief.news_peg && (
                      <div className="pl-3 border-l-2 border-amber-500/30">
                        <span className="font-semibold text-amber-400">News Peg:</span>{' '}
                        <span className="text-foreground/80">{intelligence.content_brief.news_peg}</span>
                      </div>
                    )}
                    {intelligence.content_brief.editor_pitch && (
                      <div className="pl-3 border-l-2 border-amber-500/30">
                        <span className="font-semibold text-amber-400">Editor Pitch:</span>{' '}
                        <span className="text-foreground/80">{intelligence.content_brief.editor_pitch}</span>
                      </div>
                    )}
                    {intelligence.content_brief.suggested_headline && (
                      <div className="pl-3 border-l-2 border-amber-500/30">
                        <span className="font-semibold text-amber-400">Headline:</span>{' '}
                        <span className="text-foreground/80 font-medium">{intelligence.content_brief.suggested_headline}</span>
                      </div>
                    )}
                    <div className="flex gap-4 text-[10px] text-muted-foreground mt-1">
                      {intelligence.content_brief.target_word_count && (
                        <span>📝 ~{intelligence.content_brief.target_word_count} words</span>
                      )}
                      {intelligence.content_brief.urgency && (
                        <span>⏰ {intelligence.content_brief.urgency} urgency</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Expert Quotes */}
              {intelligence.expert_quotes.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mb-1.5 flex items-center gap-1">
                    <Quote className="w-3 h-3" /> Expert Quotes & Sources
                  </div>
                  <ul className="space-y-1">
                    {intelligence.expert_quotes.map((q, i) => (
                      <li key={i} className="text-xs text-foreground/80 pl-3 border-l-2 border-purple-500/30">{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Statistics */}
              {intelligence.key_statistics.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1.5 flex items-center gap-1">
                    <BarChart3 className="w-3 h-3" /> Key Statistics
                  </div>
                  <ul className="space-y-1">
                    {intelligence.key_statistics.map((s, i) => (
                      <li key={i} className="text-xs text-foreground/80 pl-3 border-l-2 border-blue-500/30">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contradictory Viewpoints */}
              {intelligence.contradictory_viewpoints.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Contradictory Viewpoints
                  </div>
                  <ul className="space-y-1">
                    {intelligence.contradictory_viewpoints.map((v, i) => (
                      <li key={i} className="text-xs text-foreground/80 pl-3 border-l-2 border-red-500/30">{v}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Entities from AI */}
              {(intelligence.key_entities.people.length > 0 || intelligence.key_entities.organizations.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {intelligence.key_entities.people.map((p, i) => (
                    <Badge key={`ap${i}`} variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">{p}</Badge>
                  ))}
                  {intelligence.key_entities.organizations.map((o, i) => (
                    <Badge key={`ao${i}`} variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">{o}</Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Publication Match Intelligence */}
          {pubMatches.length > 0 && (
            <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Target className="w-4 h-4" /> Publication Match Intelligence
                </div>
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                  {pubMatches.length} matches
                </Badge>
              </div>
              <div className="space-y-2">
                {pubMatches.slice(0, 5).map((m, i) => (
                  <div key={i} className={`p-2.5 rounded-md border transition-colors ${
                    i === 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 hover:border-emerald-500/20'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-[10px]">🏆</span>}
                        <span className="text-sm font-semibold">{m.publication.name}</span>
                        <Badge variant="outline" className={`text-[9px] ${
                          m.tier === 'Tier 1' ? 'border-amber-500/30 text-amber-400' :
                          m.tier === 'Tier 2' ? 'border-blue-500/30 text-blue-400' :
                          'border-muted-foreground/30 text-muted-foreground'
                        }`}>{m.tier}</Badge>
                        <Badge variant="outline" className={`text-[9px] ${
                          m.newsPegStrength === 'strong' ? 'border-emerald-500/30 text-emerald-400' :
                          m.newsPegStrength === 'moderate' ? 'border-amber-500/30 text-amber-400' :
                          'border-muted-foreground/30 text-muted-foreground'
                        }`}>
                          {m.newsPegStrength === 'strong' ? '⚡' : m.newsPegStrength === 'moderate' ? '◐' : '○'} peg
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-emerald-400">{m.matchScore}%</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-foreground/70 mb-1.5">{m.whyItFits}</p>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <DollarSign className="w-2.5 h-2.5" /> {m.payRange}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Percent className="w-2.5 h-2.5" /> {m.acceptanceRate} acceptance
                      </span>
                      {m.publication.traffic_monthly && (
                        <span className="flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5" /> {m.publication.traffic_monthly}/mo
                        </span>
                      )}
                      {m.hasSOP && (
                        <span className="flex items-center gap-0.5 text-emerald-400">
                          <FileText className="w-2.5 h-2.5" /> SOP ready
                        </span>
                      )}
                    </div>
                    {i < 3 && (
                      <div className="mt-1.5 pl-2.5 border-l-2 border-emerald-500/20">
                        <p className="text-[10px] text-foreground/60 italic">{m.suggestedAngle}</p>
                      </div>
                    )}
                    {m.topicAlignment.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {m.topicAlignment.map((kw, j) => (
                          <span key={j} className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80">{kw}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source Citation */}
          <div className="rounded-lg bg-muted/30 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Source Citation</div>
            <div className="text-xs text-muted-foreground">
              {item.source} ·{' '}
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                {item.url}
              </a>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <DialogFooter className="flex-wrap gap-2 mt-4">
          {!aiScore && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleScore} disabled={isScoring}>
              {isScoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {isScoring ? 'Scoring…' : 'AI Score'}
            </Button>
          )}
          <Button
            variant={intelligence ? "outline" : "secondary"}
            size="sm"
            className="gap-1.5"
            onClick={handleEnrich}
            disabled={isEnriching}
          >
            {isEnriching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            {isEnriching ? 'Enriching…' : intelligence ? '✓ Enriched' : 'Deep Research'}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSendToEditor}>
            <Send className="w-3.5 h-3.5" /> Send to Editor
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleSaveBrief}>
            <Bookmark className="w-3.5 h-3.5" /> Save Brief
          </Button>
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Open Article
            </Button>
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
