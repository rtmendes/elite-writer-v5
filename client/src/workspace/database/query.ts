import type { Database, Field, Row, View } from "../types";

function comparable(field: Field | undefined, row: Row): string | number {
  if (!field) return "";
  const v = row.values[field.id];
  if (v === undefined || v === null) return field.type === "number" || field.type === "currency" || field.type === "rating" ? Number.NEGATIVE_INFINITY : "";
  if (field.type === "number" || field.type === "currency" || field.type === "rating") return Number(v) || 0;
  if (field.type === "checkbox") return v ? 1 : 0;
  if (field.type === "select") return field.options?.find((o) => o.id === v)?.name?.toLowerCase() ?? "";
  if (field.type === "multiselect")
    return (Array.isArray(v) ? v : [])
      .map((id) => field.options?.find((o) => o.id === id)?.name ?? "")
      .join(",")
      .toLowerCase();
  return String(v).toLowerCase();
}

function displayText(field: Field, row: Row): string {
  const v = row.values[field.id];
  if (v === undefined || v === null) return "";
  if (field.type === "select") return field.options?.find((o) => o.id === v)?.name ?? "";
  if (field.type === "multiselect")
    return (Array.isArray(v) ? v : []).map((id) => field.options?.find((o) => o.id === id)?.name ?? "").join(" ");
  return String(v);
}

export function applyView(database: Database, rows: Row[], view: View, search: string): Row[] {
  let out = rows;

  // filters
  for (const f of view.filters) {
    const field = database.fields.find((fl) => fl.id === f.fieldId);
    if (!field) continue;
    out = out.filter((row) => {
      const text = displayText(field, row).toLowerCase();
      const num = Number(row.values[field.id]);
      const needle = (f.value ?? "").toLowerCase();
      switch (f.op) {
        case "contains": return text.includes(needle);
        case "eq": return text === needle || String(row.values[field.id] ?? "") === (f.value ?? "");
        case "neq": return text !== needle && String(row.values[field.id] ?? "") !== (f.value ?? "");
        case "empty": return text === "";
        case "notempty": return text !== "";
        case "gt": return !Number.isNaN(num) && num > Number(f.value);
        case "lt": return !Number.isNaN(num) && num < Number(f.value);
        default: return true;
      }
    });
  }

  // global search across all fields
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    out = out.filter((row) => database.fields.some((field) => displayText(field, row).toLowerCase().includes(q)));
  }

  // sorts
  if (view.sorts.length > 0) {
    out = [...out].sort((a, b) => {
      for (const s of view.sorts) {
        const field = database.fields.find((fl) => fl.id === s.fieldId);
        const av = comparable(field, a);
        const bv = comparable(field, b);
        if (av < bv) return s.dir === "asc" ? -1 : 1;
        if (av > bv) return s.dir === "asc" ? 1 : -1;
      }
      return a.sortOrder - b.sortOrder;
    });
  } else {
    out = [...out].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return out;
}

export function rowTitle(database: Database, row: Row): string {
  const first = database.fields[0];
  const v = first ? row.values[first.id] : "";
  return v ? String(v) : "Untitled";
}

export function visibleFields(database: Database, view: View): Field[] {
  return database.fields.filter((f) => !(view.hiddenFields ?? []).includes(f.id));
}
