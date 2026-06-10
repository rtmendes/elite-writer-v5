import { useLiveQuery } from "dexie-react-hooks";
import React, { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, ImagePlus, Link2, Search, X } from "lucide-react";
import { db } from "../db";
import type { Database, Field, Row } from "../types";
import { Menu, Stars, Tag, formatCurrency, formatDate } from "../ui";

function rowTitleOf(database: Database | undefined, row: Row | undefined): string {
  if (!database || !row) return "";
  const v = row.values[database.fields[0]?.id];
  return v ? String(v) : "Untitled";
}

/** Renders linked record titles for a relation field. */
function RelationChip({ field, value }: { field: Field; value: unknown }) {
  const ids = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
  const target = useLiveQuery(() => (field.relationDbId ? db.databases.get(field.relationDbId) : undefined), [field.relationDbId]);
  const rows = useLiveQuery(
    async () => (field.relationDbId ? await db.rows.where("dbId").equals(field.relationDbId).toArray() : []),
    [field.relationDbId],
  ) ?? [];
  if (ids.length === 0) return null;
  return (
    <>
      {ids.map((id) => {
        const row = rows.find((r) => r.id === id);
        return (
          <Tag key={id} color="blue">
            <Link2 size={10} style={{ marginRight: 2, verticalAlign: -1 }} />
            {rowTitleOf(target, row) || "—"}
          </Tag>
        );
      })}
    </>
  );
}

/** Resolves a lookup field: reads a field on the first linked record. */
function LookupChip({ field, row, database }: { field: Field; row?: Row; database?: Database }) {
  const relField = database?.fields.find((f) => f.id === field.lookupRelationId);
  const linkedIds = relField && row ? (Array.isArray(row.values[relField.id]) ? (row.values[relField.id] as string[]) : []) : [];
  const targetDb = useLiveQuery(() => (relField?.relationDbId ? db.databases.get(relField.relationDbId) : undefined), [relField?.relationDbId]);
  const linkedRow = useLiveQuery(
    async () => (linkedIds[0] ? await db.rows.get(linkedIds[0]) : undefined),
    [linkedIds[0]],
  );
  if (!relField || !targetDb || !linkedRow) return null;
  const lf = targetDb.fields.find((f) => f.id === field.lookupFieldId);
  if (!lf) return null;
  return <ValueChip field={lf} value={linkedRow.values[lf.id]} />;
}

/** Read-only presentation of a value (used by board/gallery/list cards too). */
export function ValueChip({ field, value, row, database }: { field: Field; value: unknown; row?: Row; database?: Database }) {
  switch (field.type) {
    case "relation":
      return <RelationChip field={field} value={value} />;
    case "lookup":
      return <LookupChip field={field} row={row} database={database} />;
    case "select": {
      const o = field.options?.find((o) => o.id === value);
      return o ? <Tag color={o.color}>{o.name}</Tag> : null;
    }
    case "multiselect": {
      const ids = Array.isArray(value) ? value : [];
      return (
        <>
          {ids.map((id) => {
            const o = field.options?.find((o) => o.id === id);
            return o ? <Tag key={id} color={o.color}>{o.name}</Tag> : null;
          })}
        </>
      );
    }
    case "checkbox":
      return value ? <Check size={14} style={{ color: "var(--accent)" }} /> : null;
    case "currency":
      return <span>{formatCurrency(value)}</span>;
    case "date":
      return <span>{formatDate(value)}</span>;
    case "rating":
      return Number(value) > 0 ? <Stars value={Number(value) || 0} /> : null;
    case "url":
      return value ? (
        <a href={String(value)} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 3 }} onClick={(e) => e.stopPropagation()}>
          {String(value).replace(/^https?:\/\/(www\.)?/, "").slice(0, 28)} <ExternalLink size={11} />
        </a>
      ) : null;
    case "image":
      return value ? <img src={String(value)} alt="" style={{ width: 36, height: 26, objectFit: "cover", borderRadius: 4 }} /> : null;
    default:
      return value !== undefined && value !== null && value !== "" ? <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{String(value)}</span> : null;
  }
}

/** Searchable picker for relation (linked-record) fields. */
function RelationPicker({ field, value, anchor, onChange, onClose }: {
  field: Field; value: unknown; anchor: HTMLElement; onChange: (v: unknown) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const target = useLiveQuery(() => (field.relationDbId ? db.databases.get(field.relationDbId) : undefined), [field.relationDbId]);
  const rows = useLiveQuery(
    async () => (field.relationDbId ? await db.rows.where("dbId").equals(field.relationDbId).toArray() : []),
    [field.relationDbId],
  ) ?? [];
  const ids = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
  const titleId = target?.fields[0]?.id;
  const filtered = rows
    .filter((r) => !q || String(r.values[titleId ?? ""] ?? "").toLowerCase().includes(q.toLowerCase()))
    .slice(0, 40);
  return (
    <Menu anchor={anchor} onClose={onClose} width={260}>
      <div style={{ padding: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, border: "1px solid var(--border)", borderRadius: 6, padding: "3px 7px", marginBottom: 4 }}>
          <Search size={12} style={{ color: "var(--text-faint)" }} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${target?.name ?? "records"}…`}
            style={{ border: "none", outline: "none", background: "transparent", color: "var(--text)", fontSize: 13, width: "100%" }} />
        </div>
        {filtered.map((r) => {
          const selected = ids.includes(r.id);
          return (
            <button key={r.id} className="menu-item" onClick={() => {
              onChange(selected ? ids.filter((i) => i !== r.id) : [...ids, r.id]);
            }}>
              <Link2 size={12} style={{ color: "var(--text-faint)" }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{String(r.values[titleId ?? ""] ?? "Untitled")}</span>
              {selected && <Check size={13} />}
            </button>
          );
        })}
        {filtered.length === 0 && <div className="menu-label">No matching records</div>}
      </div>
    </Menu>
  );
}

/** Editable table cell. */
export function Cell({
  field,
  value,
  onChange,
  row,
  database,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  row?: Row;
  database?: Database;
}) {
  const [editing, setEditing] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // lookup = read-only computed value
  if (field.type === "lookup") {
    return <div className="cell"><LookupChip field={field} row={row} database={database} /></div>;
  }

  // relation = searchable linked-record picker
  if (field.type === "relation") {
    return (
      <>
        <div className="cell editable" onClick={(e) => setAnchor(e.currentTarget)}>
          <RelationChip field={field} value={value} />
        </div>
        {anchor && (
          <RelationPicker field={field} value={value} anchor={anchor} onChange={onChange} onClose={() => setAnchor(null)} />
        )}
      </>
    );
  }

  // checkbox + rating edit inline without popover
  if (field.type === "checkbox") {
    return (
      <div className="cell">
        <input
          type="checkbox"
          className="checkbox-dot"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    );
  }
  if (field.type === "rating") {
    return (
      <div className="cell">
        <Stars value={Number(value) || 0} onChange={(v) => onChange(v)} />
      </div>
    );
  }

  if (field.type === "select" || field.type === "multiselect") {
    return (
      <>
        <div className="cell editable" onClick={(e) => setAnchor(e.currentTarget)}>
          <ValueChip field={field} value={value} />
        </div>
        {anchor && (
          <Menu anchor={anchor} onClose={() => setAnchor(null)}>
            {(field.options ?? []).map((o) => {
              const selected =
                field.type === "select"
                  ? value === o.id
                  : Array.isArray(value) && value.includes(o.id);
              return (
                <button
                  key={o.id}
                  className="menu-item"
                  onClick={() => {
                    if (field.type === "select") {
                      onChange(selected ? null : o.id);
                      setAnchor(null);
                    } else {
                      const ids = Array.isArray(value) ? [...value] : [];
                      onChange(selected ? ids.filter((i) => i !== o.id) : [...ids, o.id]);
                    }
                  }}
                >
                  <Tag color={o.color}>{o.name}</Tag>
                  {selected && <Check size={13} style={{ marginLeft: "auto" }} />}
                </button>
              );
            })}
            {(field.options ?? []).length === 0 && (
              <div className="menu-label">No options — edit the field to add some</div>
            )}
          </Menu>
        )}
      </>
    );
  }

  if (field.type === "date") {
    return (
      <div className="cell">
        <input
          type="date"
          className="cell-input"
          style={{ padding: 0, width: "auto", colorScheme: "inherit" }}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      </div>
    );
  }

  if (field.type === "image") {
    return (
      <div className="cell editable" onClick={() => fileRef.current?.click()} title="Click to upload an image">
        {value ? (
          <img src={String(value)} alt="" style={{ width: 44, height: 30, objectFit: "cover", borderRadius: 4 }} />
        ) : (
          <ImagePlus size={15} style={{ color: "var(--text-faint)" }} />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onChange(reader.result as string);
            reader.readAsDataURL(file);
          }}
        />
      </div>
    );
  }

  // text / longtext / number / currency / url
  if (editing) {
    const commit = (v: string) => {
      if (field.type === "number" || field.type === "currency") {
        onChange(v === "" ? null : Number(v));
      } else {
        onChange(v);
      }
      setEditing(false);
    };
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        className="cell-input"
        type={field.type === "number" || field.type === "currency" ? "number" : "text"}
        defaultValue={value === null || value === undefined ? "" : String(value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="cell editable" onClick={() => setEditing(true)}>
      <ValueChip field={field} value={value} />
    </div>
  );
}
