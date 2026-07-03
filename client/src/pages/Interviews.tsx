/**
 * AI Interviews — Extract expertise through guided Q&A sessions
 * 
 * Features: 3 preset topic packs + custom, expandable Q&A, progress tracking,
 * completeness indicator, brand linking, insights extraction
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ListSelectionBar, SelectCheck, useSelection } from "@/components/list-selection";
import {
  Mic, Plus, Search, Loader2, ChevronDown, ChevronUp,
  MessageSquare, CheckCircle2, Circle, Trash2, Target,
  Brain, Users, Sparkles, BookOpen, LayoutGrid, List,
} from "lucide-react";

const TOPIC_PACK_INFO = [
  { id: "brand_foundations", name: "Brand Foundations", icon: Target, description: "Core mission, values, personality, and origin story", color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "content_strategy", name: "Content Strategy", icon: BookOpen, description: "Topics, formats, platforms, publishing cadence", color: "text-green-500", bg: "bg-green-500/10" },
  { id: "audience_deep_dive", name: "Audience Deep Dive", icon: Users, description: "Demographics, aspirations, triggers, objections", color: "text-purple-500", bg: "bg-purple-500/10" },
  { id: "custom", name: "Custom Questions", icon: Sparkles, description: "Write your own interview questions", color: "text-amber-500", bg: "bg-amber-500/10" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not Started", color: "bg-slate-500/10 text-slate-500" },
  in_progress: { label: "In Progress", color: "bg-yellow-500/10 text-yellow-500" },
  completed: { label: "Completed", color: "bg-green-500/10 text-green-500" },
  archived: { label: "Archived", color: "bg-muted text-muted-foreground" },
};

export default function Interviews() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState<"updated" | "title" | "completeness">("updated");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState<Record<string, string>>({});

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formTopic, setFormTopic] = useState("");
  const [formPack, setFormPack] = useState("brand_foundations");
  const [formCustomQuestions, setFormCustomQuestions] = useState("");

  // tRPC
  const interviewsQuery = trpc.interviews.list.useQuery({
    status: filterStatus !== "all" ? filterStatus : undefined,
  });
  const createMutation = trpc.interviews.create.useMutation({
    onSuccess: () => { toast.success("Interview created!"); interviewsQuery.refetch(); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });
  const answerMutation = trpc.interviews.answerQuestion.useMutation({
    onSuccess: () => { toast.success("Answer saved!"); interviewsQuery.refetch(); },
  });
  const deleteMutation = trpc.interviews.delete.useMutation({
    onSuccess: () => { toast.success("Deleted"); interviewsQuery.refetch(); },
  });
  const updateMutation = trpc.interviews.update.useMutation({
    onSuccess: () => { interviewsQuery.refetch(); },
  });

  const closeDialog = () => {
    setShowCreateDialog(false);
    setFormTitle(""); setFormTopic(""); setFormPack("brand_foundations"); setFormCustomQuestions("");
  };

  const handleCreate = () => {
    if (!formTitle.trim()) { toast.error("Title is required"); return; }
    createMutation.mutate({
      title: formTitle.trim(),
      topic: formTopic || undefined,
      topicPack: formPack as any,
      customQuestions: formPack === "custom" ? formCustomQuestions.split("\n").filter(Boolean) : undefined,
    });
  };

  const handleAnswer = (interviewId: number, questionId: string) => {
    const answer = answerText[questionId];
    if (!answer?.trim()) return;
    answerMutation.mutate({ interviewId, questionId, answer: answer.trim() });
    setAnswerText(prev => ({ ...prev, [questionId]: "" }));
  };

  const interviews = useMemo(() => {
    let list = interviewsQuery.data || [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i: any) => i.title?.toLowerCase().includes(q) || i.topic?.toLowerCase().includes(q));
    }
    return [...list].sort((a: any, b: any) => {
      if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
      if (sortBy === "completeness") return (b.completeness || 0) - (a.completeness || 0);
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
  }, [interviewsQuery.data, searchQuery, sortBy]);

  const { selected, toggle, clear } = useSelection(
    useMemo(() => interviews.map((i: any) => ({ id: i.id as number })), [interviews])
  );

  const bulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} interview${selected.size === 1 ? "" : "s"}?`)) return;
    for (const id of selected) await deleteMutation.mutateAsync({ id: id as number });
    clear();
  };
  const bulkSetStatus = async (status: string) => {
    for (const id of selected) await updateMutation.mutateAsync({ id: id as number, status });
    clear();
    toast.success(`Updated ${selected.size} interview(s)`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mic className="w-6 h-6 text-primary" />
            AI Interviews
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Extract expertise through guided Q&A sessions to train your AI voice
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Interview</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Start New Interview</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="Interview title..." value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              <Input placeholder="Topic focus (optional)..." value={formTopic} onChange={e => setFormTopic(e.target.value)} />
              <div>
                <label className="text-sm font-medium mb-2 block">Choose Topic Pack</label>
                <div className="grid grid-cols-2 gap-2">
                  {TOPIC_PACK_INFO.map(pack => {
                    const PackIcon = pack.icon;
                    return (
                      <div
                        key={pack.id}
                        onClick={() => setFormPack(pack.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          formPack === pack.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <PackIcon className={`w-4 h-4 ${pack.color}`} />
                          <span className="text-sm font-medium">{pack.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{pack.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              {formPack === "custom" && (
                <Textarea
                  placeholder="Write your questions (one per line)..."
                  value={formCustomQuestions}
                  onChange={e => setFormCustomQuestions(e.target.value)}
                  rows={5}
                />
              )}
              <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                Start Interview
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search interviews..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="h-9 text-xs rounded-md border border-input bg-background px-2" title="Sort">
          <option value="updated">Recently updated</option>
          <option value="title">Title A→Z</option>
          <option value="completeness">Completeness</option>
        </select>
        <div className="flex gap-1 border rounded-md p-1">
          <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")}><LayoutGrid className="w-4 h-4" /></Button>
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")}><List className="w-4 h-4" /></Button>
        </div>
      </div>

      <ListSelectionBar
        selected={selected}
        clear={clear}
        onDelete={bulkDelete}
        statusOptions={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))}
        onSetStatus={bulkSetStatus}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{interviews.length}</p>
          <p className="text-xs text-muted-foreground">Total Interviews</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{interviews.filter((i: any) => i.status === "completed").length}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-500">{interviews.filter((i: any) => i.status === "in_progress").length}</p>
          <p className="text-xs text-muted-foreground">In Progress</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-500">
            {interviews.length > 0 ? Math.round(interviews.reduce((s: number, i: any) => s + (i.completeness || 0), 0) / interviews.length) : 0}%
          </p>
          <p className="text-xs text-muted-foreground">Avg Completeness</p>
        </CardContent></Card>
      </div>

      {/* Interview list */}
      {interviewsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : interviews.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Mic className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">No interviews yet</p>
          <Button className="mt-4" onClick={() => setShowCreateDialog(true)}><Plus className="w-4 h-4 mr-2" />Start Your First Interview</Button>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {interviews.map((interview: any) => {
            const statusConf = STATUS_CONFIG[interview.status] || STATUS_CONFIG.not_started;
            const packInfo = TOPIC_PACK_INFO.find(p => p.id === interview.topicPack);
            const PackIcon = packInfo?.icon || Brain;
            const isExpanded = expandedId === interview.id;
            const questions = (interview.questions as any[]) || [];

            return (
              <Card key={interview.id} className={`overflow-hidden ${selected.has(interview.id) ? "ring-1 ring-primary/40" : ""}`}>
                <CardHeader
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : interview.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span onClick={e => e.stopPropagation()}>
                        <SelectCheck checked={selected.has(interview.id)} onToggle={() => toggle(interview.id)} />
                      </span>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${packInfo?.bg || "bg-muted"}`}>
                        <PackIcon className={`w-5 h-5 ${packInfo?.color || "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{interview.title}</CardTitle>
                        <CardDescription className="text-xs">
                          {packInfo?.name || "Custom"} • {questions.length} questions
                          {interview.topic && ` • ${interview.topic}`}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={statusConf.color}>{statusConf.label}</Badge>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{interview.completeness || 0}%</span>
                    </div>
                    <Progress value={interview.completeness || 0} className="h-2" />
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="border-t pt-4 space-y-4">
                    {questions.map((q: any, idx: number) => (
                      <div key={q.id} className="space-y-2">
                        <div className="flex items-start gap-2">
                          {q.answer ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">Q{idx + 1}: {q.question}</p>
                            {q.answer ? (
                              <p className="text-sm text-muted-foreground mt-1 bg-muted/30 rounded p-2">{q.answer}</p>
                            ) : (
                              <div className="flex gap-2 mt-1">
                                <Textarea
                                  placeholder="Type your answer..."
                                  value={answerText[q.id] || ""}
                                  onChange={e => setAnswerText(prev => ({ ...prev, [q.id]: e.target.value }))}
                                  rows={2}
                                  className="flex-1"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleAnswer(interview.id, q.id)}
                                  disabled={answerMutation.isPending || !(answerText[q.id]?.trim())}
                                >
                                  {answerMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <MessageSquare className="w-3 h-3" />}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {interview.extractedInsights?.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-sm font-medium mb-2">Extracted Insights</p>
                        <div className="space-y-1">
                          {(interview.extractedInsights as string[]).map((insight: string, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <Sparkles className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                              <span>{insight}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate({ id: interview.id })}>
                        <Trash2 className="w-4 h-4 mr-1" />Delete Interview
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
