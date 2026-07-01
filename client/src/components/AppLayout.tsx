import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { AppProvider } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  LayoutDashboard, Newspaper, Lightbulb, Search, PenTool,
  BookOpen, Send, DollarSign, Settings, ChevronLeft, ChevronRight,
  Zap, Menu, Building2, Inbox, Loader2,
  MessageSquare, Library, Globe, Map, Users,
  Flame, Calendar, Mic, Palette, ChevronDown,
  LayoutGrid, Rss, Clapperboard, FileText, ListChecks, Network, Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeSelector } from './ThemeSelector';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';

type NavItem = {
  path: string;
  label: string;
  icon: any;
  description: string;
  subItems?: Array<{ path: string; label: string; icon: any }>;
};

const NAV_SECTIONS: Array<{ title: string; items: NavItem[] }> = [
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
      { path: '/documentation', label: 'Documentation AI', icon: FileText, description: 'Generate docs & SOPs' },
      { path: '/knowledge-hub', label: 'Knowledge Hub', icon: BookOpen, description: 'Reading view over your knowledge' },
      { path: '/geo', label: 'GEO Suite', icon: Globe, description: 'AI visibility & humanizer' },
      { path: '/strategy', label: 'Strategy', icon: Map, description: 'Keywords & content strategy' },
      { path: '/pipeline', label: 'Pipeline', icon: Zap, description: 'One-click article production' },
      { path: '/brands', label: 'Brands', icon: Building2, description: 'Brand & product engine' },
      { path: '/planning-board', label: 'Planning Board', icon: Network, description: 'Org & data-flow map' },
      { path: '/financial', label: 'Financial', icon: DollarSign, description: 'Revenue tracking' },
      { path: '/accelerator', label: 'Accelerator', icon: Rocket, description: '$100K–$200K/mo goal engine' },
      { path: '/settings', label: 'Settings', icon: Settings, description: 'API keys & preferences' },
    ],
  },
];

const NAV_ITEMS = NAV_SECTIONS.flatMap(section => section.items);

export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("ew_nav_sections") ?? "{}"); } catch { return {}; }
  });
  // useTheme retained for components that may need it; ThemeSelector manages theme switching
  const { loading: authLoading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });

  // ⌘K / Ctrl+K opens the jump-to-page command palette (31 destinations, no scanning)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // useAuth will redirect if not authenticated, but guard rendering too
  if (!isAuthenticated) {
    return null;
  }

  const currentItem = NAV_ITEMS.find(item => {
    if (item.path === '/') return location === '/';
    if (location.startsWith(item.path)) return true;
    return item.subItems?.some(s => location.startsWith(s.path)) ?? false;
  });

  return (
    <AppProvider>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "flex flex-col border-r border-sidebar-border/80 bg-sidebar/90 backdrop-blur-xl transition-[width,transform] duration-300 ease-out z-50",
          collapsed ? "w-[4.5rem]" : "w-[17rem]",
          mobileOpen ? "fixed inset-y-0 left-0 w-[17rem] translate-x-0" : "hidden -translate-x-full lg:flex lg:translate-x-0"
        )}>
          {/* Logo */}
          <div className={cn("flex items-center h-14 border-b border-sidebar-border/80 shrink-0", collapsed ? "justify-center px-2" : "gap-3 px-4")}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-sm">
              <Zap className="w-4 h-4 text-primary-foreground" aria-hidden="true" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="text-sm font-semibold tracking-tight truncate">Elite Writer</h1>
                <p className="text-[10px] text-muted-foreground tracking-wide uppercase">Premium Studio</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3">
            {NAV_SECTIONS.map(section => {
              const sectionOpen = collapsed || openSections[section.title] !== false;
              return (
              <div key={section.title} className="space-y-1.5">
                {!collapsed && (
                  <button
                    onClick={() => {
                      const next = { ...openSections, [section.title]: openSections[section.title] === false };
                      setOpenSections(next);
                      try { localStorage.setItem("ew_nav_sections", JSON.stringify(next)); } catch { /* ignore */ }
                    }}
                    className="w-full flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
                  >
                    <span>{section.title}</span>
                    <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", !sectionOpen && "-rotate-90")} />
                  </button>
                )}
                {sectionOpen && section.items.map((item) => {
                  const subActive = item.subItems?.some(s => location.startsWith(s.path)) ?? false;
                  const isActive = item.path === '/' ? location === '/' : location.startsWith(item.path) || subActive;
                  return (
                    <div key={item.path}>
                      <Link
                        href={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "group flex items-center rounded-xl text-sm transition-all duration-200",
                          collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                          isActive
                            ? "bg-sidebar-primary/20 text-sidebar-primary-foreground border border-sidebar-primary/25 shadow-[inset_0_0_0_1px_hsl(var(--sidebar-primary)/0.1)]"
                            : "text-sidebar-foreground/85 hover:text-sidebar-foreground hover:bg-sidebar-accent/80"
                        )}
                      >
                        <item.icon className={cn("w-4 h-4 shrink-0", isActive && "text-primary")} />
                        {!collapsed && (
                          <div className="overflow-hidden">
                            <span className="block truncate">{item.label}</span>
                            {isActive && (
                              <span className="block text-[10px] text-muted-foreground truncate">{item.description}</span>
                            )}
                          </div>
                        )}
                      </Link>
                      {!collapsed && isActive && item.subItems && (
                        <div className="ml-7 mt-0.5 space-y-0.5">
                          {item.subItems.map(sub => {
                            const subIsActive = location.startsWith(sub.path);
                            return (
                              <Link key={sub.path} href={sub.path} onClick={() => setMobileOpen(false)}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors",
                                  subIsActive
                                    ? "text-primary font-medium"
                                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                                )}
                              >
                                <sub.icon className="w-3.5 h-3.5 shrink-0" />
                                <span>{sub.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              );
            })}
          </nav>

          {/* Collapse toggle */}
          <div className="border-t border-sidebar-border/80 p-2 shrink-0 hidden lg:block">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                "flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors",
                collapsed ? "px-0" : "gap-2"
              )}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              {!collapsed && <span className="text-xs">Collapse</span>}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center gap-4 h-14 px-4 border-b border-border/80 bg-background/95 backdrop-blur-sm shrink-0">
            <button
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Studio</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{currentItem?.label ?? 'Page'}</span>
            </div>

            <div className="flex-1" />

            {/* Jump-to-page search — opens command palette (⌘K) */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-border/80 bg-muted/40 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Search pages"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search…</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/80 bg-background/60 px-1 font-mono text-[10px]">⌘K</kbd>
            </button>

            {/* Theme selector */}
            <ThemeSelector />

            {/* Status indicators */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>System Online</span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Jump-to-page command palette — searches all 31 destinations by name + description */}
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} title="Jump to page" description="Search any page by name">
        <CommandInput placeholder="Jump to a page…" />
        <CommandList>
          <CommandEmpty>No page found.</CommandEmpty>
          {NAV_SECTIONS.map((section) => (
            <CommandGroup key={section.title} heading={section.title}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.path}
                  value={`${item.label} ${item.description}`}
                  onSelect={() => {
                    setLocation(item.path);
                    setPaletteOpen(false);
                    setMobileOpen(false);
                  }}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground truncate max-w-[45%]">{item.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </AppProvider>
  );
}
