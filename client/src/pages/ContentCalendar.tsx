/**
 * Content Calendar — Visual content scheduling and management
 * 
 * Features: Full month calendar view, click-to-add, event management,
 * month navigation, platform filters, status colors
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ListSelectionBar, SelectCheck, useSelection } from "@/components/list-selection";
import {
  Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight,
  Loader2, Trash2, Edit, Linkedin, Twitter, Instagram,
  Facebook, Globe, FileText, Mail, Hash, Newspaper,
} from "lucide-react";

const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, color: "bg-blue-500" },
  { value: "twitter", label: "X", icon: Twitter, color: "bg-sky-500" },
  { value: "instagram", label: "Instagram", icon: Instagram, color: "bg-pink-500" },
  { value: "facebook", label: "Facebook", icon: Facebook, color: "bg-blue-600" },
  { value: "bluesky", label: "Bluesky", icon: Globe, color: "bg-sky-400" },
  { value: "blog", label: "Blog", icon: FileText, color: "bg-emerald-500" },
  { value: "newsletter", label: "Newsletter", icon: Mail, color: "bg-amber-500" },
  { value: "threads", label: "Threads", icon: Hash, color: "bg-purple-500" },
  { value: "press", label: "Press", icon: Newspaper, color: "bg-slate-500" },
  { value: "tiktok", label: "TikTok", icon: Globe, color: "bg-rose-500" },
  { value: "youtube", label: "YouTube", icon: Globe, color: "bg-red-500" },
];

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-slate-400",
  drafting: "bg-yellow-500",
  review: "bg-orange-500",
  approved: "bg-green-500",
  scheduled: "bg-blue-500",
  published: "bg-purple-500",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ContentCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [showDialog, setShowDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPlatform, setFormPlatform] = useState("linkedin");
  const [formType, setFormType] = useState("post");
  const [formStatus, setFormStatus] = useState("planned");
  const [formTime, setFormTime] = useState("");
  const [formAssignee, setFormAssignee] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;

  // tRPC
  const eventsQuery = trpc.calendar.list.useQuery({
    startDate,
    endDate,
    platform: filterPlatform !== "all" ? filterPlatform : undefined,
  });
  const createMutation = trpc.calendar.create.useMutation({
    onSuccess: () => { toast.success("Event added!"); eventsQuery.refetch(); closeDialog(); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateMutation = trpc.calendar.update.useMutation({
    onSuccess: () => { toast.success("Updated"); eventsQuery.refetch(); closeDialog(); },
  });
  const deleteMutation = trpc.calendar.delete.useMutation({
    onSuccess: () => { toast.success("Removed"); eventsQuery.refetch(); },
  });
  // Silent instances for bulk loops (avoid per-item toasts/refetches)
  const bulkDeleteMutation = trpc.calendar.delete.useMutation();
  const bulkUpdateMutation = trpc.calendar.update.useMutation();

  const { selected, toggle, clear } = useSelection(
    useMemo(() => (eventsQuery.data || []).map((e: any) => ({ id: e.id as number })), [eventsQuery.data])
  );

  const bulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} event(s)?`)) return;
    await Promise.all([...selected].map(id => bulkDeleteMutation.mutateAsync({ id: id as number })));
    toast.success(`${selected.size} events deleted`);
    clear();
    eventsQuery.refetch();
  };
  const bulkSetStatus = async (status: string) => {
    await Promise.all([...selected].map(id => bulkUpdateMutation.mutateAsync({ id: id as number, status })));
    toast.success(`Updated ${selected.size} event(s)`);
    clear();
    eventsQuery.refetch();
  };

  const closeDialog = () => {
    setShowDialog(false); setEditingEvent(null); setSelectedDate(null);
    setFormTitle(""); setFormDesc(""); setFormPlatform("linkedin");
    setFormType("post"); setFormStatus("planned"); setFormTime(""); setFormAssignee("");
  };

  const openAdd = (date: string) => {
    setSelectedDate(date);
    setShowDialog(true);
  };

  const openEdit = (event: any) => {
    setEditingEvent(event);
    setSelectedDate(event.scheduledDate);
    setFormTitle(event.title); setFormDesc(event.description || "");
    setFormPlatform(event.platform); setFormType(event.contentType);
    setFormStatus(event.status); setFormTime(event.scheduledTime || "");
    setFormAssignee(event.assignee || "");
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formTitle.trim()) { toast.error("Title is required"); return; }
    if (!selectedDate) return;
    if (editingEvent) {
      updateMutation.mutate({
        id: editingEvent.id, title: formTitle, description: formDesc,
        scheduledDate: selectedDate, scheduledTime: formTime || undefined,
        platform: formPlatform, contentType: formType, status: formStatus,
        assignee: formAssignee || undefined,
      });
    } else {
      createMutation.mutate({
        title: formTitle, description: formDesc, scheduledDate: selectedDate,
        scheduledTime: formTime || undefined, platform: formPlatform,
        contentType: formType, status: formStatus, assignee: formAssignee || undefined,
      });
    }
  };

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7; // Monday start
    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    // Previous month padding
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date, day: d, isCurrentMonth: true });
    }
    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    (eventsQuery.data || []).forEach((e: any) => {
      if (!map[e.scheduledDate]) map[e.scheduledDate] = [];
      map[e.scheduledDate].push(e);
    });
    return map;
  }, [eventsQuery.data]);

  const today = new Date().toISOString().slice(0, 10);
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  const totalEvents = (eventsQuery.data || []).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" />
            Content Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalEvents} events in {monthName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Month title */}
      <h2 className="text-xl font-semibold text-center">{monthName}</h2>

      {/* Bulk actions */}
      <ListSelectionBar
        selected={selected}
        clear={clear}
        onDelete={bulkDelete}
        statusOptions={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
        onSetStatus={bulkSetStatus}
      />

      {/* Calendar Grid */}
      {eventsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-muted">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2 border-b">{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const dayEvents = eventsByDate[day.date] || [];
              const isToday = day.date === today;
              return (
                <div
                  key={i}
                  className={`min-h-[100px] border-b border-r p-1.5 cursor-pointer transition-colors hover:bg-muted/50 ${
                    !day.isCurrentMonth ? "bg-muted/30 text-muted-foreground" : ""
                  } ${isToday ? "bg-primary/5 ring-1 ring-primary/20 ring-inset" : ""}`}
                  onClick={() => openAdd(day.date)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${isToday ? "text-primary font-bold" : ""}`}>{day.day}</span>
                    {dayEvents.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">{dayEvents.length}</Badge>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event: any) => {
                      const platObj = PLATFORMS.find(p => p.value === event.platform);
                      const statusColor = STATUS_COLORS[event.status] || "bg-slate-400";
                      return (
                        <div
                          key={event.id}
                          className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] bg-muted/60 hover:bg-muted truncate"
                          onClick={(e) => { e.stopPropagation(); openEdit(event); }}
                        >
                          <SelectCheck
                            checked={selected.has(event.id)}
                            onToggle={() => toggle(event.id)}
                            className="accent-[var(--primary)] w-3 h-3 shrink-0"
                          />
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
                          <span className="truncate">{event.title}</span>
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground text-center">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="capitalize">{status}</span>
          </div>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? "Edit Event" : `Add Event — ${selectedDate}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input placeholder="Event title..." value={formTitle} onChange={e => setFormTitle(e.target.value)} />
            <Textarea placeholder="Description (optional)..." value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={formPlatform} onValueChange={setFormPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["post","thread","article","carousel","story","reel","press_release","newsletter","video"].map(t => (
                    <SelectItem key={t} value={t}>{t.replace("_"," ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["planned","drafting","review","approved","scheduled","published"].map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} placeholder="Time" />
            </div>
            <Input placeholder="Assignee (optional)..." value={formAssignee} onChange={e => setFormAssignee(e.target.value)} />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingEvent ? "Update" : "Add Event"}
              </Button>
              {editingEvent && (
                <Button variant="destructive" onClick={() => { deleteMutation.mutate({ id: editingEvent.id }); closeDialog(); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
