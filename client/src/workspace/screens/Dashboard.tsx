import { useLiveQuery } from "dexie-react-hooks";
import { FilePlus2, DatabaseZap } from "lucide-react";
import React from "react";
import { createDatabase, createPage, db } from "../db";
import { formatCurrency } from "../ui";

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
        <h1>Your media engine</h1>
        <div className="dash-sub">{today} — pick up where the story left off.</div>

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
