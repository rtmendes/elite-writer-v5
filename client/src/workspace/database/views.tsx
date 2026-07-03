import React, { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, X } from "lucide-react";
import { SelectCheck, useSelection } from "@/components/list-selection";
import { createRow, deleteRow, setRowValue } from "../db";
import type { Database, Field, Row, View } from "../types";
import { Menu, Tag, formatCurrency, formatDate } from "../ui";
import { Cell, ValueChip } from "./cells";
import { rowTitle, visibleFields } from "./query";

interface ViewProps {
  database: Database;
  rows: Row[];
  view: View;
  onOpenRow: (row: Row) => void;
  onUpdateView: (patch: Partial<View>) => void;
  onEditField: (field: Field, anchor: HTMLElement) => void;
  onAddField: (anchor: HTMLElement) => void;
  compact?: boolean;
}

// ── Database bulk bar (uses shared useSelection + SelectCheck) ─────────────
function SelectionBar({ database, selected, clear }: { database: Database; selected: Set<string>; clear: () => void }) {
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const statusField = database.fields.find((f) => f.type === "select" && f.name.toLowerCase() === "status");
  if (selected.size === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--accent-soft)", borderRadius: 8, margin: "0 0 8px", fontSize: 13 }}>
      <b style={{ fontWeight: 600 }}>{selected.size} selected</b>
      {statusField && (
        <button className="btn sm" onClick={(e) => setStatusAnchor(e.currentTarget)}>Set status…</button>
      )}
      <button
        className="btn sm"
        onClick={async () => {
          if (!confirm(`Delete ${selected.size} row${selected.size === 1 ? "" : "s"}?`)) return;
          for (const id of selected) await deleteRow(id);
          clear();
        }}
      >
        <Trash2 size={13} /> Delete
      </button>
      <button className="btn ghost sm" style={{ marginLeft: "auto" }} onClick={clear}>
        <X size={13} /> Clear
      </button>
      {statusAnchor && statusField && (
        <Menu anchor={statusAnchor} onClose={() => setStatusAnchor(null)}>
          {(statusField.options ?? []).map((o) => (
            <button key={o.id} className="menu-item" onClick={async () => {
              for (const id of selected) await setRowValue(id, statusField.id, o.id);
              setStatusAnchor(null);
              clear();
            }}>
              <Tag color={o.color}>{o.name}</Tag>
            </button>
          ))}
        </Menu>
      )}
    </div>
  );
}

// ── TABLE ──────────────────────────────────────────────────────────────────
export function TableView(p: ViewProps) {
  const fields = visibleFields(p.database, p.view);
  const sort = p.view.sorts[0];
  const { selected, toggle, allSelected, toggleAll, clear } = useSelection(p.rows);

  const toggleSort = (fieldId: string) => {
    const next: View["sorts"] =
      sort?.fieldId !== fieldId
        ? [{ fieldId, dir: "asc" }]
        : sort.dir === "asc"
          ? [{ fieldId, dir: "desc" }]
          : [];
    p.onUpdateView({ sorts: next });
  };

  return (
    <div className="grid-wrap">
      <SelectionBar database={p.database} selected={selected} clear={clear} />
      <table className="grid">
        <thead>
          <tr>
            <th style={{ width: 34 }}>
              <div className="th-inner" style={{ minWidth: 0, justifyContent: "center" }}>
                <input
                  type="checkbox"
                  className="checkbox-dot"
                  checked={allSelected}
                  onChange={toggleAll}
                  title="Select all"
                />
              </div>
            </th>
            {fields.map((f) => (
              <th key={f.id} style={{ minWidth: f.width ?? 150, maxWidth: 420 }}>
                <div
                  className="th-inner"
                  style={{ minWidth: f.width ?? 150 }}
                  onClick={(e) => toggleSort(f.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    p.onEditField(f, e.currentTarget as HTMLElement);
                  }}
                  title="Click to sort · right-click to edit field"
                >
                  {f.name}
                  {sort?.fieldId === f.id &&
                    (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                </div>
              </th>
            ))}
            <th style={{ width: 40 }}>
              <div className="th-inner" onClick={(e) => p.onAddField(e.currentTarget as HTMLElement)} title="Add field">
                <Plus size={14} />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {p.rows.map((row) => (
            <tr key={row.id} style={selected.has(row.id) ? { background: "var(--accent-soft)" } : undefined}>
              <td style={{ textAlign: "center" }}>
                <input type="checkbox" className="checkbox-dot" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
              </td>
              {fields.map((f, i) => (
                <td key={f.id}>
                  {i === 0 ? (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Cell field={f} value={row.values[f.id]} onChange={(v) => setRowValue(row.id, f.id, v)} row={row} database={p.database} />
                      </div>
                      <button className="row-open-btn" style={{ marginRight: 8 }} onClick={() => p.onOpenRow(row)}>
                        OPEN
                      </button>
                    </div>
                  ) : (
                    <Cell field={f} value={row.values[f.id]} onChange={(v) => setRowValue(row.id, f.id, v)} row={row} database={p.database} />
                  )}
                </td>
              ))}
              <td />
            </tr>
          ))}
          <tr>
            <td colSpan={fields.length + 2} style={{ borderRight: "none" }}>
              <button
                className="nav-item"
                style={{ color: "var(--text-faint)" }}
                onClick={() => createRow(p.database.id)}
              >
                <Plus size={14} /> New row
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── KANBAN ─────────────────────────────────────────────────────────────────
export function KanbanView(p: ViewProps) {
  const groupField = p.database.fields.find((f) => f.id === p.view.groupBy && f.type === "select");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const { selected, toggle, clear } = useSelection(p.rows);

  if (!groupField) {
    const selects = p.database.fields.filter((f) => f.type === "select");
    return (
      <div className="empty">
        <div>Board view needs a Select field to group by.</div>
        <div style={{ display: "flex", gap: 6 }}>
          {selects.map((f) => (
            <button key={f.id} className="btn sm" onClick={() => p.onUpdateView({ groupBy: f.id })}>
              Group by {f.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const columns = [...(groupField.options ?? []), { id: "__none__", name: "No status", color: "gray" }];
  const cardFields = visibleFields(p.database, p.view).filter((f) => f.id !== p.database.fields[0]?.id && f.id !== groupField.id).slice(0, 4);
  const thumbField = p.database.fields.find((f) => f.type === "image");

  return (
    <div>
      <SelectionBar database={p.database} selected={selected} clear={clear} />
      <div className="kanban">
        {columns.map((col) => {
          const colRows = p.rows.filter((r) =>
            col.id === "__none__" ? !r.values[groupField.id] : r.values[groupField.id] === col.id,
          );
          if (col.id === "__none__" && colRows.length === 0) return null;
          return (
            <div className="kanban-col" key={col.id}>
              <div className="kanban-col-head">
                <Tag color={col.color}>{col.name}</Tag>
                <span className="kanban-count">{colRows.length}</span>
                <button
                  className="btn ghost sm"
                  style={{ marginLeft: "auto" }}
                  onClick={() =>
                    createRow(p.database.id, col.id === "__none__" ? {} : { [groupField.id]: col.id })
                  }
                >
                  <Plus size={13} />
                </button>
              </div>
              <div
                className={`kanban-cards${dragOver === col.id ? " drag-over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col.id);
                }}
                onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const rowId = e.dataTransfer.getData("text/rowid");
                  if (rowId) setRowValue(rowId, groupField.id, col.id === "__none__" ? null : col.id);
                }}
              >
                {colRows.map((row) => {
                  const thumb = thumbField ? row.values[thumbField.id] : null;
                  return (
                    <div
                      key={row.id}
                      className="kcard"
                      draggable
                      style={selected.has(row.id) ? { outline: "2px solid var(--accent-primary, #6366f1)", outlineOffset: -2 } : undefined}
                      onDragStart={(e) => e.dataTransfer.setData("text/rowid", row.id)}
                      onClick={() => p.onOpenRow(row)}
                    >
                      {thumb ? <img className="kcard-thumb" src={String(thumb)} alt="" /> : null}
                      <div className="kcard-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <SelectCheck checked={selected.has(row.id)} onToggle={() => toggle(row.id)} />
                        <span style={{ flex: 1, minWidth: 0 }}>{rowTitle(p.database, row)}</span>
                      </div>
                      <div className="kcard-meta">
                        {cardFields.map((f) => (
                          <ValueChip key={f.id} field={f} value={row.values[f.id]} row={row} database={p.database} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── GALLERY ────────────────────────────────────────────────────────────────
export function GalleryView(p: ViewProps) {
  const thumbField =
    p.database.fields.find((f) => f.id === p.view.thumbnailField) ??
    p.database.fields.find((f) => f.type === "image");
  const metaFields = visibleFields(p.database, p.view)
    .filter((f) => f.id !== p.database.fields[0]?.id && f.id !== thumbField?.id)
    .slice(0, 3);
  const { selected, toggle, clear } = useSelection(p.rows);

  return (
    <div>
      <SelectionBar database={p.database} selected={selected} clear={clear} />
      <div className="gallery">
        {p.rows.map((row) => {
          const thumb = thumbField ? row.values[thumbField.id] : null;
          return (
            <div
              key={row.id}
              className="gallery-card"
              style={selected.has(row.id) ? { outline: "2px solid var(--accent-primary, #6366f1)", outlineOffset: -2 } : undefined}
              onClick={() => p.onOpenRow(row)}
            >
              <div className="gallery-thumb">
                {thumb ? <img src={String(thumb)} alt="" /> : <span>{p.database.icon}</span>}
              </div>
              <div className="gallery-body">
                <div className="gallery-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <SelectCheck checked={selected.has(row.id)} onToggle={() => toggle(row.id)} />
                  <span style={{ flex: 1, minWidth: 0 }}>{rowTitle(p.database, row)}</span>
                </div>
                <div className="kcard-meta">
                  {metaFields.map((f) => (
                    <ValueChip key={f.id} field={f} value={row.values[f.id]} row={row} database={p.database} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        <div
          className="gallery-card"
          style={{ alignItems: "center", justifyContent: "center", minHeight: 160, color: "var(--text-faint)" }}
          onClick={() => createRow(p.database.id)}
        >
          <Plus size={22} />
          <div style={{ fontSize: 13, paddingBottom: 14 }}>New</div>
        </div>
      </div>
    </div>
  );
}

// ── LIST ───────────────────────────────────────────────────────────────────
export function ListView(p: ViewProps) {
  const metaFields = visibleFields(p.database, p.view).filter((f) => f.id !== p.database.fields[0]?.id);
  const { selected, toggle, clear } = useSelection(p.rows);
  return (
    <div className="list-view">
      <SelectionBar database={p.database} selected={selected} clear={clear} />
      {p.rows.map((row) => (
        <div
          key={row.id}
          className="list-row"
          style={selected.has(row.id) ? { background: "var(--accent-soft)" } : undefined}
          onClick={() => p.onOpenRow(row)}
        >
          <SelectCheck checked={selected.has(row.id)} onToggle={() => toggle(row.id)} />
          <GripVertical size={13} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
          <div className="list-title">{rowTitle(p.database, row)}</div>
          <div className="list-meta">
            {metaFields.map((f) => {
              if (f.type === "currency") return <span key={f.id}>{formatCurrency(row.values[f.id])}</span>;
              if (f.type === "date") return <span key={f.id}>{formatDate(row.values[f.id])}</span>;
              return <ValueChip key={f.id} field={f} value={row.values[f.id]} row={row} database={p.database} />;
            })}
          </div>
        </div>
      ))}
      <button className="nav-item" style={{ color: "var(--text-faint)", marginTop: 6 }} onClick={() => createRow(p.database.id)}>
        <Plus size={14} /> New row
      </button>
    </div>
  );
}
