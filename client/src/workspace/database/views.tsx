import React, { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus } from "lucide-react";
import { createRow, setRowValue } from "../db";
import type { Database, Field, Row, View } from "../types";
import { Tag, formatCurrency, formatDate } from "../ui";
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

// ── TABLE ──────────────────────────────────────────────────────────────────
export function TableView(p: ViewProps) {
  const fields = visibleFields(p.database, p.view);
  const sort = p.view.sorts[0];

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
      <table className="grid">
        <thead>
          <tr>
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
            <tr key={row.id}>
              {fields.map((f, i) => (
                <td key={f.id}>
                  {i === 0 ? (
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Cell field={f} value={row.values[f.id]} onChange={(v) => setRowValue(row.id, f.id, v)} />
                      </div>
                      <button className="row-open-btn" style={{ marginRight: 8 }} onClick={() => p.onOpenRow(row)}>
                        OPEN
                      </button>
                    </div>
                  ) : (
                    <Cell field={f} value={row.values[f.id]} onChange={(v) => setRowValue(row.id, f.id, v)} />
                  )}
                </td>
              ))}
              <td />
            </tr>
          ))}
          <tr>
            <td colSpan={fields.length + 1} style={{ borderRight: "none" }}>
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
                    onDragStart={(e) => e.dataTransfer.setData("text/rowid", row.id)}
                    onClick={() => p.onOpenRow(row)}
                  >
                    {thumb ? <img className="kcard-thumb" src={String(thumb)} alt="" /> : null}
                    <div className="kcard-title">{rowTitle(p.database, row)}</div>
                    <div className="kcard-meta">
                      {cardFields.map((f) => (
                        <ValueChip key={f.id} field={f} value={row.values[f.id]} />
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

  return (
    <div className="gallery">
      {p.rows.map((row) => {
        const thumb = thumbField ? row.values[thumbField.id] : null;
        return (
          <div key={row.id} className="gallery-card" onClick={() => p.onOpenRow(row)}>
            <div className="gallery-thumb">
              {thumb ? <img src={String(thumb)} alt="" /> : <span>{p.database.icon}</span>}
            </div>
            <div className="gallery-body">
              <div className="gallery-title">{rowTitle(p.database, row)}</div>
              <div className="kcard-meta">
                {metaFields.map((f) => (
                  <ValueChip key={f.id} field={f} value={row.values[f.id]} />
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
  );
}

// ── LIST ───────────────────────────────────────────────────────────────────
export function ListView(p: ViewProps) {
  const metaFields = visibleFields(p.database, p.view).filter((f) => f.id !== p.database.fields[0]?.id);
  return (
    <div className="list-view">
      {p.rows.map((row) => (
        <div key={row.id} className="list-row" onClick={() => p.onOpenRow(row)}>
          <GripVertical size={13} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
          <div className="list-title">{rowTitle(p.database, row)}</div>
          <div className="list-meta">
            {metaFields.map((f) => {
              if (f.type === "currency") return <span key={f.id}>{formatCurrency(row.values[f.id])}</span>;
              if (f.type === "date") return <span key={f.id}>{formatDate(row.values[f.id])}</span>;
              return <ValueChip key={f.id} field={f} value={row.values[f.id]} />;
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
