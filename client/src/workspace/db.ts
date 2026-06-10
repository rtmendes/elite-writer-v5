import Dexie, { type Table } from "dexie";
import { nanoid } from "nanoid";
import type { Database, Field, Page, Row, View, ViewType } from "./types";
import { enqueue } from "./sync";

export interface OutboxEntry {
  seq?: number;
  table: "pages" | "databases" | "rows";
  recId: string;
  op: "upsert" | "delete";
  at: number;
}

class WorkspaceDB extends Dexie {
  pages!: Table<Page, string>;
  databases!: Table<Database, string>;
  rows!: Table<Row, string>;
  kv!: Table<{ key: string; value: unknown }, string>;
  outbox!: Table<OutboxEntry, number>;

  constructor() {
    super("elite-writer-workspace");
    this.version(1).stores({
      pages: "id, parentId, sortOrder, updatedAt",
      databases: "id, updatedAt",
      rows: "id, dbId, sortOrder, updatedAt",
      kv: "key",
    });
    this.version(2).stores({
      pages: "id, parentId, sortOrder, updatedAt",
      databases: "id, updatedAt",
      rows: "id, dbId, sortOrder, updatedAt",
      kv: "key",
      outbox: "++seq, table, recId",
    });
  }
}

export const db = new WorkspaceDB();
export const uid = () => nanoid(12);

// ── Pages ──────────────────────────────────────────────────────────────────
export async function createPage(parentId: string | null = null, title = ""): Promise<Page> {
  const now = Date.now();
  const page: Page = {
    id: uid(),
    parentId,
    title,
    icon: "📄",
    doc: undefined,
    sortOrder: now,
    createdAt: now,
    updatedAt: now,
  };
  await db.pages.add(page);
  void enqueue("pages", page.id, "upsert");
  return page;
}

export async function updatePage(id: string, patch: Partial<Page>) {
  await db.pages.update(id, { ...patch, updatedAt: Date.now() });
  void enqueue("pages", id, "upsert");
}

export async function deletePageTree(id: string) {
  const children = await db.pages.where("parentId").equals(id).toArray();
  for (const c of children) await deletePageTree(c.id);
  await db.pages.delete(id);
  void enqueue("pages", id, "delete");
}

// ── Databases ──────────────────────────────────────────────────────────────
export function makeView(type: ViewType, name?: string): View {
  return {
    id: uid(),
    name: name ?? { table: "Table", kanban: "Board", gallery: "Gallery", list: "List" }[type],
    type,
    filters: [],
    sorts: [],
    hiddenFields: [],
  };
}

export async function createDatabase(name = "Untitled Database"): Promise<Database> {
  const now = Date.now();
  const titleField: Field = { id: uid(), name: "Name", type: "text", width: 280 };
  const statusField: Field = {
    id: uid(),
    name: "Status",
    type: "select",
    width: 160,
    options: [
      { id: uid(), name: "Not started", color: "gray" },
      { id: uid(), name: "In progress", color: "blue" },
      { id: uid(), name: "Done", color: "green" },
    ],
  };
  const database: Database = {
    id: uid(),
    name,
    icon: "🗂️",
    fields: [titleField, statusField],
    views: [makeView("table"), { ...makeView("kanban"), groupBy: statusField.id }],
    createdAt: now,
    updatedAt: now,
  };
  await db.databases.add(database);
  void enqueue("databases", database.id, "upsert");
  return database;
}

export async function updateDatabase(id: string, patch: Partial<Database>) {
  await db.databases.update(id, { ...patch, updatedAt: Date.now() });
  void enqueue("databases", id, "upsert");
}

export async function deleteDatabase(id: string) {
  const rowIds = (await db.rows.where("dbId").equals(id).primaryKeys()) as string[];
  await db.rows.where("dbId").equals(id).delete();
  await db.databases.delete(id);
  for (const rid of rowIds) void enqueue("rows", rid, "delete");
  void enqueue("databases", id, "delete");
}

export async function createRow(dbId: string, values: Record<string, unknown> = {}): Promise<Row> {
  const now = Date.now();
  const row: Row = {
    id: uid(),
    dbId,
    values,
    sortOrder: now,
    createdAt: now,
    updatedAt: now,
  };
  await db.rows.add(row);
  void enqueue("rows", row.id, "upsert");
  return row;
}

export async function updateRow(id: string, patch: Partial<Row>) {
  await db.rows.update(id, { ...patch, updatedAt: Date.now() });
  void enqueue("rows", id, "upsert");
}

export async function setRowValue(rowId: string, fieldId: string, value: unknown) {
  const row = await db.rows.get(rowId);
  if (!row) return;
  await db.rows.update(rowId, {
    values: { ...row.values, [fieldId]: value },
    updatedAt: Date.now(),
  });
  void enqueue("rows", rowId, "upsert");
}

export async function deleteRow(id: string) {
  await db.rows.delete(id);
  void enqueue("rows", id, "delete");
}

// ── Settings ───────────────────────────────────────────────────────────────
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const entry = await db.kv.get(key);
  return entry ? (entry.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await db.kv.put({ key, value });
}

// ── Backup / restore ───────────────────────────────────────────────────────
export async function exportWorkspace(): Promise<string> {
  const [pages, databases, rows] = await Promise.all([
    db.pages.toArray(),
    db.databases.toArray(),
    db.rows.toArray(),
  ]);
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), pages, databases, rows });
}

export async function importWorkspace(json: string) {
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.pages)) throw new Error("Invalid backup file");
  await db.transaction("rw", db.pages, db.databases, db.rows, async () => {
    await db.pages.clear();
    await db.databases.clear();
    await db.rows.clear();
    await db.pages.bulkAdd(data.pages);
    await db.databases.bulkAdd(data.databases ?? []);
    await db.rows.bulkAdd(data.rows ?? []);
  });
}
