import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Send, Plus, Mail, Clock, CheckCircle2, XCircle,
  AlertCircle, Copy, Trash2, Eye
} from 'lucide-react';
import { PUBLICATIONS } from '@/lib/publications-data';
import { trpc } from '@/lib/trpc';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'bg-secondary text-secondary-foreground', icon: Clock },
  sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Send },
  accepted: { label: 'Accepted', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
  no_response: { label: 'No Response', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: AlertCircle },
};

const PITCH_TEMPLATES = {
  standard: `Dear [Editor Name],

I'd like to pitch an article titled "[Article Title]" for [Publication Name].

[HOOK - One compelling sentence about why this matters now]

[ANGLE - 2-3 sentences about your unique perspective and what data/sources you'll include]

[CREDENTIALS - Brief relevant expertise or previous publications]

The piece would be approximately [word count] words and I can deliver within [timeline].

Thank you for your consideration.

Best regards,
[Your Name]`,
  data_driven: `Dear [Editor Name],

New data from [Source] reveals [surprising finding]. I'd like to write a [word count]-word data journalism piece for [Publication Name] that explores the implications.

Key findings I'll cover:
• [Data point 1]
• [Data point 2]  
• [Data point 3]

I'll include original analysis, expert commentary from [experts], and actionable takeaways for your readers.

[Brief credentials]

Available for a [timeline] turnaround.

Best,
[Your Name]`,
  personal_narrative: `Dear [Editor Name],

I'd like to pitch a personal essay for [Publication Name] about [topic].

[Opening scene or hook from the essay - 2-3 sentences]

This piece connects my experience to the broader trend of [trend], which affects [audience]. I'll weave in [data/research] to give the personal narrative universal relevance.

[Brief bio and relevant credentials]

The essay would be approximately [word count] words.

Thank you,
[Your Name]`,
};

export default function Pitches() {
  const { state, addPitch, updatePitch, deletePitch } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [pubSearch, setPubSearch] = useState('');
  const [selectedPubId, setSelectedPubId] = useState('');
  const [editorName, setEditorName] = useState('');
  const [editorEmail, setEditorEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [pitchTemplate, setPitchTemplate] = useState('standard');
  const [viewPitch, setViewPitch] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const pitchMutation = trpc.ai.pitch.useMutation();
  const createPitchDb = trpc.data.pitches.create.useMutation();
  const updatePitchDb = trpc.data.pitches.update.useMutation();
  const deletePitchDb = trpc.data.pitches.delete.useMutation();
  const [pitchIdMap] = useState<Map<string, number>>(() => new Map());

  // Handle URL params from Publications page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pubId = params.get('pub');
    if (pubId) {
      handleSelectPub(pubId);
      setShowNew(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const pubResults = useMemo(() => {
    if (!pubSearch.trim()) return [];
    return PUBLICATIONS.filter(p =>
      p.name.toLowerCase().includes(pubSearch.toLowerCase())
    ).slice(0, 6);
  }, [pubSearch]);

  const handleSelectPub = (pubId: string) => {
    const pub = PUBLICATIONS.find(p => p.id === pubId);
    if (pub) {
      setSelectedPubId(pub.id);
      setPubSearch(pub.name);
      if (pub.editors.length > 0) {
        setEditorName(pub.editors[0].name);
        setEditorEmail(pub.editors[0].email);
      }
    }
  };

  const handleInsertTemplate = () => {
    const tmpl = PITCH_TEMPLATES[pitchTemplate as keyof typeof PITCH_TEMPLATES] || PITCH_TEMPLATES.standard;
    setBody(tmpl);
    toast.success('Template inserted');
  };

  const handleCreate = () => {
    if (!selectedPubId || !subject.trim()) { toast.error('Publication and subject required'); return; }
    const pub = PUBLICATIONS.find(p => p.id === selectedPubId);
    const pitch = addPitch({
      publication_id: selectedPubId,
      publication_name: pub?.name || pubSearch,
      editor_name: editorName,
      editor_email: editorEmail,
      subject: subject.trim(),
      body: body.trim(),
      status: 'draft',
    });
    createPitchDb.mutate({ publicationId: selectedPubId, publicationName: pub?.name || pubSearch, editorName, editorEmail, subject: subject.trim(), body: body.trim() }, {
      onSuccess: (r) => { if (r?.id) pitchIdMap.set(pitch.id, r.id); }
    });
    setPubSearch(''); setSelectedPubId(''); setEditorName(''); setEditorEmail('');
    setSubject(''); setBody('');
    setShowNew(false);
    toast.success('Pitch created');
  };

  const handleCopyEmail = (pitch: typeof state.pitches[0]) => {
    const text = `To: ${pitch.editor_email}\nSubject: ${pitch.subject}\n\n${pitch.body}`;
    navigator.clipboard.writeText(text);
    toast.success('Pitch copied to clipboard');
  };

  const handleMarkSent = (id: string) => {
    updatePitch(id, { status: 'sent', sent_at: new Date().toISOString() });
    const dbId = pitchIdMap.get(id);
    if (dbId) updatePitchDb.mutate({ id: dbId, status: 'sent' });
    toast.success('Marked as sent');
  };

  const filtered = state.pitches.filter(p => filterStatus === 'all' || p.status === filterStatus);
  const viewingPitch = state.pitches.find(p => p.id === viewPitch);

  const stats = useMemo(() => ({
    total: state.pitches.length,
    sent: state.pitches.filter(p => p.status === 'sent').length,
    accepted: state.pitches.filter(p => p.status === 'accepted').length,
    rejected: state.pitches.filter(p => p.status === 'rejected').length,
    pending: state.pitches.filter(p => p.status === 'no_response').length,
  }), [state.pitches]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Send className="w-6 h-6 text-violet-400" />
            Pitch Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, track, and optimize your publication pitches
          </p>
        </div>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> New Pitch</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Pitch</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Publication</label>
                <div className="relative">
                  <Input value={pubSearch} onChange={e => setPubSearch(e.target.value)} placeholder="Search publications..." />
                  {pubResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-10">
                      {pubResults.map(pub => (
                        <button key={pub.id} className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          onClick={() => handleSelectPub(pub.id)}>
                          {pub.name} <span className="text-muted-foreground">— {pub.category}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Editor Name</label>
                  <Input value={editorName} onChange={e => setEditorName(e.target.value)} placeholder="Editor name" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Editor Email</label>
                  <Input value={editorEmail} onChange={e => setEditorEmail(e.target.value)} placeholder="editor@pub.com" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Subject Line</label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Pitch: [Article Title] for [Publication]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium">Pitch Body</label>
                  <div className="flex gap-1.5">
                    <select value={pitchTemplate} onChange={e => setPitchTemplate(e.target.value)}
                      className="h-7 rounded border border-input bg-background px-2 text-xs">
                      <option value="standard">Standard</option>
                      <option value="data_driven">Data-Driven</option>
                      <option value="personal_narrative">Personal Narrative</option>
                    </select>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleInsertTemplate}>Insert</Button>
                    <Button variant="default" size="sm" className="h-7 text-xs gap-1" disabled={!selectedPubId || pitchMutation.isPending}
                      onClick={async () => {
                        if (!selectedPubId) { toast.error('Select a publication first'); return; }
                        const pub = PUBLICATIONS.find(p => p.id === selectedPubId);
                        if (!pub) return;
                        try {
                          const result = await pitchMutation.mutateAsync({
                            articleTitle: subject || 'Article pitch',
                            articleSummary: body || 'Business analysis article',
                            publicationName: pub.name,
                            editorName: editorName || undefined,
                          });
                          if (result.success && result.data) {
                            if (result.data.subject && !subject) setSubject(result.data.subject);
                            if (result.data.body) setBody(result.data.body);
                            const tokens = result.usage?.total_tokens || 0;
                            toast.success(`Pitch generated (${tokens} tokens)`);
                          }
                        } catch (err: any) {
                          toast.error(err.message || 'AI generation failed');
                        }
                      }}>
                      {pitchMutation.isPending ? 'Generating...' : 'AI Generate'}
                    </Button>
                  </div>
                </div>
                <textarea value={body} onChange={e => setBody(e.target.value)}
                  placeholder="Write your pitch..."
                  className="w-full h-64 rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" />
              </div>
              <Button onClick={handleCreate} className="w-full">Create Pitch</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Sent', value: stats.sent, color: 'text-blue-400' },
          { label: 'Accepted', value: stats.accepted, color: 'text-emerald-400' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-400' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
        ].map(s => (
          <Card key={s.label} className="border-border">
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1.5">
        {['all', 'draft', 'sent', 'accepted', 'rejected', 'no_response'].map(status => (
          <Button key={status} variant={filterStatus === status ? 'default' : 'outline'} size="sm"
            onClick={() => setFilterStatus(status)} className="text-xs capitalize">
            {status === 'all' ? 'All' : status.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {/* Pitches List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="border-border">
            <CardContent className="p-12 text-center">
              <Send className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <h3 className="font-semibold mb-1">No pitches yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first pitch to start submitting to publications</p>
              <Button onClick={() => setShowNew(true)} className="gap-2"><Plus className="w-4 h-4" /> Create Pitch</Button>
            </CardContent>
          </Card>
        ) : (
          filtered.map(pitch => {
            const config = STATUS_CONFIG[pitch.status] || STATUS_CONFIG.draft;
            const StatusIcon = config.icon;
            return (
              <Card key={pitch.id} className="border-border hover:border-primary/20 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                          <StatusIcon className="w-2.5 h-2.5 mr-1" />{config.label}
                        </Badge>
                        <span className="text-xs font-medium text-primary">{pitch.publication_name}</span>
                      </div>
                      <h3 className="font-semibold text-sm mb-0.5">{pitch.subject}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{pitch.editor_name}</span>
                        <span>{new Date(pitch.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setViewPitch(pitch.id)} title="View">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleCopyEmail(pitch)} title="Copy">
                        <Copy className="w-4 h-4" />
                      </Button>
                      {pitch.status === 'draft' && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleMarkSent(pitch.id)} title="Mark sent">
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                      {pitch.status === 'sent' && (
                        <>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-emerald-400"
                            onClick={() => { updatePitch(pitch.id, { status: 'accepted' }); const dbId = pitchIdMap.get(pitch.id); if (dbId) updatePitchDb.mutate({ id: dbId, status: 'accepted' }); toast.success('Marked accepted!'); }} title="Accepted">
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400"
                            onClick={() => { updatePitch(pitch.id, { status: 'rejected' }); const dbId = pitchIdMap.get(pitch.id); if (dbId) updatePitchDb.mutate({ id: dbId, status: 'rejected' }); toast.info('Marked rejected'); }} title="Rejected">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive"
                        onClick={() => { const dbId = pitchIdMap.get(pitch.id); if (dbId) deletePitchDb.mutate({ id: dbId }); deletePitch(pitch.id); toast.success('Deleted'); }} title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* View Pitch Dialog */}
      <Dialog open={!!viewPitch} onOpenChange={() => setViewPitch(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Pitch Details</DialogTitle>
          </DialogHeader>
          {viewingPitch && (
            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs block">Publication</span>{viewingPitch.publication_name}</div>
                <div><span className="text-muted-foreground text-xs block">Status</span>{STATUS_CONFIG[viewingPitch.status]?.label}</div>
                <div><span className="text-muted-foreground text-xs block">Editor</span>{viewingPitch.editor_name}</div>
                <div><span className="text-muted-foreground text-xs block">Email</span>{viewingPitch.editor_email}</div>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block mb-1">Subject</span>
                <p className="text-sm font-medium">{viewingPitch.subject}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block mb-1">Body</span>
                <pre className="text-sm whitespace-pre-wrap bg-secondary/50 rounded-md p-3 max-h-64 overflow-y-auto">{viewingPitch.body}</pre>
              </div>
              <Button className="w-full gap-2" onClick={() => handleCopyEmail(viewingPitch)}>
                <Copy className="w-4 h-4" /> Copy to Clipboard
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
