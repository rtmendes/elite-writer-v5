import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AppProvider } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  LayoutDashboard, Newspaper, Lightbulb, Search, PenTool,
  BookOpen, Send, DollarSign, Settings, ChevronLeft, ChevronRight,
  Zap, Menu, Building2, Moon, Sun, Inbox, Loader2,
  MessageSquare, Library, Globe, Map, Users,
  Flame, Calendar, Mic, Palette, ChevronDown,
  LayoutGrid, Rss, Clapperboard, FileText, ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  path: string;
  label: string;
  icon: any;
  description: string;
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
      { path: '/research', label: 'Research', icon: Search, description: 'Data & source gathering' },
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
      { path: '/geo', label: 'GEO Suite', icon: Globe, description: 'AI visibility & humanizer' },
      { path: '/strategy', label: 'Strategy', icon: Map, description: 'Keywords & content strategy' },
      { path: '/pipeline', label: 'Pipeline', icon: Zap, description: 'One-click article production' },
      { path: '/brands', label: 'Brands', icon: Building2, description: 'Brand & product engine' },
      { path: '/financial', label: 'Financial', icon: DollarSign, description: 'Revenue tracking' },
      { path: '/settings', label: 'Settings', icon: Settings, description: 'API keys & preferences' },
    ],
  },
];

const NAV_ITEMS = NAV_SECTIONS.flatMap(section => section.items);

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("ew_nav_sections") ?? "{}"); } catch { return {}; }
  });
  const { theme, toggleTheme, switchable } = useTheme();
  const { loading: authLoading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });

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
    return location.startsWith(item.path);
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
                  const isActive = item.path === '/' ? location === '/' : location.startsWith(item.path);
                  return (
                    <Link
                      key={item.path}
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

            {/* Theme toggle */}
            {switchable && toggleTheme && (
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

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
    </AppProvider>
  );
}
