import { type ReactNode, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { AppProvider } from '@/contexts/AppContext';
import {
  LayoutDashboard, Newspaper, Lightbulb, Search, PenTool,
  BookOpen, Send, DollarSign, Settings, ChevronLeft, ChevronRight,
  Zap, Menu, Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & metrics' },
  { path: '/giststack', label: 'Intelligence', icon: Newspaper, description: 'Content curation & trends' },
  { path: '/ideas', label: 'Ideas', icon: Lightbulb, description: 'Article idea pipeline' },
  { path: '/research', label: 'Research', icon: Search, description: 'Data & source gathering' },
  { path: '/writer', label: 'Writer', icon: PenTool, description: 'AI-enhanced editor' },
  { path: '/publications', label: 'Publications', icon: BookOpen, description: '174+ publication database' },
  { path: '/pitches', label: 'Pitches', icon: Send, description: 'Pitch management' },
  { path: '/brands', label: 'Brands', icon: Building2, description: 'Brand & product engine' },
  { path: '/financial', label: 'Financial', icon: DollarSign, description: 'Revenue tracking' },
  { path: '/settings', label: 'Settings', icon: Settings, description: 'API keys & preferences' },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentItem = NAV_ITEMS.find(item => {
    if (item.path === '/') return location === '/';
    return location.startsWith(item.path);
  });

  return (
    <AppProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "flex flex-col border-r border-border bg-sidebar transition-all duration-200 z-50",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "fixed inset-y-0 left-0 w-60" : "hidden lg:flex"
        )}>
          {/* Logo */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <h1 className="text-sm font-bold text-foreground tracking-tight truncate">Elite Writer</h1>
                <p className="text-[10px] text-muted-foreground">Command Center V5</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {NAV_ITEMS.map((item) => {
              const isActive = item.path === '/' ? location === '/' : location.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 mb-0.5 group",
                    isActive
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
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
          </nav>

          {/* Collapse toggle */}
          <div className="border-t border-border p-2 shrink-0 hidden lg:block">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center w-full py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center gap-4 h-14 px-4 border-b border-border bg-background shrink-0">
            <button
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Elite Writer</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium text-foreground">{currentItem?.label ?? 'Page'}</span>
            </div>

            <div className="flex-1" />

            {/* Status indicators */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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
