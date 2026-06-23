import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Network, ChevronDown, ChevronRight, DollarSign, Server,
  AlertCircle, Users, Wifi, WifiOff,
} from 'lucide-react';

/**
 * PlatformAgents — live READ of the self-hosted Command Center agent registry
 * (supabase.insightprofit.live), via trpc.agentic.platformAgents. Proves REAL
 * production agent data: the agent roster, recent run logs, and AI spend that
 * the whole InsightProfit platform writes — alongside this app's own AI Ledger
 * (see AgentActivity). Read-only; no writes back to Supabase.
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

const statusTone = (s: string | null): 'default' | 'secondary' | 'destructive' => {
  const v = (s || '').toLowerCase();
  if (v === 'active' || v === 'running' || v === 'success' || v === 'ok') return 'default';
  if (v === 'error' || v === 'failed') return 'destructive';
  return 'secondary';
};

export function PlatformAgents() {
  const [showLogs, setShowLogs] = useState(false);
  const q = trpc.agentic.platformAgents.useQuery(undefined, { refetchInterval: 60_000 });

  // Loading skeleton
  if (q.isLoading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted/60 rounded-lg" />)}
        </div>
      </Card>
    );
  }

  // Error + retry (network/tRPC failure)
  if (q.isError) {
    return (
      <Card className="p-4 border-destructive/40">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" /> Could not load the platform agent registry.
          </span>
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>Retry</Button>
        </div>
      </Card>
    );
  }

  const d = q.data!;

  // Not configured — env (SUPABASE_URL / SUPABASE_ANON_KEY) is unset. This is a
  // setup gap, not an empty registry, so it gets its own explicit state.
  if (!d.configured) {
    return (
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Platform Agents</span>
          <Badge variant="secondary" className="text-[10px]">Not connected</Badge>
        </div>
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-4 leading-relaxed">
          The live agent registry on <b>supabase.insightprofit.live</b> isn't wired up here yet.
          Set <code className="font-mono">SUPABASE_URL</code> and{' '}
          <code className="font-mono">SUPABASE_ANON_KEY</code> in this app's <code className="font-mono">.env</code>{' '}
          to pull the real platform agent roster, run logs, and AI spend into this panel.
        </p>
      </Card>
    );
  }

  // Reached Supabase but the request failed (bad key, table perms, etc.)
  if (d.error) {
    return (
      <Card className="p-4 border-destructive/40 space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" /> Reached Supabase but the registry read failed.
          </span>
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>Retry</Button>
        </div>
        <p className="text-[11px] text-muted-foreground font-mono break-all">{d.error}</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Platform Agents</span>
          <Badge variant="default" className="text-[10px]">
            <Wifi className="w-3 h-3 mr-1" /> Live
          </Badge>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Server className="w-3 h-3" /> {(d.host || '').replace(/^https?:\/\//, '')}
        </span>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={<Users className="w-3.5 h-3.5" />} label="Agents" value={String(d.agents.total)} sub="in registry" />
        <Stat icon={<DollarSign className="w-3.5 h-3.5" />} label="Spent today" value={money(d.spend.today)} />
        <Stat icon={<DollarSign className="w-3.5 h-3.5" />} label="This month" value={money(d.spend.month)} />
        <Stat icon={<DollarSign className="w-3.5 h-3.5" />} label="All-time" value={money(d.spend.total)} />
      </div>

      {/* This app's own agent(s) in the platform registry */}
      {d.agents.thisApp.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">This app in the registry</div>
          <div className="flex flex-wrap gap-2">
            {d.agents.thisApp.map((a, i) => (
              <span key={`${a.name}-${i}`} className="inline-flex items-center gap-1.5 text-[11px] rounded-full border border-border bg-card px-2.5 py-1">
                <span className="font-medium">{a.name}</span>
                <Badge variant={statusTone(a.status)} className="text-[9px]">{a.status || '—'}</Badge>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agent roster sample */}
      {d.agents.sample.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Registry sample ({d.agents.sample.length} of {d.agents.total})
          </div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {d.agents.sample.map((a, i) => (
              <div key={`${a.name}-${i}`} className="flex items-center justify-between gap-2 text-xs rounded-md px-2.5 py-1.5 bg-muted/30">
                <div className="min-w-0">
                  <span className="font-medium truncate">{a.name}</span>
                  {a.platform && <p className="text-[10px] text-muted-foreground truncate font-mono">{a.platform}</p>}
                </div>
                <Badge variant={statusTone(a.status)} className="shrink-0 text-[9px]">{a.status || '—'}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top spenders */}
      {d.spend.byAgent.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {d.spend.byAgent.map((s) => (
            <span key={s.agent} className="inline-flex items-center gap-1.5 text-[11px] rounded-full border border-border bg-card px-2.5 py-1">
              <span className="font-medium">{s.agent}</span>
              <span className="text-muted-foreground">{s.runs}×</span>
              <span className="text-muted-foreground">{money(s.cost)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Recent run logs (collapsible) */}
      {d.logs.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
            onClick={() => setShowLogs((v) => !v)}
          >
            {showLogs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Recent logs ({d.logs.length})
          </button>
          {showLogs && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="font-medium py-1 pr-3">When</th>
                    <th className="font-medium py-1 pr-3">Agent</th>
                    <th className="font-medium py-1 pr-3">Status</th>
                    <th className="font-medium py-1 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {d.logs.map((l, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap">{timeAgo(l.at)}</td>
                      <td className="py-1 pr-3">{l.agent}{l.error && <span className="block text-destructive/80 text-[10px] truncate">{l.error}</span>}</td>
                      <td className="py-1 pr-3"><Badge variant={statusTone(l.status)} className="text-[9px]">{l.status || '—'}</Badge></td>
                      <td className="py-1 text-right whitespace-nowrap">{money(l.cost)}</td>
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
