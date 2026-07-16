import { type ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { AppProvider } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  Search, Zap, Menu, Loader2, ChevronLeft, ChevronRight, ChevronDown,
  GripVertical, Eye, EyeOff, SlidersHorizontal, RotateCcw, Plus, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import {
  NAV_SECTIONS, NAV_ITEMS, resolveLayout, serializeLayout,
  type NavSection, type NavItem,
} from '@/lib/nav-config';
import { ThemeSelector } from './ThemeSelector';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';


export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("ew_nav_sections") ?? "{}"); } catch { return {}; }
  });

  // ── Customizable nav: per-user order / grouping / visibility (navLayout router).
  const [editMode, setEditMode] = useState(false);
  const [sections, setSections] = useState<NavSection[]>(NAV_SECTIONS);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const navLayoutQuery = trpc.navLayout.get.useQuery(undefined, { staleTime: 60_000 });
  const saveLayout = trpc.navLayout.save.useMutation();
  const resetLayout = trpc.navLayout.reset.useMutation();
  const utils = trpc.useUtils();

  // Hydrate once the saved layout loads (merges over the canonical nav).
  useEffect(() => {
    if (navLayoutQuery.data !== undefined) {
      const r = resolveLayout(navLayoutQuery.data);
      setSections(r.sections);
      setHidden(r.hidden);
    }
  }, [navLayoutQuery.data]);

  // Persist the current layout (debounced) after any edit.
  const persist = (nextSections: NavSection[], nextHidden: Set<string>) => {
    saveLayout.mutate(serializeLayout(nextSections, nextHidden));
  };

  // Drag state: what's being dragged (an item at [s,i] or a whole section).
  const dragItem = useRef<{ s: number; i: number } | null>(null);
  const dragSection = useRef<number | null>(null);

  const applyMove = (next: NavSection[]) => { setSections(next); persist(next, hidden); };

  const moveItem = (from: { s: number; i: number }, to: { s: number; i: number }) => {
    const next = sections.map(sec => ({ ...sec, items: [...sec.items] }));
    const [moved] = next[from.s].items.splice(from.i, 1);
    if (!moved) return;
    const insertAt = Math.min(to.i, next[to.s].items.length);
    next[to.s].items.splice(insertAt, 0, moved);
    applyMove(next.filter(s => s.items.length > 0));
  };

  const moveSection = (from: number, to: number) => {
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    applyMove(next);
  };

  const setItemHidden = (path: string, hide: boolean) => {
    const next = new Set(hidden);
    hide ? next.add(path) : next.delete(path);
    setHidden(next);
    persist(sections, next);
  };

  const resetNav = () => {
    resetLayout.mutate(undefined, { onSuccess: () => utils.navLayout.get.invalidate() });
    const r = resolveLayout(null);
    setSections(r.sections);
    setHidden(new Set());
  };

  const hiddenItems = NAV_ITEMS.filter(i => hidden.has(i.path));

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

          {/* Customize toggle (hidden when the rail is collapsed) */}
          {!collapsed && (
            <div className="flex items-center justify-between px-3 pt-2">
              <button
                onClick={() => setEditMode(v => !v)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  editMode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
              >
                {editMode ? <Check className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
                {editMode ? 'Done' : 'Customize'}
              </button>
              {editMode && (
                <button onClick={resetNav} title="Reset to default"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-destructive">
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3">
            {sections.map((section, sIdx) => {
              const sectionOpen = collapsed || editMode || openSections[section.title] !== false;
              const visibleItems = section.items.filter(i => editMode || !hidden.has(i.path));
              if (visibleItems.length === 0 && !editMode) return null;
              return (
              <div
                key={section.title}
                className={cn("space-y-1.5", editMode && "rounded-lg border border-dashed border-sidebar-border/60 p-1")}
                onDragOver={editMode ? (e) => e.preventDefault() : undefined}
                onDrop={editMode ? (e) => {
                  e.preventDefault();
                  if (dragSection.current !== null && dragSection.current !== sIdx) { moveSection(dragSection.current, sIdx); dragSection.current = null; }
                  else if (dragItem.current && dragItem.current.s !== sIdx) { moveItem(dragItem.current, { s: sIdx, i: section.items.length }); dragItem.current = null; }
                } : undefined}
              >
                {!collapsed && (
                  <button
                    draggable={editMode}
                    onDragStart={editMode ? () => { dragSection.current = sIdx; } : undefined}
                    onClick={() => {
                      if (editMode) return;
                      const next = { ...openSections, [section.title]: openSections[section.title] === false };
                      setOpenSections(next);
                      try { localStorage.setItem("ew_nav_sections", JSON.stringify(next)); } catch { /* ignore */ }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors",
                      editMode && "cursor-grab active:cursor-grabbing"
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {editMode && <GripVertical className="w-3 h-3 opacity-60" />}
                      {section.title}
                    </span>
                    {!editMode && <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", !sectionOpen && "-rotate-90")} />}
                  </button>
                )}
                {sectionOpen && visibleItems.map((item) => {
                  const iIdx = section.items.indexOf(item);
                  const isHidden = hidden.has(item.path);
                  const subActive = item.subItems?.some(s => location.startsWith(s.path)) ?? false;
                  const isActive = item.path === '/' ? location === '/' : location.startsWith(item.path) || subActive;
                  return (
                    <div
                      key={item.path}
                      draggable={editMode}
                      onDragStart={editMode ? (e) => { dragItem.current = { s: sIdx, i: iIdx }; e.stopPropagation(); } : undefined}
                      onDragOver={editMode ? (e) => { e.preventDefault(); e.stopPropagation(); } : undefined}
                      onDrop={editMode ? (e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (dragItem.current) { moveItem(dragItem.current, { s: sIdx, i: iIdx }); dragItem.current = null; }
                      } : undefined}
                    >
                      {editMode ? (
                        <div className={cn(
                          "group flex items-center gap-2 rounded-xl px-2 py-2 text-sm cursor-grab active:cursor-grabbing",
                          isHidden ? "opacity-40" : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60"
                        )}>
                          <GripVertical className="w-3.5 h-3.5 shrink-0 opacity-60" />
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          <button
                            title={isHidden ? 'Show' : 'Hide'}
                            onClick={(e) => { e.stopPropagation(); setItemHidden(item.path, !isHidden); }}
                            className="text-muted-foreground hover:text-sidebar-foreground"
                          >
                            {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
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
                      )}
                      {!collapsed && !editMode && isActive && item.subItems && (
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
