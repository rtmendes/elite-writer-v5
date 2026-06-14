import { useState, useRef, useEffect, useMemo } from 'react';
import { AGENTS, AGENT_LIST, getAgent, type Agent } from '@/lib/agents';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  MessageSquare, Users, Send, Search, Clock, Zap, X, Check,
  Loader2, Sparkles, FileText, MoreHorizontal, Trash2, MessagesSquare,
  Brain, Database, BookOpen, Lightbulb, Palette, LayoutGrid, List,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, CheckSquare, Square,
  SlidersHorizontal, XCircle, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────

type ChatMode = 'one_on_one' | 'group' | 'meeting';
type ViewMode = 'gallery' | 'list';
type SortField = 'name' | 'role' | 'articles' | 'specialty';
type SortDirection = 'asc' | 'desc';

interface ChatMessage {
  id?: number;
  role: 'user' | 'agent';
  agentId?: string | null;
  content: string;
  createdAt?: string;
}

interface ChatSession {
  id: number;
  title: string | null;
  agentIds: string[];
  mode: string | null;
  messageCount: number | null;
  lastMessageAt: string | null;
}

// Extract unique roles from agent list
const ALL_ROLES = Array.from(new Set(AGENT_LIST.map(a => a.role))).sort();
const ALL_EXPERTISE = Array.from(
  new Set(AGENT_LIST.flatMap(a => a.expertise))
).sort();

// ─── Main Component ──────────────────────────────────────

export default function Agents() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatAgents, setChatAgents] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [groupSelectOpen, setGroupSelectOpen] = useState(false);
  const [groupSelected, setGroupSelected] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // New state for view controls
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterExpertise, setFilterExpertise] = useState<string>('all');
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [multiSelected, setMultiSelected] = useState<Set<string>>(new Set());

  // tRPC
  const chatsQuery = trpc.agents.listChats.useQuery();
  const createChatMutation = trpc.agents.createChat.useMutation();
  const sendMessageMutation = trpc.agents.sendMessage.useMutation();
  const messagesQuery = trpc.agents.getChatMessages.useQuery(
    { chatId: activeChatId! },
    { enabled: !!activeChatId }
  );
  const assignmentsQuery = trpc.agents.getAssignments.useQuery(
    { agentId: selectedAgent?.id },
    { enabled: !!selectedAgent }
  );
  const assignMutation = trpc.agents.assign.useMutation();
  const deleteChatMutation = trpc.agents.deleteChat.useMutation();
  const contextStatusQuery = trpc.agents.getContextStatus.useQuery();
  // Real article counts: how many articles each agent is actively assigned to
  const articleCountsQuery = trpc.agents.articleCounts.useQuery();
  const articleCounts = articleCountsQuery.data ?? {};

  // Filter + sort agents
  const filteredAgents = useMemo(() => {
    let list = [...AGENT_LIST];

    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.expertise.some(e => e.toLowerCase().includes(q))
      );
    }

    // Role filter
    if (filterRole !== 'all') {
      list = list.filter(a => a.role === filterRole);
    }

    // Expertise filter
    if (filterExpertise !== 'all') {
      list = list.filter(a => a.expertise.some(e => e === filterExpertise));
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'role':
          cmp = a.role.localeCompare(b.role);
          break;
        case 'articles':
          cmp = (articleCounts[a.id] ?? 0) - (articleCounts[b.id] ?? 0);
          break;
        case 'specialty':
          cmp = a.stats.specialty.localeCompare(b.stats.specialty);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [searchQuery, filterRole, filterExpertise, sortField, sortDirection, articleCounts]);

  const hasActiveFilters = filterRole !== 'all' || filterExpertise !== 'all' || searchQuery.length > 0;

  // Load messages when chat changes
  useEffect(() => {
    if (messagesQuery.data) {
      setChatMessages(messagesQuery.data.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'agent',
        agentId: m.agentId,
        content: m.content,
        createdAt: m.createdAt?.toString(),
      })));
    }
  }, [messagesQuery.data]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ─── Multi-select helpers ────────────────────────────

  const toggleMultiSelect = (agentId: string) => {
    const next = new Set(multiSelected);
    if (next.has(agentId)) next.delete(agentId); else next.add(agentId);
    setMultiSelected(next);
  };

  const selectAll = () => {
    setMultiSelected(new Set(filteredAgents.map(a => a.id)));
  };

  const clearSelection = () => {
    setMultiSelected(new Set());
  };

  const exitMultiSelect = () => {
    setMultiSelectMode(false);
    setMultiSelected(new Set());
  };

  // ─── Handlers ────────────────────────────────────────

  const handleAgentClick = (agent: Agent) => {
    if (multiSelectMode) {
      toggleMultiSelect(agent.id);
      return;
    }
    setSelectedAgent(agent);
    setProfileOpen(true);
  };

  const handleStartChat = async (agentIds: string[], mode: ChatMode = 'one_on_one') => {
    try {
      const result = await createChatMutation.mutateAsync({
        agentIds,
        mode,
      });
      setActiveChatId(result.id);
      setChatAgents(agentIds);
      setChatMessages([]);
      setChatOpen(true);
      setProfileOpen(false);
      chatsQuery.refetch();
    } catch (err) {
      toast.error('Failed to create chat');
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeChatId || sending) return;
    const content = chatInput.trim();
    setChatInput('');
    setSending(true);

    // Optimistic user message
    setChatMessages(prev => [...prev, { role: 'user', content }]);

    try {
      const responses = await sendMessageMutation.mutateAsync({
        chatId: activeChatId,
        content,
        agentIds: chatAgents,
      });

      // Add agent responses
      setChatMessages(prev => [
        ...prev,
        ...responses.map(r => ({
          role: 'agent' as const,
          agentId: r.agentId,
          content: r.content,
        })),
      ]);
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleOpenExistingChat = (chat: ChatSession) => {
    setActiveChatId(chat.id);
    setChatAgents(chat.agentIds || []);
    setChatOpen(true);
  };

  const handleStartGroupChat = () => {
    if (groupSelected.size < 2) {
      toast.error('Select at least 2 agents for a group chat');
      return;
    }
    handleStartChat(Array.from(groupSelected), 'group');
    setGroupSelectOpen(false);
    setGroupSelected(new Set());
  };

  const handleStartMultiSelectChat = () => {
    if (multiSelected.size === 0) return;
    const ids = Array.from(multiSelected);
    if (ids.length === 1) {
      handleStartChat(ids, 'one_on_one');
    } else {
      handleStartChat(ids, 'group');
    }
    exitMultiSelect();
  };

  const handleDeleteChat = async (chatId: number) => {
    try {
      await deleteChatMutation.mutateAsync({ chatId });
      chatsQuery.refetch();
      if (activeChatId === chatId) {
        setChatOpen(false);
        setActiveChatId(null);
      }
      toast.success('Chat archived');
    } catch {
      toast.error('Failed to delete chat');
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterRole('all');
    setFilterExpertise('all');
    setSortField('name');
    setSortDirection('asc');
  };

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Editorial Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredAgents.length} of {AGENT_LIST.length} agents
            {multiSelectMode && multiSelected.size > 0 && (
              <span className="text-primary font-medium"> · {multiSelected.size} selected</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {multiSelectMode ? (
            <>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={selectAll}>
                <CheckSquare className="w-3.5 h-3.5" />
                All
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={clearSelection}>
                <Square className="w-3.5 h-3.5" />
                None
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                disabled={multiSelected.size === 0}
                onClick={handleStartMultiSelectChat}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Chat ({multiSelected.size})
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exitMultiSelect}>
                <X className="w-3.5 h-3.5" />
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setMultiSelectMode(true)}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Select
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setGroupSelectOpen(true)}
              >
                <Users className="w-3.5 h-3.5" />
                Group Meeting
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Context Status Bar */}
      {contextStatusQuery.data && (
        <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg border border-border bg-card/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Brain className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium text-foreground">Agent Intelligence:</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-muted-foreground" title="Knowledge Base items available to all agents">
              <Database className="w-3 h-3" />
              {contextStatusQuery.data.kbItems} KB items
            </span>
            <span className="flex items-center gap-1 text-muted-foreground" title="Persistent memories across sessions">
              <Sparkles className="w-3 h-3" />
              {contextStatusQuery.data.memories} memories
            </span>
            <span className="flex items-center gap-1 text-muted-foreground" title="Articles agents can reference">
              <FileText className="w-3 h-3" />
              {contextStatusQuery.data.articles} articles
            </span>
            <span className="flex items-center gap-1 text-muted-foreground" title="Ideas agents can see">
              <Lightbulb className="w-3 h-3" />
              {contextStatusQuery.data.ideas} ideas
            </span>
            <span className="flex items-center gap-1 text-muted-foreground" title="Brands agents know about">
              <Palette className="w-3 h-3" />
              {contextStatusQuery.data.brands} brands
            </span>
          </div>
        </div>
      )}

      {/* ─── Toolbar: Search + Filter + Sort + View ─── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Search + Filters */}
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* Search */}
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <Filter className="w-3 h-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ALL_ROLES.map(role => (
                <SelectItem key={role} value={role}>{role}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Expertise Filter */}
          <Select value={filterExpertise} onValueChange={setFilterExpertise}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <Sparkles className="w-3 h-3 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Expertise" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Expertise</SelectItem>
              {ALL_EXPERTISE.map(exp => (
                <SelectItem key={exp} value={exp}>{exp}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={clearAllFilters}>
              <XCircle className="w-3 h-3" />
              Clear
            </Button>
          )}
        </div>

        {/* Right: Sort + View toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <ArrowUpDown className="w-3 h-3" />
                Sort
                {sortField !== 'name' && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{sortField}</Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel className="text-[10px] text-muted-foreground">Sort by</DropdownMenuLabel>
              {[
                { field: 'name' as SortField, label: 'Name' },
                { field: 'role' as SortField, label: 'Role' },
                { field: 'articles' as SortField, label: 'Articles Assigned' },
                { field: 'specialty' as SortField, label: 'Specialty' },
              ].map(({ field, label }) => (
                <DropdownMenuItem
                  key={field}
                  className="text-xs flex items-center justify-between"
                  onClick={() => {
                    if (sortField === field) {
                      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortField(field);
                      setSortDirection('asc');
                    }
                  }}
                >
                  <span>{label}</span>
                  {sortField === field && (
                    sortDirection === 'asc'
                      ? <ArrowUp className="w-3 h-3 text-primary" />
                      : <ArrowDown className="w-3 h-3 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              className={cn(
                "p-1.5 transition-colors",
                viewMode === 'gallery'
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              onClick={() => setViewMode('gallery')}
              title="Gallery view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              className={cn(
                "p-1.5 transition-colors",
                viewMode === 'list'
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Agent Display ─── */}
      {filteredAgents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No agents match your filters</p>
          <p className="text-xs mt-1">Try adjusting your search or filter criteria</p>
          <Button variant="link" size="sm" className="mt-2 text-xs" onClick={clearAllFilters}>
            Clear all filters
          </Button>
        </div>
      ) : viewMode === 'gallery' ? (
        /* Gallery Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredAgents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              articleCount={articleCounts[agent.id] ?? 0}
              onClick={() => handleAgentClick(agent)}
              onChat={() => handleStartChat([agent.id])}
              multiSelectMode={multiSelectMode}
              isSelected={multiSelected.has(agent.id)}
              onToggleSelect={() => toggleMultiSelect(agent.id)}
            />
          ))}
        </div>
      ) : (
        /* List View */
        <div className="rounded-lg border border-border overflow-hidden">
          {/* List header */}
          <div className="grid grid-cols-[auto_1fr_150px_100px_80px_70px] gap-3 px-4 py-2.5 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider items-center">
            {multiSelectMode && <div className="w-5" />}
            <div className={multiSelectMode ? "" : "col-start-2"}>Agent</div>
            <div>Role</div>
            <div>Specialty</div>
            <div className="text-center">Articles</div>
            <div className="text-right">Actions</div>
          </div>
          {filteredAgents.map((agent, i) => (
            <AgentListRow
              key={agent.id}
              agent={agent}
              articleCount={articleCounts[agent.id] ?? 0}
              isEven={i % 2 === 0}
              onClick={() => handleAgentClick(agent)}
              onChat={() => handleStartChat([agent.id])}
              multiSelectMode={multiSelectMode}
              isSelected={multiSelected.has(agent.id)}
              onToggleSelect={() => toggleMultiSelect(agent.id)}
            />
          ))}
        </div>
      )}

      {/* Recent Chats */}
      {chatsQuery.data && chatsQuery.data.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Conversations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {chatsQuery.data.slice(0, 6).map(chat => (
              <Card
                key={chat.id}
                className="border-border hover:border-primary/30 cursor-pointer transition-all group"
                onClick={() => handleOpenExistingChat(chat as unknown as Parameters<typeof handleOpenExistingChat>[0])}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex -space-x-2">
                        {(chat.agentIds || []).slice(0, 3).map(id => {
                          const a = getAgent(id);
                          return (
                            <div key={id} className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-background">
                              <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                            </div>
                          );
                        })}
                        {(chat.agentIds || []).length > 3 && (
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium ring-2 ring-background">
                            +{(chat.agentIds || []).length - 3}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{chat.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {chat.messageCount || 0} messages
                          {chat.mode === 'group' && ' • Group'}
                          {chat.mode === 'meeting' && ' • Meeting'}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-red-400" onClick={e => { e.stopPropagation(); handleDeleteChat(chat.id); }}>
                          <Trash2 className="w-3 h-3 mr-2" /> Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Agent Profile Sheet */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedAgent && (
            <AgentProfile
              agent={selectedAgent}
              articleCount={articleCounts[selectedAgent.id] ?? 0}
              assignments={assignmentsQuery.data || []}
              onChat={() => handleStartChat([selectedAgent.id])}
              onAssign={assignMutation.mutateAsync}
              onClose={() => setProfileOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Chat Dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
          <ChatInterface
            agentIds={chatAgents}
            messages={chatMessages}
            input={chatInput}
            sending={sending}
            onInputChange={setChatInput}
            onSend={handleSendMessage}
            onClose={() => setChatOpen(false)}
            messagesEndRef={messagesEndRef}
          />
        </DialogContent>
      </Dialog>

      {/* Group Select Dialog */}
      <Dialog open={groupSelectOpen} onOpenChange={setGroupSelectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start Group Meeting</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Select 2 or more agents to start a collaborative session.</p>
          <div className="grid grid-cols-3 gap-2 mt-2 max-h-[50vh] overflow-y-auto">
            {AGENT_LIST.map(agent => {
              const selected = groupSelected.has(agent.id);
              return (
                <button
                  key={agent.id}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                    selected
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:border-primary/30"
                  )}
                  onClick={() => {
                    const next = new Set(groupSelected);
                    if (selected) next.delete(agent.id); else next.add(agent.id);
                    setGroupSelected(next);
                  }}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full overflow-hidden">
                      <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                    </div>
                    {selected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-center leading-tight">{agent.name.split(' ')[0]}</span>
                  <span className="text-[8px] text-muted-foreground text-center leading-tight">{agent.role}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-muted-foreground">{groupSelected.size} selected</span>
            <Button
              onClick={handleStartGroupChat}
              disabled={groupSelected.size < 2}
              className="gap-1.5"
              size="sm"
            >
              <MessagesSquare className="w-3.5 h-3.5" />
              Start Meeting ({groupSelected.size})
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Agent Card (Gallery) ────────────────────────────────

function AgentCard({ agent, articleCount, onClick, onChat, multiSelectMode, isSelected, onToggleSelect }: {
  agent: Agent;
  articleCount: number;
  onClick: () => void;
  onChat: () => void;
  multiSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <Card
      className={cn(
        "border-border hover:border-primary/40 transition-all cursor-pointer group hover:shadow-lg hover:shadow-primary/5",
        multiSelectMode && isSelected && "border-primary ring-1 ring-primary bg-primary/5",
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 flex flex-col items-center text-center relative">
        {/* Multi-select checkbox */}
        {multiSelectMode && (
          <button
            className="absolute top-2 left-2 z-10"
            onClick={e => { e.stopPropagation(); onToggleSelect(); }}
          >
            {isSelected ? (
              <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            ) : (
              <div className="w-5 h-5 border-2 border-muted-foreground/40 rounded hover:border-primary transition-colors" />
            )}
          </button>
        )}

        {/* Avatar */}
        <div className="relative mb-2">
          <div className={cn(
            "w-16 h-16 rounded-full overflow-hidden ring-2 transition-all",
            multiSelectMode && isSelected
              ? "ring-primary"
              : "ring-border group-hover:ring-primary/50"
          )}>
            <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center ring-2 ring-background">
            <Zap className="w-2.5 h-2.5 text-white" />
          </div>
        </div>

        {/* Info */}
        <h3 className="text-xs font-semibold leading-tight">{agent.name}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{agent.role}</p>

        {/* Quick stats — real assignment count + specialty */}
        <div className="flex items-center gap-1.5 mt-2 text-[9px] text-muted-foreground">
          <span
            className="flex items-center gap-0.5"
            title={articleCount === 1 ? '1 article assigned' : `${articleCount} articles assigned`}
          >
            <FileText className="w-2.5 h-2.5" />
            {articleCount}
          </span>
          <span>•</span>
          <span className="truncate max-w-[90px]" title={agent.stats.specialty}>
            {agent.stats.specialty}
          </span>
        </div>

        {/* Quick chat button */}
        {!multiSelectMode && (
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-6 text-[10px] gap-1 w-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => { e.stopPropagation(); onChat(); }}
          >
            <MessageSquare className="w-3 h-3" />
            Chat
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Agent List Row ──────────────────────────────────────

function AgentListRow({ agent, articleCount, isEven, onClick, onChat, multiSelectMode, isSelected, onToggleSelect }: {
  agent: Agent;
  articleCount: number;
  isEven: boolean;
  onClick: () => void;
  onChat: () => void;
  multiSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr_150px_100px_80px_70px] gap-3 px-4 py-2.5 items-center cursor-pointer transition-colors group",
        isEven ? "bg-background" : "bg-muted/20",
        "hover:bg-primary/5",
        multiSelectMode && isSelected && "bg-primary/10 hover:bg-primary/15",
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      {multiSelectMode && (
        <button
          className="w-5 flex items-center justify-center"
          onClick={e => { e.stopPropagation(); onToggleSelect(); }}
        >
          {isSelected ? (
            <div className="w-4 h-4 bg-primary rounded flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-primary-foreground" />
            </div>
          ) : (
            <div className="w-4 h-4 border-2 border-muted-foreground/40 rounded hover:border-primary transition-colors" />
          )}
        </button>
      )}

      {/* Agent info */}
      <div className={cn("flex items-center gap-3 min-w-0", !multiSelectMode && "col-start-2")}>
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full overflow-hidden ring-1 ring-border">
            <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center ring-1 ring-background">
            <Zap className="w-2 h-2 text-white" />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{agent.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{agent.bio.slice(0, 60)}...</p>
        </div>
      </div>

      {/* Role */}
      <div>
        <Badge variant="outline" className="text-[10px] font-normal">{agent.role}</Badge>
      </div>

      {/* Specialty */}
      <div className="text-xs text-muted-foreground truncate" title={agent.stats.specialty}>
        {agent.stats.specialty}
      </div>

      {/* Articles — real active assignment count */}
      <div className="text-center">
        <span className={cn("text-sm font-semibold", articleCount === 0 && "text-muted-foreground/50")}>
          {articleCount}
        </span>
      </div>

      {/* Actions */}
      <div className="text-right">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => { e.stopPropagation(); onChat(); }}
        >
          <MessageSquare className="w-3 h-3" />
          Chat
        </Button>
      </div>
    </div>
  );
}

// ─── Agent Profile (Sheet) ───────────────────────────────

function AgentProfile({ agent, articleCount, assignments, onChat, onAssign, onClose }: {
  agent: Agent;
  articleCount: number;
  assignments: any[];
  onChat: () => void;
  onAssign: (input: any) => Promise<any>;
  onClose: () => void;
}) {
  return (
    <div className="space-y-6 pt-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-primary/30 shrink-0">
          <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
        </div>
        <div>
          <h2 className="text-xl font-bold">{agent.name}</h2>
          <p className="text-sm text-primary font-medium">{agent.role}</p>
          <p className="text-xs text-muted-foreground mt-1">{agent.bio}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button onClick={onChat} className="gap-1.5 flex-1" size="sm">
          <MessageSquare className="w-3.5 h-3.5" />
          Start Chat
        </Button>
      </div>

      {/* Stats — real assignment data only */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-lg font-bold">{articleCount}</p>
          <p className="text-[10px] text-muted-foreground">Articles Assigned</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-lg font-bold">{assignments.length}</p>
          <p className="text-[10px] text-muted-foreground">Total Assignments</p>
        </div>
      </div>
      {/* Specialty */}
      <div className="rounded-lg border border-border p-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Specialty</p>
        <p className="text-sm">{agent.stats.specialty}</p>
      </div>

      {/* Expertise */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Expertise</h3>
        <div className="flex flex-wrap gap-1.5">
          {agent.expertise.map(skill => (
            <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
          ))}
        </div>
      </div>

      {/* Personality */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Personality</h3>
        <p className="text-sm text-muted-foreground italic">"{agent.personality}"</p>
      </div>

      {/* Specialty */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Specialty</h3>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm">{agent.stats.specialty}</span>
        </div>
      </div>

      {/* Default Model */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Default Model</h3>
        <Badge variant="secondary" className="text-xs font-mono">{agent.defaultModel}</Badge>
      </div>

      {/* Current Assignments */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Active Assignments ({assignments.length})
        </h3>
        {assignments.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No active assignments</p>
        ) : (
          <div className="space-y-1.5">
            {assignments.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs">
                <Badge variant="outline" className="text-[9px]">{a.targetType}</Badge>
                <span className="truncate flex-1">{a.targetTitle || `#${a.targetId}`}</span>
                {a.role && <span className="text-muted-foreground">{a.role}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Interface ──────────────────────────────────────

function ChatInterface({ agentIds, messages, input, sending, onInputChange, onSend, onClose, messagesEndRef }: {
  agentIds: string[];
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const agents = agentIds.map(id => getAgent(id));
  const isGroup = agentIds.length > 1;

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <div className="flex -space-x-2">
          {agents.slice(0, 4).map(a => (
            <div key={a.id} className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-background">
              <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">
            {isGroup ? `Group: ${agents.map(a => a.name.split(' ')[0]).join(', ')}` : agents[0]?.name}
          </h3>
          <p className="text-[10px] text-muted-foreground">
            {isGroup ? `${agents.length} agents • Meeting` : agents[0]?.role}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-3">
          {/* Welcome */}
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="flex justify-center -space-x-3 mb-4">
                {agents.map(a => (
                  <div key={a.id} className="w-14 h-14 rounded-full overflow-hidden ring-3 ring-background">
                    <img src={a.avatar} alt={a.name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <h3 className="font-semibold">
                {isGroup ? 'Group Meeting' : `Chat with ${agents[0]?.name}`}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {isGroup
                  ? `${agents.map(a => a.name.split(' ')[0]).join(', ')} are ready. They'll collaborate and build on each other's input.`
                  : agents[0]?.personality}
              </p>
              <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5"><Database className="w-2.5 h-2.5" /> KB Access</span>
                <span className="flex items-center gap-0.5"><Brain className="w-2.5 h-2.5" /> Memory</span>
                <span className="flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" /> Articles</span>
                <span className="flex items-center gap-0.5"><Palette className="w-2.5 h-2.5" /> Brands</span>
              </div>
              {/* Quick prompts */}
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {!isGroup && agents[0] && getQuickPrompts(agents[0].id).map((prompt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => { onInputChange(prompt); }}
                  >
                    {prompt}
                  </Button>
                ))}
                {isGroup && (
                  <>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onInputChange("Let's brainstorm article topics for this week")}>
                      Brainstorm topics
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onInputChange("Review and critique this article draft together")}>
                      Review a draft
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => onInputChange("What are the most impactful stories we should cover right now?")}>
                      Story priorities
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg, i) => {
            const agent = msg.agentId ? getAgent(msg.agentId) : null;
            const isUser = msg.role === 'user';

            return (
              <div key={i} className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}>
                {!isUser && agent && (
                  <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-border shrink-0 mt-1">
                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[75%] rounded-xl px-3.5 py-2.5",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 border border-border"
                )}>
                  {!isUser && agent && isGroup && (
                    <p className="text-[10px] font-semibold text-primary mb-0.5">{agent.name} · {agent.role}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {sending && (
            <div className="flex gap-2.5">
              <div className="flex -space-x-1.5">
                {agents.slice(0, 2).map(a => (
                  <div key={a.id} className="w-6 h-6 rounded-full overflow-hidden ring-1 ring-background">
                    <img src={a.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <div className="bg-muted/50 border border-border rounded-xl px-4 py-2.5 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={e => onInputChange(e.target.value)}
            placeholder={isGroup ? "Message the group..." : `Message ${agents[0]?.name.split(' ')[0]}...`}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <Button
            onClick={onSend}
            disabled={!input.trim() || sending}
            size="sm"
            className="h-10 w-10 p-0 shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Prompts per Agent ─────────────────────────────

function getQuickPrompts(agentId: string): string[] {
  const prompts: Record<string, string[]> = {
    researcher: ["Research the latest trends in AI regulation", "Find primary sources on climate tech funding", "What's happening in media industry M&A?"],
    outliner: ["Create an outline for a 2000-word feature", "Structure a counterintuitive argument", "Outline a profile piece format"],
    drafter: ["Write the opening paragraph for my article", "Draft a compelling lede for this topic", "Write a section on market implications"],
    editor: ["Review my draft and suggest improvements", "How can I strengthen the argument here?", "Is the narrative arc working?"],
    rewriter: ["Rewrite this in New Yorker style", "Adapt this for a tech-savvy audience", "Make this more conversational"],
    factchecker: ["Verify the claims in this paragraph", "Check these statistics", "Are these sources reliable?"],
    seo: ["Optimize this article for search", "Suggest keywords for this topic", "How's my heading structure?"],
    scout: ["What topics are trending this week?", "Find underreported story angles", "What should I write about next?"],
    scorer: ["Score this article draft", "What areas need the most improvement?", "Is this ready for publication?"],
    quality: ["Final review before I submit", "Check compliance and brand voice", "Am I ready to publish?"],
  };
  return prompts[agentId] || ["How can you help with my current article?", "What's your recommendation?", "Walk me through your process"];
}
