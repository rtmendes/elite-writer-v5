/**
 * Canonical left-nav definition + the merge logic for per-user customization.
 *
 * The code here is the source of truth for WHICH items exist and their icons/
 * labels. A saved layout (server, per user) only overlays ORDER, GROUPING, and
 * VISIBILITY by path. resolveLayout() merges the two so that:
 *   - the operator's custom order/sections/hidden are honored, and
 *   - any newly-shipped nav item (added in code, absent from the saved layout)
 *     is auto-appended to its default section — shipping a feature never hides it.
 */
import {
  LayoutDashboard, Newspaper, Rss, Zap, Lightbulb, Search, Library, LayoutGrid,
  PenTool, Inbox, Users, ListChecks, BookOpen, Send, MessageSquare, Flame,
  Clapperboard, Calendar, Mic, Palette, Image as ImageIcon, FileText, Globe,
  Map as MapIcon, Building2, Network, DollarSign, Rocket, Settings,
} from 'lucide-react';

export type NavItem = {
  path: string;
  label: string;
  icon: any;
  description: string;
  subItems?: Array<{ path: string; label: string; icon: any }>;
};

export type NavSection = { title: string; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Writing Studio',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & metrics' },
      { path: '/giststack', label: 'Intelligence', icon: Newspaper, description: 'Content curation & trends' },
      { path: '/sources', label: 'Feed Sources', icon: Rss, description: 'YouTube, Reddit & feeds to follow' },
      { path: '/pulse', label: 'Pulse Pipeline', icon: Zap, description: 'AI stories → matched articles' },
      { path: '/ideas', label: 'Ideas', icon: Lightbulb, description: 'Article idea pipeline' },
      { path: '/research', label: 'Research', icon: Search, description: 'Search · Library · Projects · Chat', subItems: [
        { path: '/research-library', label: 'Library', icon: Library },
        { path: '/research-projects', label: 'Projects', icon: LayoutGrid },
      ] },
      { path: '/writer', label: 'Writer', icon: PenTool, description: 'AI-enhanced editor' },
      { path: '/workspace', label: 'Workspace', icon: LayoutGrid, description: 'Pages, databases & boards' },
      { path: '/queue', label: 'Queue', icon: Inbox, description: 'Pre-written article pipeline' },
      { path: '/agents', label: 'Agents', icon: Users, description: 'AI editorial team — chat & assign' },
      { path: '/tasks', label: 'Task Center', icon: ListChecks, description: 'Run agent jobs & one-off tasks' },
    ],
  },
  {
    title: 'Publish & Distribute',
    items: [
      { path: '/publications', label: 'Publications', icon: BookOpen, description: '174+ publication database' },
      { path: '/pitches', label: 'Pitches', icon: Send, description: 'Pitch management' },
      { path: '/social', label: 'Social Engine', icon: MessageSquare, description: 'Multi-platform content' },
      { path: '/trending', label: 'Trending', icon: Flame, description: 'Trending topics discovery' },
      { path: '/content-studio', label: 'Content Studio', icon: PenTool, description: 'Multi-platform content creation' },
      { path: '/video-scripts', label: 'Video Scripts', icon: Clapperboard, description: 'VSL, TikTok, YouTube, UGC scripts' },
      { path: '/content-calendar', label: 'Calendar', icon: Calendar, description: 'Content scheduling calendar' },
      { path: '/content-insights', label: 'Insights', icon: Lightbulb, description: 'Smart content curation' },
      { path: '/interviews', label: 'AI Interviews', icon: Mic, description: 'Guided Q&A expertise extraction' },
    ],
  },
  {
    title: 'Growth & Operations',
    items: [
      { path: '/brand-voice', label: 'Brand Voice', icon: Palette, description: 'Voice profile training' },
      { path: '/library', label: 'Library', icon: Library, description: 'Content & asset library' },
      { path: '/media', label: 'Media', icon: ImageIcon, description: 'Unified image library + uploads' },
      { path: '/documentation', label: 'Documentation AI', icon: FileText, description: 'Generate docs & SOPs' },
      { path: '/knowledge-hub', label: 'Knowledge Hub', icon: BookOpen, description: 'Reading view over your knowledge' },
      { path: '/geo', label: 'GEO Suite', icon: Globe, description: 'AI visibility & humanizer' },
      { path: '/strategy', label: 'Strategy', icon: MapIcon, description: 'Keywords & content strategy' },
      { path: '/pipeline', label: 'Pipeline', icon: Zap, description: 'One-click article production' },
      { path: '/brands', label: 'Brands', icon: Building2, description: 'Brand & product engine' },
      { path: '/planning-board', label: 'Planning Board', icon: Network, description: 'Org & data-flow map' },
      { path: '/financial', label: 'Financial', icon: DollarSign, description: 'Revenue tracking' },
      { path: '/accelerator', label: 'Accelerator', icon: Rocket, description: '$100K–$200K/mo goal engine' },
      { path: '/settings', label: 'Settings', icon: Settings, description: 'API keys & preferences' },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap(section => section.items);

export type NavLayoutConfig = {
  sections: Array<{ title: string; items: string[] }>;
  hidden: string[];
};

/** Serialize the live resolved layout back to the storable path-only config. */
export function serializeLayout(sections: NavSection[], hidden: Set<string>): NavLayoutConfig {
  return {
    sections: sections.map(s => ({ title: s.title, items: s.items.map(i => i.path) })),
    hidden: [...hidden],
  };
}

/**
 * Merge a saved config over the canonical nav. Unknown paths are dropped, new
 * code items are appended to their default section, empty sections are removed.
 */
export function resolveLayout(saved: NavLayoutConfig | null | undefined): {
  sections: NavSection[];
  hidden: Set<string>;
} {
  const byPath = new Map(NAV_ITEMS.map(i => [i.path, i]));
  const hidden = new Set((saved?.hidden ?? []).filter(p => byPath.has(p)));

  if (!saved?.sections?.length) {
    return { sections: NAV_SECTIONS, hidden };
  }

  const used = new Set<string>();
  const sections: Array<{ title: string; paths: string[] }> = saved.sections.map(s => {
    const paths = s.items.filter(p => byPath.has(p) && !used.has(p));
    paths.forEach(p => used.add(p));
    return { title: s.title, paths };
  });

  // Append any code item not represented in the saved layout, to its default section.
  for (const def of NAV_SECTIONS) {
    let target: { title: string; paths: string[] } | undefined;
    for (const item of def.items) {
      if (used.has(item.path)) continue;
      if (!target) target = sections.find(s => s.title === def.title);
      if (!target) { target = { title: def.title, paths: [] }; sections.push(target); }
      target.paths.push(item.path);
      used.add(item.path);
    }
  }

  return {
    sections: sections
      .filter(s => s.paths.length > 0)
      .map(s => ({ title: s.title, items: s.paths.map(p => byPath.get(p)!) })),
    hidden,
  };
}
