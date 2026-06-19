import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity, ChevronDown, ChevronRight, Clock, DollarSign,
  Cpu, AlertCircle, Zap,
} from 'lucide-react';

/**
 * AgentActivity — read-only proof that the proactive agents are alive.
 * Reads the AI Ledger the proactive loop already writes to (trpc.agentic.activity)
 * and shows: what ran, when, what it cost, and on what schedule. No writes.
 */

function timeAgo(ts: number | null): string {
  if (!ts) return 'never';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const money = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;

export function AgentActivity() {
  const [showRuns, setShowRuns] = useState(false);
  const q = trpc.agentic.activity.useQuery(undefined, { refetchInterval: 60_000 });

  // Loading skeleton
  if (q.isLoading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-4 w-40 bg-muted rounded mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted/60 rounded-lg" />)}
        </div>
      </Card>
    );
  }

  // Error + retry
  if (q.isError) {
    return (
      <Card className="p-4 border-destructive/40">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" /> Could not load agent activity.
          </span>
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>Retry</Button>
        </div>
      </Card>
    );
  }

  const d = q.data!;
  const live = d.proactiveEnabled;

  return (
    <Card className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${live ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className="text-sm font-semibold">Agent Activity</span>
          <Badge variant={live ? 'default' : 'secondary'} className="text-[10px]">
            {live ? 'Proactive ON' : 'Proactive OFF'}
          </Badge>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" /> last activity {timeAgo(d.lastActivityAt)}
        </span>
      </div>

      {/* Not yet configured / no runs */}
      {!d.configured || d.totals.runs === 0 ? (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-4 leading-relaxed">
          No agent runs logged yet. The proactive loop writes to the <b>AI Ledger</b> as it
          scouts ideas, scores the pipeline, and reviews drafts. Once it runs (or you trigger an
          agent), this panel shows every run, its model, and its cost — budget-capped at{' '}
          {money(d.totals.budget)}/mo.
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat icon={<Zap className="w-3.5 h-3.5" />} label="Total runs" value={String(d.totals.runs)} />
            <Stat icon={<DollarSign className="w-3.5 h-3.5" />} label="Spent today" value={money(d.totals.today)} />
            <Stat icon={<DollarSign className="w-3.5 h-3.5" />} label="This month" value={money(d.totals.month)} />
            <Stat
              icon={<Cpu className="w-3.5 h-3.5" />}
              label="Budget left"
              value={d.totals.remaining === null ? '∞' : money(d.totals.remaining)}
              sub={`of ${money(d.totals.budget)}/mo`}
            />
          </div>

          {/* Per-task rollup */}
          {d.byTask.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {d.byTask.slice(0, 8).map((t) => (
                <span key={t.task} className="inline-flex items-center gap-1.5 text-[11px] rounded-full border border-border bg-card px-2.5 py-1">
                  <span className="font-medium">{t.task}</span>
                  <span className="text-muted-foreground">{t.runs}×</span>
                  <span className="text-muted-foreground">{money(t.cost)}</span>
                  <span className="text-muted-foreground/70">· {timeAgo(t.lastRun)}</span>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Scheduled jobs — proof of what runs even with zero history */}
      <div>
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Scheduled agents
        </div>
        <div className="grid sm:grid-cols-2 gap-1.5">
          {d.jobs.map((j) => (
            <div key={j.key} className="flex items-start justify-between gap-2 text-xs rounded-md px-2.5 py-1.5 bg-muted/30">
              <div className="min-w-0">
                <span className="font-medium">{j.label}</span>
                <p className="text-[11px] text-muted-foreground truncate">{j.desc}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px] font-mono">{j.cadence}</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Recent runs (collapsible) */}
      {d.recent.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
            onClick={() => setShowRuns((v) => !v)}
          >
            {showRuns ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Recent runs ({d.recent.length})
          </button>
          {showRuns && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="font-medium py-1 pr-3">When</th>
                    <th className="font-medium py-1 pr-3">Task</th>
                    <th className="font-medium py-1 pr-3">Model</th>
                    <th className="font-medium py-1 pr-3 text-right">Tokens</th>
                    <th className="font-medium py-1 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.map((r) => (
                    <tr key={r.id} className="border-t border-border/50">
                      <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap">{timeAgo(r.at)}</td>
                      <td className="py-1 pr-3">{r.task}</td>
                      <td className="py-1 pr-3 font-mono text-muted-foreground">{r.model}</td>
                      <td className="py-1 pr-3 text-right text-muted-foreground whitespace-nowrap">{r.tokensIn}/{r.tokensOut}</td>
                      <td className="py-1 text-right whitespace-nowrap">{money(r.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}{label}
      </div>
      <div className="text-lg font-semibold leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
