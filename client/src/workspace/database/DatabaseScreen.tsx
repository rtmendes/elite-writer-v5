import { useLiveQuery } from "dexie-react-hooks";
import {
  Download, Filter as FilterIcon, GalleryHorizontalEnd, Kanban, LayoutList,
  Plus, Search, Table2, Trash2, Upload, X,
} from "lucide-react";
import Papa from "papaparse";
import React, { useRef, useState } from "react";
import { createRow, db, deleteDatabase, makeView, uid, updateDatabase } from "../db";
import type { Database, Field, Filter, Row, View, ViewType } from "../types";
import { Menu } from "../ui";
import { FieldEditor } from "./FieldEditor";
import { applyView } from "./query";
import { RowModal } from "./RowModal";
import { GalleryView, KanbanView, ListView, TableView } from "./views";

const VIEW_ICONS: Record<ViewType, React.ReactNode> = {
  table: <Table2 size={14} />,
  kanban: <Kanban size={14} />,
  gallery: <GalleryHorizontalEnd size={14} />,
  list: <LayoutList size={14} />,
};

export function DatabaseScreen({
  dbId,
  compact = false,
  dark = false,
  onDeleted,
}: {
  dbId: string;
  compact?: boolean;
  dark?: boolean;
  onDeleted?: () => void;
}) {
  const database = useLiveQuery(() => db.databases.get(dbId), [dbId]);
  const allRows = useLiveQuery(() => db.rows.where("dbId").equals(dbId).toArray(), [dbId]) ?? [];

  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [fieldEditor, setFieldEditor] = useState<{ field?: Field; anchor: HTMLElement } | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);
  const [addViewAnchor, setAddViewAnchor] = useState<HTMLElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!database) return null;

  const view = database.views.find((v) => v.id === activeViewId) ?? database.views[0];
  if (!view) return null;

  const rows = applyView(database, allRows, view, search);
  const openRow = allRows.find((r) => r.id === openRowId) ?? null;

  const patchView = (patch: Partial<View>) =>
    updateDatabase(database.id, {
      views: database.views.map((v) => (v.id === view.id ? { ...v, ...patch } : v)),
    });

  const addFilter = (fieldId: string) => {
    const filter: Filter = { id: uid(), fieldId, op: "contains", value: "" };
    patchView({ filters: [...view.filters, filter] });
    setFilterAnchor(null);
  };

  const exportCsv = () => {
    const data = allRows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const f of database.fields) {
        const v = r.values[f.id];
        if (f.type === "select") out[f.name] = f.options?.find((o) => o.id === v)?.name ?? "";
        else if (f.type === "multiselect")
          out[f.name] = (Array.isArray(v) ? v : []).map((id) => f.options?.find((o) => o.id === id)?.name ?? "").join("; ");
        else out[f.name] = v ?? "";
      }
      return out;
    });
    const csv = Papa.unparse(data);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${database.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
  };

  const importCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const headers = result.meta.fields ?? [];
        const fields = [...database.fields];
        const byName = new Map(fields.map((f) => [f.name.toLowerCase(), f]));
        for (const h of headers) {
          if (!byName.has(h.toLowerCase())) {
            const nf: Field = { id: uid(), name: h, type: "text", width: 160 };
            fields.push(nf);
            byName.set(h.toLowerCase(), nf);
          }
        }
        await updateDatabase(database.id, { fields });
        for (const record of result.data) {
          const values: Record<string, unknown> = {};
          for (const h of headers) {
            const f = byName.get(h.toLowerCase());
            if (!f) continue;
            const raw = record[h] ?? "";
            if (f.type === "number" || f.type === "currency") values[f.id] = raw === "" ? null : Number(raw.replace(/[$,]/g, ""));
            else if (f.type === "checkbox") values[f.id] = /^(true|yes|1|x)$/i.test(raw);
            else if (f.type === "select") values[f.id] = f.options?.find((o) => o.name.toLowerCase() === raw.toLowerCase())?.id ?? null;
            else values[f.id] = raw;
          }
          await createRow(database.id, values);
        }
        alert(`Imported ${result.data.length} rows.`);
      },
    });
  };

  const removeDatabase = async () => {
    if (!confirm(`Delete database “${database.name}” and all ${allRows.length} rows?`)) return;
    await deleteDatabase(database.id);
    onDeleted?.();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: compact ? "auto" : "100%", minHeight: 0 }}>
      {!compact && (
        <div style={{ padding: "26px 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 30 }}>{database.icon}</span>
          <input
            className="page-title-input"
            style={{ fontSize: 27, margin: 0, flex: 1 }}
            value={database.name}
            onChange={(e) => updateDatabase(database.id, { name: e.target.value })}
          />
          <button className="btn ghost sm" onClick={removeDatabase} title="Delete database">
            <Trash2 size={14} />
          </button>
        </div>
      )}

      <div className="db-toolbar" style={compact ? { padding: "8px 12px" } : undefined}>
        {database.views.map((v) => (
          <button
            key={v.id}
            className={`view-tab${v.id === view.id ? " active" : ""}`}
            onClick={() => setActiveViewId(v.id)}
            onDoubleClick={() => {
              const name = prompt("Rename view", v.name);
              if (name)
                updateDatabase(database.id, {
                  views: database.views.map((x) => (x.id === v.id ? { ...x, name } : x)),
                });
            }}
          >
            {VIEW_ICONS[v.type]} {v.name}
          </button>
        ))}
        <button className="view-tab" onClick={(e) => setAddViewAnchor(e.currentTarget)} title="Add view">
          <Plus size={14} />
        </button>

        <span style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>
          <Search size={13} style={{ color: "var(--text-faint)" }} />
          <input
            style={{ border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 13, width: compact ? 90 : 140 }}
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className={`pill${view.filters.length ? " on" : ""}`} onClick={(e) => setFilterAnchor(e.currentTarget)}>
          <FilterIcon size={12} /> Filter{view.filters.length ? ` · ${view.filters.length}` : ""}
        </button>

        {!compact && (
          <>
            <button className="btn ghost sm" onClick={exportCsv} title="Export CSV"><Download size={14} /></button>
            <button className="btn ghost sm" onClick={() => fileRef.current?.click()} title="Import CSV"><Upload size={14} /></button>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
            <button className="btn primary sm" onClick={() => createRow(database.id)}><Plus size={14} /> New</button>
          </>
        )}
      </div>

      {/* Active filter editors */}
      {view.filters.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "8px 24px", borderBottom: "1px solid var(--border)" }}>
          {view.filters.map((f) => {
            const field = database.fields.find((x) => x.id === f.fieldId);
            const patchFilter = (patch: Partial<Filter>) =>
              patchView({ filters: view.filters.map((x) => (x.id === f.id ? { ...x, ...patch } : x)) });
            return (
              <span key={f.id} style={{ display: "inline-flex", gap: 4, alignItems: "center", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 6px", fontSize: 12.5 }}>
                <b>{field?.name}</b>
                <select className="input" style={{ padding: "1px 4px", fontSize: 12 }} value={f.op} onChange={(e) => patchFilter({ op: e.target.value as Filter["op"] })}>
                  <option value="contains">contains</option>
                  <option value="eq">is</option>
                  <option value="neq">is not</option>
                  <option value="empty">is empty</option>
                  <option value="notempty">is not empty</option>
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                </select>
                {f.op !== "empty" && f.op !== "notempty" && (
                  field?.type === "select" || field?.type === "multiselect" ? (
                    <select className="input" style={{ padding: "1px 4px", fontSize: 12 }} value={f.value ?? ""} onChange={(e) => patchFilter({ value: e.target.value })}>
                      <option value="">—</option>
                      {field.options?.map((o) => <option key={o.id} value={o.name.toLowerCase()}>{o.name}</option>)}
                    </select>
                  ) : (
                    <input className="input" style={{ padding: "1px 6px", fontSize: 12, width: 110 }} value={f.value ?? ""} onChange={(e) => patchFilter({ value: e.target.value })} />
                  )
                )}
                <button className="btn ghost sm" style={{ padding: 1 }} onClick={() => patchView({ filters: view.filters.filter((x) => x.id !== f.id) })}>
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {view.type === "table" && (
          <TableView database={database} rows={rows} view={view} compact={compact}
            onOpenRow={(r: Row) => setOpenRowId(r.id)} onUpdateView={patchView}
            onEditField={(field, anchor) => setFieldEditor({ field, anchor })}
            onAddField={(anchor) => setFieldEditor({ anchor })} />
        )}
        {view.type === "kanban" && (
          <KanbanView database={database} rows={rows} view={view} compact={compact}
            onOpenRow={(r: Row) => setOpenRowId(r.id)} onUpdateView={patchView}
            onEditField={(field, anchor) => setFieldEditor({ field, anchor })}
            onAddField={(anchor) => setFieldEditor({ anchor })} />
        )}
        {view.type === "gallery" && (
          <GalleryView database={database} rows={rows} view={view} compact={compact}
            onOpenRow={(r: Row) => setOpenRowId(r.id)} onUpdateView={patchView}
            onEditField={(field, anchor) => setFieldEditor({ field, anchor })}
            onAddField={(anchor) => setFieldEditor({ anchor })} />
        )}
        {view.type === "list" && (
          <ListView database={database} rows={rows} view={view} compact={compact}
            onOpenRow={(r: Row) => setOpenRowId(r.id)} onUpdateView={patchView}
            onEditField={(field, anchor) => setFieldEditor({ field, anchor })}
            onAddField={(anchor) => setFieldEditor({ anchor })} />
        )}
      </div>

      {/* Menus & modals */}
      {filterAnchor && (
        <Menu anchor={filterAnchor} onClose={() => setFilterAnchor(null)}>
          <div className="menu-label">Filter by field</div>
          {database.fields.map((f) => (
            <button key={f.id} className="menu-item" onClick={() => addFilter(f.id)}>{f.name}</button>
          ))}
        </Menu>
      )}
      {addViewAnchor && (
        <Menu anchor={addViewAnchor} onClose={() => setAddViewAnchor(null)}>
          <div className="menu-label">Add view</div>
          {(["table", "kanban", "gallery", "list"] as ViewType[]).map((t) => (
            <button
              key={t}
              className="menu-item"
              onClick={async () => {
                const v = makeView(t);
                if (t === "kanban") v.groupBy = database.fields.find((f) => f.type === "select")?.id;
                if (t === "gallery") v.thumbnailField = database.fields.find((f) => f.type === "image")?.id;
                await updateDatabase(database.id, { views: [...database.views, v] });
                setActiveViewId(v.id);
                setAddViewAnchor(null);
              }}
            >
              {VIEW_ICONS[t]} {v0(t)}
            </button>
          ))}
          {database.views.length > 1 && (
            <>
              <div className="menu-sep" />
              <button
                className="menu-item danger"
                onClick={async () => {
                  await updateDatabase(database.id, { views: database.views.filter((v) => v.id !== view.id) });
                  setActiveViewId(null);
                  setAddViewAnchor(null);
                }}
              >
                <Trash2 size={13} /> Delete current view
              </button>
            </>
          )}
        </Menu>
      )}
      {fieldEditor && (
        <FieldEditor database={database} field={fieldEditor.field} anchor={fieldEditor.anchor} onClose={() => setFieldEditor(null)} />
      )}
      {openRow && <RowModal database={database} row={openRow} dark={dark} onClose={() => setOpenRowId(null)} />}
    </div>
  );
}

function v0(t: ViewType): string {
  return { table: "Table", kanban: "Board", gallery: "Gallery", list: "List" }[t];
}
