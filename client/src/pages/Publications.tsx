import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BookOpen, Search, ExternalLink, Mail, DollarSign,
  Users, TrendingUp, Filter, ChevronDown, Download, Send
} from 'lucide-react';
import { useLocation } from 'wouter';
import { PUBLICATIONS, CATEGORIES, getPublicationTier, type Publication } from '@/lib/publications-data';

export default function Publications() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'pay' | 'acceptance'>('name');
  const [selectedPub, setSelectedPub] = useState<Publication | null>(null);
  const [, navigate] = useLocation();

  function exportCSV() {
    const headers = ['Name','Category','Tier','Pay Min','Pay Max','Pay Structure','Acceptance Rate','Avg Response Days','Topics','Article Styles','Editors','Emails','Submission URL','Traffic','Notes'];
    const rows = filtered.map(p => [
      p.name, p.category, getPublicationTier(p), p.pay_min ?? '', p.pay_max ?? '', p.pay_structure,
      p.acceptance_rate ?? '', p.avg_response_days ?? '', `"${p.topics}"`, `"${p.article_styles || ''}"`,
      `"${p.editors.map(e => e.name).join('; ')}"`, `"${p.editors.map(e => e.email || '').join('; ')}"`,
      p.submission_url, p.traffic_monthly, `"${(p.notes || '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `elite-writer-publications-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    return PUBLICATIONS.filter(pub => {
      const matchesSearch = !searchQuery ||
        pub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pub.topics.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pub.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || pub.category === filterCategory;
      const tier = getPublicationTier(pub);
      const matchesTier = filterTier === 'all' || tier === filterTier;
      return matchesSearch && matchesCategory && matchesTier;
    }).sort((a, b) => {
      if (sortBy === 'pay') return (b.pay_max ?? 0) - (a.pay_max ?? 0);
      if (sortBy === 'acceptance') return (b.acceptance_rate ?? 0) - (a.acceptance_rate ?? 0);
      return a.name.localeCompare(b.name);
    });
  }, [searchQuery, filterCategory, filterTier, sortBy]);

  const tierCounts = useMemo(() => {
    const counts = { 'Tier 1': 0, 'Tier 2': 0, 'Tier 3': 0 };
    PUBLICATIONS.forEach(p => { counts[getPublicationTier(p)]++; });
    return counts;
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" />
          Publication Database
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {PUBLICATIONS.length} publications with editor contacts, pay rates, and submission guidelines
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Tier 1 (Premium)', count: tierCounts['Tier 1'], color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Tier 2 (Mid-Range)', count: tierCounts['Tier 2'], color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Tier 3 (Entry)', count: tierCounts['Tier 3'], color: 'text-blue-400', bg: 'bg-blue-500/10' },
        ].map(tier => (
          <Card key={tier.label} className="border-border">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold font-mono ${tier.color}`}>{tier.count}</p>
              <p className="text-xs text-muted-foreground">{tier.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search publications, topics..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All Tiers</option>
          <option value="Tier 1">Tier 1</option>
          <option value="Tier 2">Tier 2</option>
          <option value="Tier 3">Tier 3</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="name">Sort: Name</option>
          <option value="pay">Sort: Highest Pay</option>
          <option value="acceptance">Sort: Acceptance Rate</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} results</span>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs ml-auto" onClick={exportCSV}>
          <Download className="w-3.5 h-3.5" /> Export CSV
        </Button>
      </div>

      {/* Publications Grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map(pub => {
          const tier = getPublicationTier(pub);
          const tierColor = tier === 'Tier 1' ? 'text-emerald-400 border-emerald-500/30' :
            tier === 'Tier 2' ? 'text-amber-400 border-amber-500/30' : 'text-blue-400 border-blue-500/30';
          return (
            <Card key={pub.id} className="border-border hover:border-primary/20 transition-colors cursor-pointer"
              onClick={() => setSelectedPub(pub)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-sm">{pub.name}</h3>
                  <Badge variant="outline" className={`text-[10px] ${tierColor}`}>{tier}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{pub.pay_structure}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px]">{pub.category}</Badge>
                  {pub.acceptance_rate && (
                    <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{pub.acceptance_rate}% accept</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedPub} onOpenChange={() => setSelectedPub(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPub?.name}
              <Badge variant="outline" className="text-xs">{selectedPub && getPublicationTier(selectedPub)}</Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedPub && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs block">Category</span>{selectedPub.category}</div>
                <div><span className="text-muted-foreground text-xs block">Monthly Traffic</span>{selectedPub.traffic_monthly}</div>
                <div><span className="text-muted-foreground text-xs block">Pay Range</span>{selectedPub.pay_structure}</div>
                <div><span className="text-muted-foreground text-xs block">Acceptance Rate</span>{selectedPub.acceptance_rate ?? 'N/A'}%</div>
                <div><span className="text-muted-foreground text-xs block">Avg Response</span>{selectedPub.avg_response_days ?? 'N/A'} days</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block mb-1">Topics</span>
                <p className="text-sm">{selectedPub.topics}</p>
              </div>
              {selectedPub.article_styles && (
                <div>
                  <span className="text-muted-foreground text-xs block mb-1">Article Styles</span>
                  <p className="text-sm">{selectedPub.article_styles}</p>
                </div>
              )}
              {selectedPub.notes && (
                <div>
                  <span className="text-muted-foreground text-xs block mb-1">Notes</span>
                  <p className="text-sm">{selectedPub.notes}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground text-xs block mb-2">Editors</span>
                {selectedPub.editors.map((ed, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm mb-1">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    <span className="font-medium">{ed.name}</span>
                    {ed.email && <a href={`mailto:${ed.email}`} className="text-primary hover:underline">{ed.email}</a>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <a href={selectedPub.submission_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full gap-2 text-xs">
                    <ExternalLink className="w-3.5 h-3.5" /> Submission Guidelines
                  </Button>
                </a>
                <Button className="flex-1 gap-2 text-xs" onClick={() => { setSelectedPub(null); navigate(`/pitches?pub=${selectedPub.id}`); }}>
                  <Send className="w-3.5 h-3.5" /> Create Pitch
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
