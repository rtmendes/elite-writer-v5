import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Newspaper, Bookmark, BookmarkCheck, TrendingUp, Search,
  ExternalLink, Lightbulb, Plus, Sparkles, RefreshCw, Zap, Brain
} from 'lucide-react';
import { aiGenerate, hasAnyProvider } from '@/lib/ai-engine';
import { SUMMARIZE_SYSTEM_PROMPT } from '@/lib/ai-prompts';

// Demo trending content (simulates Giststack-style feed)
const DEMO_FEED = [
  { title: 'AI Agents Are Replacing Entire Marketing Departments', summary: 'New research from McKinsey shows 40% of marketing tasks can be fully automated by AI agents, with companies reporting 3x ROI within 6 months of implementation.', source: 'McKinsey Digital', url: '#', category: 'AI & Technology', relevance_score: 95 },
  { title: 'The $50B Creator Economy Is Shifting to Long-Form', summary: 'Substack and Medium report record-breaking engagement for 2000+ word articles, reversing the short-form trend. Advertisers are following with premium CPMs.', source: 'Bloomberg', url: '#', category: 'Business', relevance_score: 88 },
  { title: 'Remote Work Productivity Data: 3 Years of Evidence', summary: 'Stanford researchers release comprehensive 3-year study showing remote workers are 13% more productive, with the gap widening for knowledge workers.', source: 'Stanford Research', url: '#', category: 'Future of Work', relevance_score: 92 },
  { title: 'Federal Reserve Signals Major Policy Shift on Digital Assets', summary: 'In a landmark speech, the Fed Chair outlined a new regulatory framework for digital assets that could unlock $2T in institutional investment.', source: 'Reuters', url: '#', category: 'Finance', relevance_score: 85 },
  { title: 'Climate Tech Funding Hits Record $60B in Q1 2026', summary: 'Venture capital flowing into climate technology reached unprecedented levels, with battery storage and carbon capture leading the charge.', source: 'PitchBook', url: '#', category: 'Climate & Energy', relevance_score: 82 },
  { title: 'The Longevity Economy: Why Health-Tech Is the Next Trillion-Dollar Market', summary: 'Aging populations in developed nations are driving explosive growth in health-tech, with AI diagnostics and personalized medicine leading innovation.', source: 'Fortune', url: '#', category: 'Health & Wellness', relevance_score: 87 },
  { title: 'How Small Businesses Are Using AI to Compete with Enterprise', summary: 'A new wave of affordable AI tools is leveling the playing field, allowing small businesses to deploy sophisticated marketing and operations at a fraction of the cost.', source: 'Inc.', url: '#', category: 'AI & Technology', relevance_score: 90 },
  { title: 'The Death of the 9-to-5: Async Work Goes Mainstream', summary: 'Major corporations including Microsoft, Shopify, and Atlassian are officially adopting async-first policies, fundamentally changing how teams collaborate.', source: 'Wired', url: '#', category: 'Future of Work', relevance_score: 86 },
];

export default function Giststack() {
  const { state, addGiststackItem, toggleGiststackSave, addIdea } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [customTopic, setCustomTopic] = useState('');
  const [topics, setTopics] = useState<string[]>(['AI & Technology', 'Business', 'Future of Work']);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const [dailyBrief, setDailyBrief] = useState<string | null>(null);

  // Merge demo feed with saved items
  const allItems = useMemo(() => {
    const saved = state.giststack;
    const demo = DEMO_FEED.map((item, i) => ({
      ...item,
      id: `demo-${i}`,
      saved: saved.some(s => s.title === item.title && s.saved),
      created_at: new Date().toISOString(),
    }));
    return [...saved.filter(s => !demo.some(d => d.title === s.title)), ...demo];
  }, [state.giststack]);

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
      return matchesSearch && matchesCategory;
    });
  }, [allItems, searchQuery, selectedCategory]);

  const savedItems = allItems.filter(i => i.saved);

  const handleSave = (item: typeof allItems[0]) => {
    if (item.id.startsWith('demo-')) {
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

  const handleCreateIdea = (item: typeof allItems[0]) => {
    addIdea({
      title: `[From Intelligence] ${item.title}`,
      angle: item.summary,
      category: item.category,
      news_peg: `Source: ${item.source}`,
      status: 'idea',
    });
    toast.success('Article idea created from intelligence item');
  };

  const addTopic = () => {
    if (customTopic.trim() && !topics.includes(customTopic.trim())) {
      setTopics([...topics, customTopic.trim()]);
      setCustomTopic('');
      toast.success('Topic added to tracking');
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-xl overflow-hidden h-36">
        <img src="https://d2xsxph8kpxj0f.cloudfront.net/97706254/hNgnrzmPgQMt5regq8X3Kp/hero-giststack-6BJYHCT7KetMgJMqF4T6PJ.webp" alt="Intelligence Feed" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-between p-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-cyan-400" />
              Intelligence Feed
            </h1>
            <p className="text-sm text-white/70 mt-1">
              Curate trending stories, extract article ideas, and track topics
            </p>
          </div>
          <div className="flex gap-2">
            {hasAnyProvider() && (
              <Button variant="outline" className="gap-2 border-white/20 text-white hover:bg-white/10" disabled={isGeneratingBrief}
                onClick={async () => {
                  setIsGeneratingBrief(true);
                  try {
                    const feedSummary = allItems.slice(0, 8).map(i => `- ${i.title}: ${i.summary} (${i.source})`).join('\n');
                    const result = await aiGenerate('summarize', SUMMARIZE_SYSTEM_PROMPT,
                      `Create a daily intelligence brief from these trending stories. Identify the 3 most promising article angles for a business/finance writer:\n\n${feedSummary}`,
                      { temperature: 0.6, maxTokens: 1000 }
                    );
                    setDailyBrief(result.text);
                    toast.success(`Daily brief generated via ${result.model} ($${result.cost.toFixed(4)})`);
                  } catch (err: any) {
                    toast.error(err.message || 'Brief generation failed');
                  } finally { setIsGeneratingBrief(false); }
                }}>
                <Brain className="w-4 h-4" /> {isGeneratingBrief ? 'Generating...' : 'AI Daily Brief'}
              </Button>
            )}
            <Button variant="outline" className="gap-2 border-white/20 text-white hover:bg-white/10" onClick={() => toast.info('Feed refreshed with latest content')}>
              <RefreshCw className="w-4 h-4" /> Refresh Feed
            </Button>
          </div>
        </div>
      </div>

      {/* Topic Tracker */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Tracked Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {topics.map(topic => (
              <Badge key={topic} variant="secondary" className="cursor-pointer hover:bg-primary/20"
                onClick={() => setSelectedCategory(topic)}>
                {topic}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add topic to track..."
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTopic()}
              className="max-w-xs"
            />
            <Button variant="outline" size="sm" onClick={addTopic}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Daily Brief */}
      {dailyBrief && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              AI Daily Intelligence Brief
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
            <TabsTrigger value="feed">Feed ({filtered.length})</TabsTrigger>
            <TabsTrigger value="saved">Saved ({savedItems.length})</TabsTrigger>
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

        <TabsContent value="feed" className="space-y-3">
          {filtered.map((item) => (
            <Card key={item.id} className="border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] shrink-0">{item.category}</Badge>
                      <span className="text-xs text-muted-foreground">{item.source}</span>
                      <div className="ml-auto flex items-center gap-1 shrink-0">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span className="text-xs font-mono text-amber-400">{item.relevance_score}%</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm mb-1 leading-snug">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.summary}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleSave(item)}
                      title={item.saved ? 'Unsave' : 'Save'}>
                      {item.saved ? <BookmarkCheck className="w-4 h-4 text-primary" /> : <Bookmark className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleCreateIdea(item)}
                      title="Create article idea">
                      <Lightbulb className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Open source">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

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
              <Card key={item.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="flex-1 min-w-0">
                      <Badge variant="outline" className="text-[10px] mb-1">{item.category}</Badge>
                      <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                      <p className="text-xs text-muted-foreground">{item.summary}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => handleCreateIdea(item)}>
                      <Lightbulb className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
