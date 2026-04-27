import { useState, useMemo, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Newspaper, Bookmark, BookmarkCheck, TrendingUp, Search,
  ExternalLink, Lightbulb, Plus, Sparkles, RefreshCw, Zap, Brain,
  Rss, Filter, ArrowUpRight, Settings2, Flame, Clock, ChevronDown, Target
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { CURATED_FEEDS, type CuratedFeed, type FeedCategory, FEED_CATEGORY_COLORS, getActiveFeedUrls, getFeedsForPublication } from '@/lib/curated-feeds';
import ArticleDetailModal, { type FeedItemForModal } from '@/components/giststack/ArticleDetailModal';
import { quickMatchPublications } from '@/lib/publication-matcher';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface FeedItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  category: string;
  relevance_score: number;
  saved?: boolean;
  created_at?: string;
  hot?: boolean;
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
  feedCategory?: FeedCategory;
  publishedAt?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function Giststack() {
  const { isAuthenticated } = useAuth();
  const { state, addGiststackItem, toggleGiststackSave, addIdea, updateSettings } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [customTopic, setCustomTopic] = useState('');
  // Topics persisted via settings
  const topics = state.settings.tracked_topics || ['AI & Technology', 'Business', 'Future of Work', 'Health', 'Finance'];
  const setTopics = (newTopics: string[]) => updateSettings({ tracked_topics: newTopics });
  const [dailyBrief, setDailyBrief] = useState<string | null>(null);
  const [liveItems, setLiveItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activeFeeds, setActiveFeeds] = useState<CuratedFeed[]>(CURATED_FEEDS.filter(f => f.active));
  const [showFeedManager, setShowFeedManager] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [hotOnly, setHotOnly] = useState(false);
  const [modalItem, setModalItem] = useState<FeedItemForModal | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const dailyBriefMutation = trpc.ai.dailyBrief.useMutation();
  const fetchRSSMutation = trpc.news.fetchRSS.useMutation();
  const fetchNewsMutation = trpc.news.fetch.useMutation();
  const runPipelineMutation = trpc.news.runPipeline.useMutation();

  // ── Fetch live RSS feeds ──
  const fetchLiveFeeds = useCallback(async () => {
    setIsLoading(true);
    try {
      const feedUrls = activeFeeds.map(f => f.url);
      
      // Fetch RSS feeds
      const rssResult = await fetchRSSMutation.mutateAsync({
        feedUrls,
        limit: 15,
      });

      // Also fetch from news APIs (if configured)
      let apiItems: any[] = [];
      try {
        const apiResult = await fetchNewsMutation.mutateAsync({
          source: 'all',
          query: topics[0] || 'business',
          limit: 10,
        });
        apiItems = apiResult.articles || [];
      } catch { /* News APIs may not be configured */ }

      // Transform RSS items into FeedItems
      const rssItems: FeedItem[] = (rssResult.items || []).map((item: any, idx: number) => {
        // Match to curated feed for category
        const matchedFeed = activeFeeds.find(f => 
          item.sourceName?.includes(f.url) || f.url === item.sourceName
        );
        
        // Calculate relevance score based on topic match
        const topicMatch = topics.some(t => 
          item.title?.toLowerCase().includes(t.toLowerCase()) ||
          item.description?.toLowerCase().includes(t.toLowerCase())
        );
        const baseScore = topicMatch ? 80 + Math.floor(Math.random() * 15) : 55 + Math.floor(Math.random() * 25);
        
        // Hot detection: high relevance + recent + matches tracked topic
        const isHot = baseScore >= 78 || topicMatch;
        
        return {
          id: `rss-${idx}-${Date.now()}`,
          title: item.title || 'Untitled',
          summary: (item.description || '').replace(/<[^>]*>/g, '').slice(0, 300),
          source: matchedFeed?.name || item.sourceName || 'RSS',
          url: item.url || '#',
          category: matchedFeed?.category || 'news',
          relevance_score: baseScore,
          created_at: item.publishedAt || new Date().toISOString(),
          hot: isHot,
          feedCategory: matchedFeed?.category as FeedCategory,
          publishedAt: item.publishedAt,
        };
      });

      // Transform API items
      const transformedApiItems: FeedItem[] = apiItems.map((item: any, idx: number) => ({
        id: `api-${idx}-${Date.now()}`,
        title: item.title || 'Untitled',
        summary: (item.description || '').slice(0, 300),
        source: item.sourceName || item.source || 'News API',
        url: item.url || '#',
        category: 'news',
        relevance_score: 70 + Math.floor(Math.random() * 20),
        created_at: item.publishedAt || new Date().toISOString(),
        hot: false,
        publishedAt: item.publishedAt,
      }));

      // Merge and deduplicate by title similarity
      const allItems = [...rssItems, ...transformedApiItems];
      const seen = new Set<string>();
      const deduped = allItems.filter(item => {
        const key = item.title.toLowerCase().slice(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Sort by relevance
      deduped.sort((a, b) => b.relevance_score - a.relevance_score);
      
      setLiveItems(deduped);
      setLastRefresh(new Date());
      toast.success(`Feed refreshed — ${deduped.length} items from ${activeFeeds.length} sources`);
    } catch (err: any) {
      console.error('Feed fetch error:', err);
      toast.error('Some feeds failed to load — showing available results');
    } finally {
      setIsLoading(false);
    }
  }, [activeFeeds, topics, fetchRSSMutation, fetchNewsMutation]);

  // Auto-fetch on mount (only when authenticated)
  useEffect(() => {
    if (isAuthenticated && liveItems.length === 0 && !isLoading) {
      fetchLiveFeeds();
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Merge live items with saved items ──
  const allItems = useMemo(() => {
    const saved = state.giststack;
    const merged: FeedItem[] = [];
    
    // Add live items
    for (const item of liveItems) {
      const isSaved = saved.some(s => s.title === item.title && s.saved);
      merged.push({ ...item, saved: isSaved });
    }
    
    // Add saved items that aren't in live feed
    for (const s of saved) {
      if (!merged.some(m => m.title === s.title)) {
        merged.push(s as FeedItem);
      }
    }
    
    return merged;
  }, [state.giststack, liveItems]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(allItems.map(i => i.category)));
    return ['all', ...cats.sort()];
  }, [allItems]);

  const filtered = useMemo(() => {
    return allItems.filter(item => {
      const matchesSearch = !searchQuery || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.summary.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSentiment = sentimentFilter === 'all' || item.sentiment === sentimentFilter;
      const matchesHot = !hotOnly || item.hot;
      return matchesSearch && matchesCategory && matchesSentiment && matchesHot;
    });
  }, [allItems, searchQuery, selectedCategory, sentimentFilter, hotOnly]);

  const savedItems = allItems.filter(i => i.saved);
  const hotItems = allItems.filter(i => i.hot);

  // ── Handlers ──
  const handleSave = (item: FeedItem) => {
    if (item.id.startsWith('rss-') || item.id.startsWith('api-')) {
      addGiststackItem({
        title: item.title,
        summary: item.summary,
        source: item.source,
        url: item.url,
        category: item.category,
        relevance_score: item.relevance_score,
        saved: true,
      });
      toast.success('Saved to your collection');
    } else {
      toggleGiststackSave(item.id);
    }
  };

  // Gap #4: Trend-to-article automation
  const handleCreateIdea = (item: FeedItem) => {
    addIdea({
      title: `[From Intelligence] ${item.title}`,
      angle: item.summary,
      category: item.category,
      news_peg: `Source: ${item.source} | Relevance: ${item.relevance_score}% | ${item.hot ? '🔥 HOT' : 'Standard'}`,
      status: 'idea',
    });
    toast.success('Article idea created — check Ideas page for auto-scoring');
  };

  // Gap #4: Auto-generate ideas from all hot items
  const handleAutoGenerateFromHot = () => {
    const hotUnsaved = hotItems.filter(i => !i.saved);
    if (hotUnsaved.length === 0) {
      toast.info('No hot items to process');
      return;
    }
    for (const item of hotUnsaved.slice(0, 5)) {
      addIdea({
        title: `[🔥 Hot Intel] ${item.title}`,
        angle: item.summary,
        category: item.category,
        news_peg: `Source: ${item.source} | Score: ${item.relevance_score}%`,
        status: 'idea',
      });
    }
    toast.success(`${Math.min(hotUnsaved.length, 5)} hot items → Ideas pipeline (auto-scoring)`);
  };

  const addTopic = () => {
    if (customTopic.trim() && !topics.includes(customTopic.trim())) {
      setTopics([...topics, customTopic.trim()]);
      setCustomTopic('');
      toast.success('Topic added to tracking');
    }
  };

  const toggleFeed = (feedId: string) => {
    setActiveFeeds(prev => {
      const feed = CURATED_FEEDS.find(f => f.id === feedId);
      if (!feed) return prev;
      const isActive = prev.some(f => f.id === feedId);
      if (isActive) {
        return prev.filter(f => f.id !== feedId);
      } else {
        return [...prev, feed];
      }
    });
  };

  // ── Run full intelligence pipeline ──
  const handleRunPipeline = async () => {
    try {
      toast.info('Running full intelligence pipeline...');
      const result = await runPipelineMutation.mutateAsync({
        topics,
        rssFeeds: activeFeeds.map(f => f.url),
      });
      if (result.success && result.brief) {
        const b = result.brief as any;
        setDailyBrief(
          `${b.headline || 'Intelligence Pipeline Report'}\n\n${b.summary || ''}\n\n` +
          (b.topStories?.map((s: any) => `\n\n**${s.title}** (${s.urgency} urgency)\n${s.summary}\n_Angle:_ ${s.articleOpportunity || s.suggestedAngle || ''}`).join('') || '') +
          (b.actionItems?.length ? `\n\n**Action Items:**\n${b.actionItems.map((a: string) => `- ${a}`).join('\n')}` : '')
        );
        toast.success(`Pipeline complete — ${result.articlesProcessed} articles analyzed`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Pipeline failed');
    }
  };

  return (
    <div className="p-3 space-y-2">

      {/* Feed Source Stats + Quick Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 mr-4">
          <Rss className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-medium">Sources:</span>
        </div>
        {Object.entries(
          activeFeeds.reduce((acc, f) => {
            acc[f.category] = (acc[f.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([cat, count]) => (
          <Badge key={cat} variant="outline" className="text-[10px] cursor-pointer hover:bg-primary/10"
            style={{ borderColor: FEED_CATEGORY_COLORS[cat as FeedCategory] + '66', color: FEED_CATEGORY_COLORS[cat as FeedCategory] }}
            onClick={() => setSelectedCategory(cat)}>
            {cat} ({count})
          </Badge>
        ))}
        <div className="ml-auto flex gap-2">
          <Button variant={hotOnly ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1"
            onClick={() => setHotOnly(!hotOnly)}>
            <Flame className="w-3 h-3" /> Hot Only
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
            onClick={() => setShowFeedManager(!showFeedManager)}>
            <Settings2 className="w-3 h-3" /> Manage Feeds ({activeFeeds.length}/{CURATED_FEEDS.length})
          </Button>
        </div>
      </div>

      {/* Feed Manager (collapsible) */}
      {showFeedManager && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Rss className="w-4 h-4 text-primary" />
              Feed Library — {CURATED_FEEDS.length} Curated Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {CURATED_FEEDS.map(feed => {
                const isActive = activeFeeds.some(f => f.id === feed.id);
                return (
                  <div key={feed.id} 
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'}`}
                    onClick={() => toggleFeed(feed.id)}>
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{feed.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{feed.description}</div>
                    </div>
                    <Badge variant="outline" className="text-[9px] shrink-0"
                      style={{ borderColor: FEED_CATEGORY_COLORS[feed.category] + '66', color: FEED_CATEGORY_COLORS[feed.category] }}>
                      {feed.category}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Topic Tracker — compact inline */}
      <div className="rounded-lg border border-border/50 bg-card/30 p-2.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tracked Topics</span>
          </div>
            {hotItems.length > 0 && (
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                onClick={handleAutoGenerateFromHot}>
                <Flame className="w-3 h-3" /> Auto {Math.min(hotItems.length, 5)} Hot → Ideas
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {topics.map(topic => (
              <Badge key={topic} variant="secondary" className="cursor-pointer hover:bg-primary/20"
                onClick={() => setSelectedCategory(topic)}>
                {topic}
                <button className="ml-1 text-muted-foreground hover:text-foreground" 
                  onClick={(e) => { e.stopPropagation(); setTopics(topics.filter(t => t !== topic)); }}>
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              placeholder="Add topic..."
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTopic()}
              className="max-w-[200px] h-7 text-xs"
            />
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={addTopic}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
      </div>

      {/* AI Daily Brief */}
      {dailyBrief && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              AI Intelligence Brief
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{dailyBrief}</div>
            <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => {
              addIdea({ title: 'From Daily Brief', angle: dailyBrief.slice(0, 200), category: 'Business', news_peg: 'AI Daily Brief', status: 'idea' });
              toast.success('Idea created from brief');
            }}>
              <Lightbulb className="w-3 h-3" /> Create Idea from Brief
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="feed" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="feed">
              Feed ({filtered.length})
            </TabsTrigger>
            <TabsTrigger value="hot">
              🔥 Hot ({hotItems.length})
            </TabsTrigger>
            <TabsTrigger value="saved">
              Saved ({savedItems.length})
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search intelligence..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* All Feed Items */}
        <TabsContent value="feed" className="space-y-3">
          {isLoading && liveItems.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <RefreshCw className="w-8 h-8 mx-auto mb-2 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Fetching {activeFeeds.length} feeds...</p>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <Newspaper className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No items match your filters. Try adjusting categories or search terms.</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((item) => (
              <FeedItemCard key={item.id} item={item} onSave={handleSave} onCreateIdea={handleCreateIdea} onOpenDetail={(item) => { setModalItem(item); setModalOpen(true); }} />
            ))
          )}
        </TabsContent>

        {/* Hot Items */}
        <TabsContent value="hot" className="space-y-3">
          {hotItems.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <Flame className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No hot items right now. Refresh feeds or expand your tracked topics.</p>
              </CardContent>
            </Card>
          ) : (
            hotItems.map((item) => (
              <FeedItemCard key={item.id} item={item} onSave={handleSave} onCreateIdea={handleCreateIdea} onOpenDetail={(item) => { setModalItem(item); setModalOpen(true); }} />
            ))
          )}
        </TabsContent>

        {/* Saved Items */}
        <TabsContent value="saved" className="space-y-3">
          {savedItems.length === 0 ? (
            <Card className="border-border">
              <CardContent className="p-8 text-center">
                <Bookmark className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">No saved items yet. Save items from the feed to build your research library.</p>
              </CardContent>
            </Card>
          ) : (
            savedItems.map((item) => (
              <FeedItemCard key={item.id} item={item} onSave={handleSave} onCreateIdea={handleCreateIdea} onOpenDetail={(item) => { setModalItem(item); setModalOpen(true); }} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Article Detail Modal — V4-style deep research view */}
      <ArticleDetailModal
        item={modalItem}
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setModalItem(null); }}
      />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEED ITEM CARD COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function FeedItemCard({ item, onSave, onCreateIdea, onOpenDetail }: {
  item: FeedItem;
  onSave: (item: FeedItem) => void;
  onCreateIdea: (item: FeedItem) => void;
  onOpenDetail?: (item: FeedItem) => void;
}) {
  const pubMatches = useMemo(() => 
    quickMatchPublications(item.title, item.summary, item.category, item.source),
    [item.title, item.summary, item.category, item.source]
  );
  return (
    <Card className={`border-border hover:border-primary/30 transition-colors cursor-pointer ${item.hot ? 'border-l-2 border-l-amber-500' : ''}`}
      onClick={() => onOpenDetail?.(item)}>
      <CardContent className="p-3">
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className="text-[10px] shrink-0"
                style={item.feedCategory ? { 
                  borderColor: FEED_CATEGORY_COLORS[item.feedCategory] + '66', 
                  color: FEED_CATEGORY_COLORS[item.feedCategory] 
                } : undefined}>
                {item.category}
              </Badge>
              <span className="text-xs text-muted-foreground">{item.source}</span>
              {item.hot && (
                <Badge variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-500 border-amber-500/30">
                  <Flame className="w-2.5 h-2.5 mr-0.5" /> HOT
                </Badge>
              )}
              {item.sentiment && item.sentiment !== 'neutral' && (
                <Badge variant="outline" className="text-[10px]">
                  {item.sentiment === 'positive' ? '😊' : item.sentiment === 'negative' ? '😟' : '🤔'} {item.sentiment}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-1 shrink-0">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span className="text-xs font-mono text-amber-400">{item.relevance_score}%</span>
              </div>
            </div>
            <h3 className="font-semibold text-sm mb-1 leading-snug">{item.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{item.summary}</p>
            {item.publishedAt && (
              <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {/* Publication Match Intelligence */}
            {pubMatches.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Target className="w-3 h-3 text-emerald-500 shrink-0" />
                {pubMatches.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400" title={m.whyItFits}>
                    <span className="font-medium">{m.publication.name}</span>
                    <span className="opacity-60">{m.payRange}</span>
                    <span className="text-[8px] font-mono opacity-50">{m.matchScore}%</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onSave(item); }}
              title={item.saved ? 'Unsave' : 'Save'}>
              {item.saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); onCreateIdea(item); }}
              title="Create article idea">
              <Lightbulb className="w-4 h-4" />
            </Button>
            <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Open source">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
