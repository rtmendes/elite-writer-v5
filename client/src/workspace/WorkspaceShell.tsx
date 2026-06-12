// ── Workspace module shell ─────────────────────────────────────────────────
// Mounted at /workspace inside the v5 AppLayout. Internal navigation uses
// location.hash (#/page/:id, #/db/:id) so it never collides with wouter.
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronDown, ChevronRight, Cloud, CloudOff, Download, FileDown, Home, Plus, RefreshCw, Settings, Upload,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { DEFAULT_ROUTES, MODEL_CHOICES, getBudget, getRoutes, monthSpend, setBudget, setRouteModel, type AgentTask } from "./agent";
import { createDatabase, createPage, db, exportWorkspace, importWorkspace } from "./db";
import { DatabaseScreen } from "./database/DatabaseScreen";
import { Dashboard } from "./screens/Dashboard";
import { PageScreen } from "./screens/PageScreen";
import { seedIfEmpty } from "./seed";
import { ensureIntelligence } from "./intel";
import { enqueueEverything, getSyncStatus, onSyncStatus, pullAll, startSync, type SyncStatus } from "./sync";
import type { Page } from "./types";
import { Modal } from "./ui";
import "./workspace.css";

// ── dark mode bridge (v5 toggles a .dark class on <html>) ──────────────────
function useDarkClass(): boolean {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark")),
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function SyncPill({ status, onClick }: { status: SyncStatus; onClick: () => void }) {
  const map: Record<SyncStatus, { icon: React.ReactNode; label: string }> = {
    synced: { icon: <Cloud size={13} />, label: "Synced" },
    syncing: { icon: <RefreshCw size={13} className="spin" />, label: "Syncing…" },
    offline: { icon: <CloudOff size={13} />, label: "Offline — will retry" },
    disabled: { icon: <CloudOff size={13} />, label: "Sync off" },
  };
  const m = map[status];
  return (
    <button className={`pill${status === "synced" ? " on" : ""}`} onClick={onClick} title="Workspace settings">
      {m.icon} {m.label}
    </button>
  );
}

// ── internal page tree ──────────────────────────────────────────────────────
function PageNode({ page, allPages, currentHash, navigate, depth }: {
  page: Page; allPages: Page[]; currentHash: string; navigate: (h: string) => void; depth: number;
}) {
  const children = allPages.filter((p) => p.parentId === page.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const [open, setOpen] = useState(depth === 0);
  const active = currentHash === `#/page/${page.id}`;
  return (
    <>
      <div className={`nav-item${active ? " active" : ""}`} onClick={() => navigate(`#/page/${page.id}`)}>
        <span
          className="nav-icon"
          onClick={(e) => {
            if (children.length > 0) {
              e.stopPropagation();
              setOpen(!open);
            }
          }}
          style={{ cursor: children.length ? "pointer" : undefined }}
        >
          {children.length > 0 ? (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : page.icon}
        </span>
        <span className="nav-label">{page.title || "Untitled"}</span>
        <button
          className="nav-action"
          title="Add subpage"
          onClick={async (e) => {
            e.stopPropagation();
            const p = await createPage(page.id);
            setOpen(true);
            navigate(`#/page/${p.id}`);
          }}
        >
          <Plus size={13} />
        </button>
      </div>
      {open && children.length > 0 && (
        <div className="nav-children">
          {children.map((c) => (
            <PageNode key={c.id} page={c} allPages={allPages} currentHash={currentHash} navigate={navigate} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

// ── slim settings: agent budget/routes + backup ─────────────────────────────
function WsSettings({ onClose }: { onClose: () => void }) {
  const [budget, setBudgetState] = useState(getBudget());
  const [routes, setRoutes] = useState(getRoutes());
  const [spent, setSpent] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    monthSpend().then(setSpent);
  }, []);
  const pct = spent !== null && budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

  const doExport = async () => {
    const json = await exportWorkspace();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = `workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (!confirm("Importing replaces everything currently in the workspace (and pushes it to the server). Continue?")) return;
      try {
        await importWorkspace(String(reader.result));
        await enqueueEverything();
        alert("Workspace restored and queued for sync.");
        onClose();
      } catch (e) {
        alert(`Import failed: ${e instanceof Error ? e.message : e}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Modal title="Workspace settings" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <section>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Agent — task router & budget</div>
          <div style={{ fontSize: 12.5, color: "var(--text-soft)", marginBottom: 10 }}>
            AI runs server-side with your env keys. Calls are metered into the AI Ledger database and the central cost
            system; the agent stops spending at the monthly budget.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 13 }}>Monthly budget $</span>
            <input
              className="input"
              type="number"
              style={{ width: 90 }}
              value={budget}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setBudgetState(v);
                setBudget(v);
              }}
            />
            <div style={{ flex: 1, height: 8, borderRadius: 99, background: "var(--bg-active)", overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: pct > 85 ? "var(--tag-red-fg)" : "var(--accent)" }} />
            </div>
            <span style={{ fontSize: 12.5, color: "var(--text-soft)", minWidth: 110, textAlign: "right" }}>
              {spent === null ? "…" : `$${spent.toFixed(2)} spent this month`}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
            {(Object.keys(DEFAULT_ROUTES) as AgentTask[]).map((task) => (
              <label key={task} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <span style={{ flex: 1, color: "var(--text-soft)" }}>{DEFAULT_ROUTES[task].label}</span>
                <select
                  className="input"
                  style={{ padding: "2px 6px", fontSize: 12 }}
                  value={routes[task].model}
                  onChange={(e) => {
                    setRouteModel(task, e.target.value);
                    setRoutes(getRoutes());
                  }}
                >
                  {MODEL_CHOICES.map((m) => (
                    <option key={m} value={m}>{m.replace(/^.*\//, "")}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>

        <section>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Backup</div>
          <div style={{ fontSize: 12.5, color: "var(--text-soft)", marginBottom: 8 }}>
            The server database is the primary store; JSON snapshots are belt-and-suspenders.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={doExport}><Download size={14} /> Export workspace</button>
            <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={14} /> Restore from backup</button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) doImport(f);
                e.target.value = "";
              }}
            />
          </div>
        </section>
      </div>
    </Modal>
  );
}

// ── the /workspace page ─────────────────────────────────────────────────────
type WsRoute = { type: "home" } | { type: "page"; id: string } | { type: "db"; id: string };

function parseHash(hash: string): WsRoute {
  const m = hash.match(/^#\/(page|db)\/(.+)$/);
  if (m) return { type: m[1] as "page" | "db", id: m[2] };
  return { type: "home" };
}

export default function WorkspaceShell() {
  const dark = useDarkClass();
  const [hash, setHash] = useState(window.location.hash);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());

  const pages = useLiveQuery(() => db.pages.toArray(), []) ?? [];
  const databases = useLiveQuery(() => db.databases.toArray(), []) ?? [];
  const roots = pages.filter((p) => p.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    (async () => {
      // Render from local cache immediately; never block boot on the network.
      await seedIfEmpty();
      await ensureIntelligence();
      setReady(true);
      // Reconcile with MySQL in the background.
      void pullAll();
      startSync();
    })();
    const off = onSyncStatus(setSyncStatus);
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => {
      off();
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  const navigate = (h: string) => {
    window.location.hash = h;
  };

  if (!ready) return null;
  const route = parseHash(hash);

  return (
    <div className="ws-root" style={{ height: "calc(100vh - 0px)", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="app-shell" style={{ flex: 1 }}>
        <div className="sidebar" style={{ width: 240 }}>
          <div className="sidebar-section" style={{ paddingTop: 10 }}>
            <button className={`nav-item${route.type === "home" ? " active" : ""}`} onClick={() => navigate("#/")}>
              <span className="nav-icon"><Home size={14} /></span>
              <span className="nav-label">Workspace home</span>
            </button>
          </div>
          <div className="sidebar-section" style={{ flex: 1, overflowY: "auto" }}>
            <div className="sidebar-section-label">
              Pages
              <button
                className="btn ghost sm"
                style={{ padding: 2 }}
                title="New page"
                onClick={async () => {
                  const p = await createPage(null);
                  navigate(`#/page/${p.id}`);
                }}
              >
                <Plus size={13} />
              </button>
            </div>
            {roots.map((p) => (
              <PageNode key={p.id} page={p} allPages={pages} currentHash={hash} navigate={navigate} depth={0} />
            ))}
            <button
              className="nav-item"
              style={{ color: "var(--text-faint)" }}
              title="Transfer a Google Doc into the workspace as a page"
              onClick={async () => {
                const url = prompt("Paste the Google Doc URL (your Google account must be connected in Settings):");
                if (!url?.trim()) return;
                try {
                  const { wsTrpc } = await import("./trpcClient");
                  const res = await wsTrpc.workspace.importGoogleDoc.mutate({ docUrlOrId: url.trim() });
                  await pullAll();
                  navigate(`#/page/${res.pageId}`);
                } catch (e) {
                  alert(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              <span className="nav-icon"><FileDown size={14} /></span>
              <span className="nav-label">Import Google Doc…</span>
            </button>
            <div className="sidebar-section-label" style={{ marginTop: 14 }}>
              Databases
              <button
                className="btn ghost sm"
                style={{ padding: 2 }}
                title="New database"
                onClick={async () => {
                  const d = await createDatabase();
                  navigate(`#/db/${d.id}`);
                }}
              >
                <Plus size={13} />
              </button>
            </div>
            {databases.map((d) => (
              <button
                key={d.id}
                className={`nav-item${hash === `#/db/${d.id}` ? " active" : ""}`}
                onClick={() => navigate(`#/db/${d.id}`)}
              >
                <span className="nav-icon">{d.icon}</span>
                <span className="nav-label">{d.name}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-section" style={{ borderTop: "1px solid var(--border)", padding: 8 }}>
            <button className="nav-item" onClick={() => setSettingsOpen(true)}>
              <span className="nav-icon"><Settings size={14} /></span>
              <span className="nav-label">Agent & backup</span>
            </button>
            <div style={{ padding: "6px 8px" }}>
              <SyncPill status={syncStatus} onClick={() => setSettingsOpen(true)} />
            </div>
          </div>
        </div>

        <div className="main-area">
          {route.type === "home" && <Dashboard navigate={navigate} />}
          {route.type === "page" && <PageScreen key={route.id} pageId={route.id} dark={dark} onDeleted={() => navigate("#/")} />}
          {route.type === "db" && <DatabaseScreen key={route.id} dbId={route.id} dark={dark} onDeleted={() => navigate("#/")} />}
        </div>
      </div>
      {settingsOpen && <WsSettings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
