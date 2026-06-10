import React, { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, ImagePlus } from "lucide-react";
import type { Field } from "../types";
import { Menu, Stars, Tag, formatCurrency, formatDate } from "../ui";

/** Read-only presentation of a value (used by board/gallery/list cards too). */
export function ValueChip({ field, value }: { field: Field; value: unknown }) {
  switch (field.type) {
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

/** Editable table cell. */
export function Cell({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

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
