// ── Core workspace data model ──────────────────────────────────────────────
export type ID = string;

export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "currency"
  | "select"
  | "multiselect"
  | "date"
  | "checkbox"
  | "url"
  | "image"
  | "rating"
  | "relation"
  | "lookup";

export interface SelectOption {
  id: string;
  name: string;
  color: string; // token: gray|blue|green|yellow|red|purple|pink|orange|teal
}

export interface Field {
  id: ID;
  name: string;
  type: FieldType;
  options?: SelectOption[];
  width?: number;
  relationDbId?: ID;       // for "relation": the linked database
  lookupRelationId?: ID;   // for "lookup": the relation field on this database
  lookupFieldId?: ID;      // for "lookup": which field on the linked row to read
}

export type ViewType = "table" | "kanban" | "gallery" | "list";

export interface Filter {
  id: string;
  fieldId: string;
  op: "contains" | "eq" | "neq" | "empty" | "notempty" | "gt" | "lt";
  value?: string;
}

export interface Sort {
  fieldId: string;
  dir: "asc" | "desc";
}

export interface View {
  id: ID;
  name: string;
  type: ViewType;
  filters: Filter[];
  sorts: Sort[];
  groupBy?: ID; // select field for kanban grouping
  thumbnailField?: ID; // image field for gallery covers
  hiddenFields?: ID[];
}

export interface Database {
  id: ID;
  name: string;
  icon: string;
  description?: string;
  fields: Field[];
  views: View[];
  createdAt: number;
  updatedAt: number;
}

export interface Row {
  id: ID;
  dbId: ID;
  values: Record<string, unknown>;
  doc?: unknown[]; // BlockNote document for the expanded record
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface Page {
  id: ID;
  parentId: ID | null;
  title: string;
  icon: string;
  doc?: unknown[]; // BlockNote document
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  longtext: "Long text",
  number: "Number",
  currency: "Currency ($)",
  select: "Select",
  multiselect: "Multi-select",
  date: "Date",
  checkbox: "Checkbox",
  url: "URL",
  image: "Image / Thumbnail",
  rating: "Rating (1–5)",
  relation: "Link to database",
  lookup: "Lookup (from link)",
};

export const OPTION_COLORS = [
  "gray",
  "blue",
  "green",
  "yellow",
  "red",
  "purple",
  "pink",
  "orange",
  "teal",
] as const;
