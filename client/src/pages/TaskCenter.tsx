/**
 * Task Center — the single AI-task entry point (ported from the old app).
 * Run any proactive agent job on demand, or hand a one-off instruction to any
 * of the 18 agent personas. Free-model execution.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ListChecks, Play, Loader2, Sparkles, Copy } from "lucide-react";

export default function TaskCenter() {
  const jobs = trpc.taskCenter.jobs.useQuery();
  const personas = trpc.taskCenter.personas.useQuery();
  const runJob = trpc.taskCenter.runJob.useMutation();
  const submit = trpc.taskCenter.submit.useMutation();

  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [persona, setPersona] = useState("");
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState<any>(null);

  const fire = async (name: string) => {
    setRunningJob(name);
    try {
      await runJob.mutateAsync({ name: name as any });
      toast.success(`Ran ${name} — check its workspace database for results`);
    } catch (e: any) {
      toast.error(e?.message || "Job failed");
    } finally {
      setRunningJob(null);
    }
  };

  const run = async () => {
    if (!persona || !instruction.trim()) return;
    try {
      const r = await submit.mutateAsync({ persona, instruction: instruction.trim() });
      setResult(r);
    } catch (e: any) {
      toast.error(e?.message || "Task failed");
    }
  };

  return (
    <div className="p-4 space-y-5 max-w-[1100px] mx-auto">
      <div className="flex items-center gap-2">
        <ListChecks className="w-5 h-5 text-violet-400" />
        <h1 className="text-xl font-bold text-white">Task Center</h1>
        <span className="text-sm text-zinc-500">run agent jobs on demand or hand off a one-off task</span>
      </div>

      {/* Proactive jobs */}
      <div>
        <h2 className="text-base font-medium text-white mb-2">Agent jobs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(jobs.data ?? []).map((j: any) => (
            <div key={j.name} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-white">{j.label}</div>
                <div className="text-xs text-zinc-500">{j.description}</div>
              </div>
              <button onClick={() => fire(j.name)} disabled={runningJob === j.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm shrink-0 disabled:opacity-50">
                {runningJob === j.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* One-off agent task */}
      <div>
        <h2 className="text-base font-medium text-white mb-2">One-off task</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
          <select value={persona} onChange={(e) => setPersona(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="">Pick an agent…</option>
            {(personas.data ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.role}</option>)}
          </select>
          <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3}
            placeholder="What do you want this agent to do? e.g. 'Draft 5 pitch angles for a Forbes piece on AI marketing departments'"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600" />
          <button onClick={run} disabled={submit.isPending || !persona || !instruction.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm disabled:opacity-50">
            {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Run task
          </button>
        </div>
      </div>

      {submit.isPending && <div className="h-40 animate-pulse rounded-xl bg-zinc-800/60" />}

      {result && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">{result.agent} · <span className="text-zinc-500">{result.role}</span></span>
            <button onClick={() => { navigator.clipboard.writeText(result.output); toast.success("Copied"); }} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white"><Copy className="w-3.5 h-3.5" /> Copy</button>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-zinc-200 leading-relaxed font-sans">{result.output}</pre>
        </div>
      )}
    </div>
  );
}
