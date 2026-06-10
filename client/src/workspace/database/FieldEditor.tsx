import React, { useState } from "react";
import { Trash2, X } from "lucide-react";
import { uid, updateDatabase } from "../db";
import { FIELD_TYPE_LABELS, OPTION_COLORS, type Database, type Field, type FieldType } from "../types";
import { Menu, Tag } from "../ui";

export function FieldEditor({
  database,
  field, // undefined = creating a new field
  anchor,
  onClose,
}: {
  database: Database;
  field?: Field;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const [name, setName] = useState(field?.name ?? "");
  const [type, setType] = useState<FieldType>(field?.type ?? "text");
  const [options, setOptions] = useState(field?.options ?? []);
  const [newOption, setNewOption] = useState("");

  const isFirst = field && database.fields[0]?.id === field.id;

  const save = async () => {
    const trimmed = name.trim() || "Untitled field";
    if (field) {
      const fields = database.fields.map((f) =>
        f.id === field.id ? { ...f, name: trimmed, type, options: needsOptions(type) ? options : undefined } : f,
      );
      await updateDatabase(database.id, { fields });
    } else {
      const fields = [
        ...database.fields,
        { id: uid(), name: trimmed, type, options: needsOptions(type) ? options : undefined, width: 160 },
      ];
      await updateDatabase(database.id, { fields });
    }
    onClose();
  };

  const remove = async () => {
    if (!field || isFirst) return;
    if (!confirm(`Delete field “${field.name}”? Values in this column are removed.`)) return;
    await updateDatabase(database.id, { fields: database.fields.filter((f) => f.id !== field.id) });
    onClose();
  };

  const needsOptions = (t: FieldType) => t === "select" || t === "multiselect";

  return (
    <Menu anchor={anchor} onClose={onClose} width={260}>
      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          className="input"
          autoFocus
          placeholder="Field name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <select className="input" value={type} onChange={(e) => setType(e.target.value as FieldType)} disabled={isFirst}>
          {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
            <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
          ))}
        </select>

        {needsOptions(type) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div className="menu-label" style={{ padding: 0 }}>Options</div>
            {options.map((o, i) => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Tag
                  color={o.color}
                  onClick={() => {
                    const idx = OPTION_COLORS.indexOf(o.color as (typeof OPTION_COLORS)[number]);
                    const next = OPTION_COLORS[(idx + 1) % OPTION_COLORS.length];
                    setOptions(options.map((x, j) => (j === i ? { ...x, color: next } : x)));
                  }}
                >
                  {o.name}
                </Tag>
                <button
                  className="btn ghost sm"
                  style={{ marginLeft: "auto" }}
                  onClick={() => setOptions(options.filter((_, j) => j !== i))}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <input
              className="input"
              placeholder="Add option, press Enter"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newOption.trim()) {
                  setOptions([
                    ...options,
                    { id: uid(), name: newOption.trim(), color: OPTION_COLORS[options.length % OPTION_COLORS.length] },
                  ]);
                  setNewOption("");
                }
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn primary sm" onClick={save} style={{ flex: 1 }}>
            {field ? "Save" : "Add field"}
          </button>
          {field && !isFirst && (
            <button className="btn sm" onClick={remove} title="Delete field">
              <Trash2 size={13} />
            </button>
          )}
        </div>
        {isFirst && <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>The first field is the row title and stays a text field.</div>}
      </div>
    </Menu>
  );
}
