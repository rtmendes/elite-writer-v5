/**
 * Financial Accelerator — the $100K–$200K/mo goal engine ported from the old
 * elite-writer-app. Goal progress, frontend/backend revenue split, offer stack,
 * article→revenue attribution, and a free-model "next best action" strategist.
 */
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Rocket, Target, TrendingUp, DollarSign, Layers, Sparkles, Loader2,
  ArrowUpRight, Pencil, Check,
} from "lucide-react";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export default function Accelerator() {
  const dash = trpc.accelerator.dashboard.useQuery();
  const utils = trpc.useUtils();
  const setGoal = trpc.accelerator.setGoal.useMutation();
  const nba = trpc.accelerator.nextBestAction.useMutation();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [strategy, setStrategy] = useState<any>(null);

  const d = dash.data;
  const topSources = useMemo(() => (d?.attributions ?? []).slice(0, 5).map((a: any) => a.source), [d]);

  const runStrategy = async () => {
    if (!d) return;
    try {
      const r = await nba.mutateAsync({
        goalMonthly: d.goalMonthly, mrr: d.mrr, projectedMonth: d.projectedMonth,
        frontendRevenue: d.frontendRevenue, backendRevenue: d.backendRevenue,
        offers: (d.offers ?? []).map((o: any) => ({ name: o.name, price: o.price })),
        topSources,
      });
      setStrategy(r);
    } catch (e: any) {
      toast.error(e?.message || "Strategy failed");
    }
  };

  const saveGoal = async () => {
    const v = Number(goalInput.replace(/[^0-9]/g, ""));
    if (!v) return setEditingGoal(false);
    await setGoal.mutateAsync({ goalMonthly: v });
    await utils.accelerator.dashboard.invalidate();
    setEditingGoal(false);
    toast.success(`Goal set to ${fmt(v)}/mo`);
  };

  if (dash.isLoading) {
    return <div className="p-4 space-y-3 max-w-[1200px] mx-auto">{[...Array(4)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-800/60" />)}</div>;
  }
  if (dash.isError || !d) {
    return <div className="p-4 max-w-[1200px] mx-auto"><div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">Couldn't load the accelerator. <button className="underline" onClick={() => dash.refetch()}>Retry</button></div></div>;
  }

  return (
    <div className="p-4 space-y-4 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-2">
        <Rocket className="w-5 h-5 text-violet-400" />
        <h1 className="text-xl font-bold text-white">Financial Accelerator</h1>
        <span className="text-sm text-zinc-500">frontend + backend revenue vs your monthly goal</span>
      </div>

      {/* Goal progress */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm text-zinc-400"><Target className="w-4 h-4" /> Monthly goal</div>
          {editingGoal ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={goalInput} onChange={(e) => setGoalInput(e.target.value)} placeholder={String(d.goalMonthly)}
                className="w-28 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-white" />
              <button onClick={saveGoal} className="p-1.5 rounded-md bg-violet-600 text-white"><Check className="w-4 h-4" /></button>
            </div>
          ) : (
            <button onClick={() => { setGoalInput(String(d.goalMonthly)); setEditingGoal(true); }} className="flex items-center gap-1 text-sm text-zinc-300 hover:text-white">
              {fmt(d.goalMonthly)} <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-3xl font-semibold text-white">{fmt(d.mrr)}</span>
          <span className="text-sm text-zinc-500">this month · {d.goalPct}% of goal</span>
        </div>
        <div className="h-3 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400" style={{ width: `${d.goalPct}%` }} />
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          Projected month-end <span className="text-zinc-300">{fmt(d.projectedMonth)}</span> at <span className="text-zinc-300">{fmt(d.dailyRunRate)}/day</span>
          {d.gapToGoal > 0 ? <> · gap to goal <span className="text-amber-300">{fmt(d.gapToGoal)}</span></> : <> · <span className="text-emerald-300">on track</span></>}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Frontend (freelance)", value: fmt(d.frontendRevenue), icon: DollarSign, color: "text-blue-400" },
          { label: "Backend (offers)", value: fmt(d.backendRevenue), icon: TrendingUp, color: "text-emerald-400" },
          { label: "Daily run rate", value: fmt(d.dailyRunRate), icon: TrendingUp, color: "text-violet-400" },
          { label: "Active offers", value: String(d.counts.offers), icon: Layers, color: "text-amber-400" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1"><k.icon className={`w-3.5 h-3.5 ${k.color}`} /> {k.label}</div>
            <div className="text-xl font-semibold text-white">{k.value}</div>
          </div>
        ))}
      </div>

      {/* AI next best action */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white"><Sparkles className="w-4 h-4 text-violet-400" /> Next best action</div>
          <button onClick={runStrategy} disabled={nba.isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm disabled:opacity-50">
            {nba.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {strategy ? "Refresh" : "Analyze funnel"}
          </button>
        </div>
        {!strategy && !nba.isPending && <p className="text-sm text-zinc-500">Click analyze — the strategist reads your live funnel and returns the 3 highest-leverage moves to close the gap to goal.</p>}
        {strategy && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300 italic">{strategy.diagnosis}</p>
            {(strategy.actions ?? []).map((a: any, i: number) => (
              <div key={i} className="flex gap-3 rounded-lg bg-zinc-900/60 border border-zinc-800 p-3">
                <div className="w-6 h-6 shrink-0 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-medium">{i + 1}</div>
                <div className="min-w-0">
                  <div className="text-sm text-white">{a.action}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{a.why} · <span className="text-zinc-400">{a.effort} effort</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Offer stack */}
      <div>
        <div className="flex items-center gap-2 mb-2"><Layers className="w-4 h-4 text-amber-400" /><h2 className="text-base font-medium text-white">Offer stack</h2></div>
        {d.offers.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">No offers yet — add products in the Brands engine to build your backend revenue stack.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {d.offers.map((o: any) => (
              <div key={o.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 flex items-center justify-between">
                <div className="min-w-0"><div className="text-sm text-white truncate">{o.name}</div><div className="text-xs text-zinc-500">{o.type || "offer"}{o.status ? ` · ${o.status}` : ""}</div></div>
                <div className="text-sm font-medium text-emerald-300">{o.price ? fmt(Number(o.price)) : "—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attribution */}
      <div>
        <div className="flex items-center gap-2 mb-2"><ArrowUpRight className="w-4 h-4 text-blue-400" /><h2 className="text-base font-medium text-white">Revenue attribution — this month</h2></div>
        {d.attributions.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">No earnings logged this month yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/80"><tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Source</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Type</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-400">Amount</th>
              </tr></thead>
              <tbody>
                {d.attributions.map((a: any) => (
                  <tr key={a.id} className="border-t border-zinc-800/70">
                    <td className="px-3 py-2 text-zinc-200">{a.source}</td>
                    <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${a.type === "product" ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-500/20 text-blue-300"}`}>{a.type === "product" ? "backend" : "frontend"}</span></td>
                    <td className="px-3 py-2 text-right font-medium text-white">{fmt(a.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
