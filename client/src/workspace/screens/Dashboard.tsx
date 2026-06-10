import { useLiveQuery } from "dexie-react-hooks";
import { FilePlus2, DatabaseZap } from "lucide-react";
import React from "react";
import { createDatabase, createPage, db } from "../db";
import { computeRevenue, getRevenueGoal, setRevenueGoal } from "../finance";
import { formatCurrency } from "../ui";
import { useState } from "react";

function RevenueTracker({ navigate }: { navigate: (hash: string) => void }) {
  const databases = useLiveQuery(() => db.databases.toArray(), []) ?? [];
  const rows = useLiveQuery(() => db.rows.toArray(), []) ?? [];
  const [goal, setGoalState] = useState(getRevenueGoal());
  const r = computeRevenue(databases, rows, goal);
  if (!r) return null;
  const month = new Date().toLocaleDateString("en-US", { month: "long" });
  return (
    <>
      <div className="dash-section-title">Revenue — {month} goal</div>
      <div style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow)", padding: "16px 18px", marginBottom: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-soft)" }}>Monthly goal $</span>
          <input className="input" type="number" style={{ width: 110 }} value={goal}
            onChange={(e) => { const v = Number(e.target.value) || 0; setGoalState(v); setRevenueGoal(v); }} />
          <div style={{ flex: 1, minWidth: 160, height: 12, borderRadius: 99, background: "var(--bg-active)", overflow: "hidden", position: "relative" }}>
            <div style={{ width: `${r.pct}%`, height: "100%", background: "var(--accent)" }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 90, textAlign: "right" }}>{Math.round(r.pct)}% of goal</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <div><div className="stat-value" style={{ fontSize: 22, color: "var(--tag-green-fg)" }}>{formatCurrency(r.earned) || "$0"}</div><div className="stat-label">Earned (published)</div></div>
          <div><div className="stat-value" style={{ fontSize: 22 }}>{formatCurrency(r.inflight) || "$0"}</div><div className="stat-label">In flight ({r.liveCount} live)</div></div>
          <div><div className="stat-value" style={{ fontSize: 22 }}>{formatCurrency(r.projected) || "$0"}</div><div className="stat-label">Total projected</div></div>
          <div><div className="stat-value" style={{ fontSize: 22, color: r.earned >= r.goal ? "var(--tag-green-fg)" : "var(--text)" }}>{formatCurrency(Math.max(0, r.goal - r.earned)) || "$0"}</div><div className="stat-label">Gap to goal</div></div>
        </div>
        {r.needToHitGoal > 0 && r.avgFee > 0 && (
          <div style={{ fontSize: 12.5, color: "var(--text-soft)", marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
            To close the gap: <b style={{ color: "var(--text)" }}>~{r.needToHitGoal} more article{r.needToHitGoal === 1 ? "" : "s"}</b> at your average fee of {formatCurrency(r.avgFee)}.
            <span style={{ cursor: "pointer", color: "var(--accent)", marginLeft: 8 }} onClick={() => { const p = databases.find((d) => d.name === "Article Pipeline"); if (p) navigate(`#/db/${p.id}`); }}>open pipeline →</span>
          </div>
        )}
      </div>
    </>
  );
}

function AgentActivity({ navigate }: { navigate: (hash: string) => void }) {
  const databases = useLiveQuery(() => db.databases.toArray(), []) ?? [];
  const ledger = databases.find((d) => d.name === "AI Ledger");
  const rows = useLiveQuery(
    async () => (ledger ? await db.rows.where("dbId").equals(ledger.id).toArray() : []),
    [ledger?.id],
  ) ?? [];
  if (!ledger || rows.length === 0) return null;
  const f = (name: string) => ledger.fields.find((x) => x.name === name)?.id ?? "";
  const recent = [...rows].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const totalToday = rows
    .filter((r) => r.createdAt > Date.now() - 864e5)
    .reduce((sum, r) => sum + (Number(r.values[f("Cost")]) || 0), 0);
  return (
    <>
      <div className="dash-section-title">
        Agent activity — ${totalToday.toFixed(2)} spent today ·{" "}
        <span style={{ cursor: "pointer", color: "var(--accent)", textTransform: "none", letterSpacing: 0 }} onClick={() => navigate(`#/db/${ledger.id}`)}>
          open full ledger
        </span>
      </div>
      <div style={{ background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "var(--shadow)", overflow: "hidden" }}>
        {recent.map((r) => (
          <div key={r.id} className="list-row" style={{ cursor: "default" }}>
            <div className="list-title" style={{ fontWeight: 500 }}>{String(r.values[f("Entry")] ?? "")}</div>
            <div className="list-meta">
              <span>{String(r.values[f("Model")] ?? "")}</span>
              <span>${(Number(r.values[f("Cost")]) || 0).toFixed(3)}</span>
              <span>{new Date(r.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function Dashboard({ navigate }: { navigate: (hash: string) => void }) {
  const pages = useLiveQuery(() => db.pages.toArray(), []) ?? [];
  const databases = useLiveQuery(() => db.databases.toArray(), []) ?? [];
  const rows = useLiveQuery(() => db.rows.toArray(), []) ?? [];

  // Pipeline economics: sum every currency field across databases
  let pipelineValue = 0;
  let published = 0;
  for (const database of databases) {
    const currencyFields = database.fields.filter((f) => f.type === "currency");
    const statusField = database.fields.find((f) => f.name.toLowerCase() === "status" && f.type === "select");
    const publishedOption = statusField?.options?.find((o) => /publish/i.test(o.name));
    for (const row of rows.filter((r) => r.dbId === database.id)) {
      for (const f of currencyFields) pipelineValue += Number(row.values[f.id]) || 0;
      if (publishedOption && row.values[statusField!.id] === publishedOption.id) published++;
    }
  }

  const recentPages = [...pages].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="content-scroll">
      <div className="dash">
        <div className="ws-hero">
          <img
            src="/images/workspace-hero.png"
            alt=""
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
          <div className="ws-hero-text">
            <h1>Your media engine</h1>
            <div className="dash-sub" style={{ marginBottom: 0 }}>{today} — pick up where the story left off.</div>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{rows.length.toLocaleString()}</div>
            <div className="stat-label">Rows across {databases.length} database{databases.length === 1 ? "" : "s"} — no limits</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatCurrency(pipelineValue) || "$0"}</div>
            <div className="stat-label">Total pipeline value</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{published}</div>
            <div className="stat-label">Published articles</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{pages.length}</div>
            <div className="stat-label">Workspace pages</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn primary"
            onClick={async () => {
              const p = await createPage(null);
              navigate(`#/page/${p.id}`);
            }}
          >
            <FilePlus2 size={15} /> New page
          </button>
          <button
            className="btn"
            onClick={async () => {
              const d = await createDatabase();
              navigate(`#/db/${d.id}`);
            }}
          >
            <DatabaseZap size={15} /> New database
          </button>
        </div>

        <RevenueTracker navigate={navigate} />
        <AgentActivity navigate={navigate} />

        <div className="dash-section-title">Jump back in</div>
        <div className="recent-grid">
          {recentPages.map((p) => (
            <div key={p.id} className="recent-card" onClick={() => navigate(`#/page/${p.id}`)}>
              <div className="recent-icon">{p.icon}</div>
              <div className="recent-title">{p.title || "Untitled"}</div>
              <div className="recent-sub">
                edited {new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
          ))}
          {databases.map((d) => (
            <div key={d.id} className="recent-card" onClick={() => navigate(`#/db/${d.id}`)}>
              <div className="recent-icon">{d.icon}</div>
              <div className="recent-title">{d.name}</div>
              <div className="recent-sub">{rows.filter((r) => r.dbId === d.id).length} rows</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
