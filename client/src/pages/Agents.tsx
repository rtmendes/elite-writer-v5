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
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  MessageSquare, Users, Send, Search, Clock, Zap, X, Check,
  Loader2, Sparkles, FileText, MoreHorizontal, Trash2, MessagesSquare,
  Brain, Database, BookOpen, Lightbulb, Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────

type ChatMode = 'one_on_one' | 'group' | 'meeting';

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

  // Filter agents by search
  const filteredAgents = useMemo(() => {
    if (!searchQuery) return AGENT_LIST;
    const q = searchQuery.toLowerCase();
    return AGENT_LIST.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.role.toLowerCase().includes(q) ||
      a.expertise.some(e => e.toLowerCase().includes(q))
    );
  }, [searchQuery]);

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

  // ─── Handlers ────────────────────────────────────────

  const handleAgentClick = (agent: Agent) => {
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

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Editorial Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            18 specialized agents — click to interact, chat, or assign to projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setGroupSelectOpen(true)}
          >
            <Users className="w-3.5 h-3.5" />
            Group Meeting
          </Button>
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search agents by name, role, or expertise..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {filteredAgents.map(agent => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onClick={() => handleAgentClick(agent)}
            onChat={() => handleStartChat([agent.id])}
          />
        ))}
      </div>

      {/* Recent Chats */}
      {chatsQuery.data && chatsQuery.data.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Conversations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {chatsQuery.data.slice(0, 6).map(chat => (
              <Card
                key={chat.id}
                className="border-border hover:border-primary/30 cursor-pointer transition-all group"
                onClick={() => handleOpenExistingChat(chat)}
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

// ─── Agent Card ──────────────────────────────────────────

function AgentCard({ agent, onClick, onChat }: { agent: Agent; onClick: () => void; onChat: () => void }) {
  return (
    <Card
      className="border-border hover:border-primary/40 transition-all cursor-pointer group hover:shadow-lg hover:shadow-primary/5"
      onClick={onClick}
    >
      <CardContent className="p-3 flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="relative mb-2">
          <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-border group-hover:ring-primary/50 transition-all">
            <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center ring-2 ring-background">
            <Zap className="w-2.5 h-2.5 text-white" />
          </div>
        </div>

        {/* Info */}
        <h3 className="text-xs font-semibold leading-tight">{agent.name}</h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">{agent.role}</p>

        {/* Quick stats */}
        <div className="flex items-center gap-1.5 mt-2 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <FileText className="w-2.5 h-2.5" />
            {agent.stats.articlesProcessed}
          </span>
          <span>•</span>
          <span className="flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {agent.stats.avgResponseTime}
          </span>
        </div>

        {/* Quick chat button */}
        <Button
          size="sm"
          variant="ghost"
          className="mt-2 h-6 text-[10px] gap-1 w-full opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => { e.stopPropagation(); onChat(); }}
        >
          <MessageSquare className="w-3 h-3" />
          Chat
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Agent Profile (Sheet) ───────────────────────────────

function AgentProfile({ agent, assignments, onChat, onAssign, onClose }: {
  agent: Agent;
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-lg font-bold">{agent.stats.articlesProcessed}</p>
          <p className="text-[10px] text-muted-foreground">Articles</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-lg font-bold">{agent.stats.avgResponseTime}</p>
          <p className="text-[10px] text-muted-foreground">Avg Response</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-lg font-bold">{assignments.length}</p>
          <p className="text-[10px] text-muted-foreground">Assignments</p>
        </div>
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
  messagesEndRef: React.RefObject<HTMLDivElement>;
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
