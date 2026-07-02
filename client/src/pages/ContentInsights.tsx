/**
 * Content Insights — Sentiment analysis, relevance scoring, and smart curation
 * 
 * Features: Sourced from intelligenceItems + sourceItems, sentiment filtering,
 * relevance score sorting, key insights extraction, viral scoring, save/bookmark
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useSelection } from "@/hooks/useSelection";
import { SelectionBar } from "@/components/SelectionBar";
import {
  Lightbulb, Search, Loader2, LayoutGrid, List, ExternalLink,
  BookmarkPlus, Bookmark, TrendingUp, BarChart3, Smile, Frown,
  Meh, Zap, Filter, Star, SortAsc, SortDesc, Sparkles,
} from "lucide-react";

const SENTIMENT_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  positive: { icon: Smile, color: "text-green-500", bg: "bg-green-500/10" },
  neutral: { icon: Meh, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  negative: { icon: Frown, color: "text-red-500", bg: "bg-red-500/10" },
};

export default function ContentInsights() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSentiment, setFilterSentiment] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"relevance" | "date" | "viral">("relevance");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [savedOnly, setSavedOnly] = useState(false);

  // tRPC queries — use data.intelligence (intelligenceItems table)
  const insightsQuery = trpc.data.intelligence.list.useQuery();
  const saveMutation = trpc.data.intelligence.save.useMutation({
    onSuccess: () => { toast.success("Saved!"); insightsQuery.refetch(); },
  });
  const bulkSaveMutation = trpc.data.intelligence.save.useMutation();
  const deleteMutation = trpc.data.intelligence.delete.useMutation();
  const [bulkBusy, setBulkBusy] = useState(false);

  const insights = useMemo(() => {
    let items = (insightsQuery.data || []) as any[];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.title?.toLowerCase().includes(q) ||
        i.summary?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      );
    }

    // Sentiment filter
    if (filterSentiment !== "all") {
      items = items.filter(i => {
        const sentiment = i.metadata?.sentiment || i.sentiment || "neutral";
        return sentiment === filterSentiment;
      });
    }

    // Category filter
    if (filterCategory !== "all") {
      items = items.filter(i => i.category === filterCategory);
    }

    // Saved only
    if (savedOnly) {
      items = items.filter(i => i.saved);
    }

    // Sort
    items = [...items].sort((a, b) => {
      let aVal = 0, bVal = 0;
      if (sortBy === "relevance") {
        aVal = a.relevanceScore || 0;
        bVal = b.relevanceScore || 0;
      } else if (sortBy === "viral") {
        aVal = a.metadata?.viral_score || 0;
        bVal = b.metadata?.viral_score || 0;
      } else {
        aVal = new Date(a.createdAt || 0).getTime();
        bVal = new Date(b.createdAt || 0).getTime();
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return items;
  }, [insightsQuery.data, searchQuery, filterSentiment, filterCategory, sortBy, sortDir, savedOnly]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    (insightsQuery.data || []).forEach((i: any) => { if (i.category) cats.add(i.category); });
    return Array.from(cats).sort();
  }, [insightsQuery.data]);

  const stats = useMemo(() => {
    const all = (insightsQuery.data || []) as any[];
    return {
      total: all.length,
      avgRelevance: all.length ? Math.round(all.reduce((s, i: any) => s + (i.relevanceScore || 0), 0) / all.length) : 0,
      positive: all.filter((i: any) => (i.metadata?.sentiment || "neutral") === "positive").length,
      saved: all.filter((i: any) => i.saved).length,
    };
  }, [insightsQuery.data]);

  // Multi-select + bulk actions (shared hook — select-all scoped to visible rows)
  const visibleIds = useMemo(() => insights.map((i: any) => i.id as number), [insights]);
  const { selected, selectedList, toggle, allSelected, toggleAll, clear } = useSelection<number>(visibleIds);

  const bulkDelete = async () => {
    if (selectedList.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    for (const id of selectedList) {
      try { await deleteMutation.mutateAsync({ id }); ok++; } catch { /* keep going */ }
    }
    await insightsQuery.refetch();
    clear();
    setBulkBusy(false);
    toast.success(`${ok} insight(s) deleted`);
  };

  const bulkSetSaved = async (saved: boolean) => {
    if (selectedList.length === 0) return;
    setBulkBusy(true);
    let ok = 0;
    for (const id of selectedList) {
      try { await bulkSaveMutation.mutateAsync({ id, saved }); ok++; } catch { /* keep going */ }
    }
    await insightsQuery.refetch();
    clear();
    setBulkBusy(false);
    toast.success(`${ok} insight(s) ${saved ? "saved" : "unsaved"}`);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-500" />
            Content Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Smart curation with sentiment analysis, relevance scoring, and key insights
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search insights..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={filterSentiment} onValueChange={setFilterSentiment}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sentiments</SelectItem>
            <SelectItem value="positive">😊 Positive</SelectItem>
            <SelectItem value="neutral">😐 Neutral</SelectItem>
            <SelectItem value="negative">😟 Negative</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">By Relevance</SelectItem>
            <SelectItem value="viral">By Viral Score</SelectItem>
            <SelectItem value="date">By Date</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}>
          {sortDir === "desc" ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
        </Button>
        <Button variant={savedOnly ? "secondary" : "outline"} size="icon" onClick={() => setSavedOnly(!savedOnly)}>
          {savedOnly ? <Bookmark className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
        </Button>
        <div className="flex gap-1 border rounded-md p-1">
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")}><LayoutGrid className="w-4 h-4" /></Button>
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")}><List className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Insights</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className={`text-2xl font-bold ${getScoreColor(stats.avgRelevance)}`}>{stats.avgRelevance}</p>
          <p className="text-xs text-muted-foreground">Avg Relevance</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{stats.positive}</p>
          <p className="text-xs text-muted-foreground">Positive Sentiment</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.saved}</p>
          <p className="text-xs text-muted-foreground">Saved</p>
        </CardContent></Card>
      </div>

      {/* Select-all + bulk action bar */}
      {!insightsQuery.isLoading && insights.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
          <span className="text-xs text-muted-foreground">Select all ({insights.length})</span>
        </div>
      )}
      <SelectionBar
        count={selectedList.length}
        onDelete={bulkDelete}
        deleteNoun="insight"
        onClear={clear}
        busy={bulkBusy}
      >
        <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={bulkBusy} onClick={() => bulkSetSaved(true)}>
          <Bookmark className="w-3.5 h-3.5" /> Save
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={bulkBusy} onClick={() => bulkSetSaved(false)}>
          <BookmarkPlus className="w-3.5 h-3.5" /> Unsave
        </Button>
      </SelectionBar>

      {/* Content */}
      {insightsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : insights.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Lightbulb className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">
            {savedOnly ? "No saved insights" : "No insights yet — add content sources to start curating"}
          </p>
        </CardContent></Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((item: any) => {
            const sentiment = item.metadata?.sentiment || "neutral";
            const sentConf = SENTIMENT_ICONS[sentiment] || SENTIMENT_ICONS.neutral;
            const SentIcon = sentConf.icon;
            const viralScore = item.metadata?.viral_score || 0;
            return (
              <Card key={item.id} className={`group hover:border-primary/30 transition-colors ${selected.has(item.id) ? "border-primary/40 bg-primary/[0.03]" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} aria-label={`Select ${item.title}`} />
                      <Badge variant="secondary" className="text-xs">{item.category || "Uncategorized"}</Badge>
                      <div className={`flex items-center gap-1 text-xs ${sentConf.color}`}>
                        <SentIcon className="w-3 h-3" />{sentiment}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${getScoreColor(item.relevanceScore || 0)}`}>
                        {item.relevanceScore || 0}
                      </span>
                    </div>
                  </div>
                  <CardTitle className="text-base mt-2 line-clamp-2">{item.title}</CardTitle>
                  {item.source && (
                    <CardDescription className="text-xs">{item.source}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.summary && <p className="text-sm text-muted-foreground line-clamp-3">{item.summary}</p>}

                  {item.metadata?.niche_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(item.metadata.niche_tags as string[]).slice(0, 4).map((tag: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />Viral: {viralScore}
                    </div>
                    <div className="flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />Relevance: {item.relevanceScore || 0}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant={item.saved ? "secondary" : "outline"}
                      className="flex-1"
                      onClick={() => saveMutation.mutate({ id: item.id, saved: !item.saved })}
                    >
                      {item.saved ? <Bookmark className="w-3 h-3 mr-1" /> : <BookmarkPlus className="w-3 h-3 mr-1" />}
                      {item.saved ? "Saved" : "Save"}
                    </Button>
                    {item.url && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={item.url} target="_blank" rel="noopener"><ExternalLink className="w-3 h-3" /></a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((item: any) => {
            const sentiment = item.metadata?.sentiment || "neutral";
            const sentConf = SENTIMENT_ICONS[sentiment] || SENTIMENT_ICONS.neutral;
            const SentIcon = sentConf.icon;
            return (
              <Card key={item.id} className={`hover:border-primary/30 transition-colors ${selected.has(item.id) ? "border-primary/40 bg-primary/[0.03]" : ""}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} aria-label={`Select ${item.title}`} />
                  <div className={`text-lg font-bold min-w-[2.5rem] text-center ${getScoreColor(item.relevanceScore || 0)}`}>
                    {item.relevanceScore || 0}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{item.category || "—"}</Badge>
                      <span className={`flex items-center gap-1 text-xs ${sentConf.color}`}>
                        <SentIcon className="w-3 h-3" />{sentiment}
                      </span>
                      {item.source && <span className="text-xs text-muted-foreground">{item.source}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={item.saved ? "secondary" : "outline"}
                    onClick={() => saveMutation.mutate({ id: item.id, saved: !item.saved })}
                  >
                    {item.saved ? <Bookmark className="w-3 h-3" /> : <BookmarkPlus className="w-3 h-3" />}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
