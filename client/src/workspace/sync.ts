// ── Workspace sync engine ──────────────────────────────────────────────────
// MySQL (via the workspace tRPC router) is the source of truth; Dexie is the
// fast local cache. Mutations queue in a durable outbox and push within a
// second; remote changes pull incrementally (last-write-wins by updatedAt).
import { db } from "./db";
import { wsTrpc } from "./trpcClient";
import type { Database, Page, Row } from "./types";

export type SyncStatus = "synced" | "syncing" | "offline" | "disabled";

export const SYNC_TABLES = ["pages", "databases", "rows"] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

// ── status pub/sub ─────────────────────────────────────────────────────────
let status: SyncStatus = "syncing";
let lastError = "";
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(s: SyncStatus, err = "") {
  status = s;
  lastError = err;
  listeners.forEach((fn) => fn(s));
}
export const getSyncStatus = () => status;
export const getSyncError = () => lastError;
export function onSyncStatus(fn: (s: SyncStatus) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ── outbox ─────────────────────────────────────────────────────────────────
let flushTimer: ReturnType<typeof setTimeout> | undefined;

/** Queue a record for push. Called by every db.ts mutation helper. */
export async function enqueue(table: SyncTable, recId: string, op: "upsert" | "delete") {
  await db.outbox.add({ table, recId, op, at: Date.now() });
  scheduleFlush();
}

export function scheduleFlush(delay = 700) {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), delay);
}

function localTable(t: SyncTable) {
  return t === "pages" ? db.pages : t === "databases" ? db.databases : db.rows;
}

let flushing = false;
async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const entries = await db.outbox.orderBy("seq").limit(200).toArray();
    if (entries.length === 0) {
      if (status === "syncing") setStatus("synced");
      return;
    }
    setStatus("syncing");

    // collapse to latest op per record
    const latest: Record<string, (typeof entries)[number]> = {};
    for (const e of entries) latest[`${e.table}:${e.recId}`] = e;

    const byTable: Partial<Record<SyncTable, Array<{ id: string; data: unknown; updated_at: number; deleted: boolean }>>> = {};
    for (const e of Object.values(latest)) {
      const records = byTable[e.table] ?? [];
      if (e.op === "delete") {
        records.push({ id: e.recId, data: {}, updated_at: Date.now(), deleted: true });
      } else {
        const rec = (await localTable(e.table).get(e.recId)) as Page | Database | Row | undefined;
        if (!rec) continue; // deleted meanwhile; the delete op will follow
        records.push({ id: rec.id, data: rec, updated_at: rec.updatedAt, deleted: false });
      }
      byTable[e.table] = records;
    }

    for (const table of Object.keys(byTable) as SyncTable[]) {
      const records = byTable[table];
      if (!records || records.length === 0) continue;
      await wsTrpc.workspace.push.mutate({ table, records });
    }

    await db.outbox.where("seq").belowOrEqual(entries[entries.length - 1].seq!).delete();
    setStatus("synced");
    if ((await db.outbox.count()) > 0) scheduleFlush(100);
  } catch (e) {
    setStatus("offline", e instanceof Error ? e.message : String(e));
  } finally {
    flushing = false;
  }
}

// ── pull ───────────────────────────────────────────────────────────────────
async function pullTable(table: SyncTable): Promise<void> {
  const kvKey = `sync:last:${table}`;
  const last = ((await db.kv.get(kvKey))?.value as number) ?? 0;
  const remote = await wsTrpc.workspace.pull.query({ table, since: last });
  let maxSeen = last;
  for (const r of remote) {
    maxSeen = Math.max(maxSeen, r.updated_at);
    const local = (await localTable(table).get(r.id)) as { updatedAt: number } | undefined;
    if (r.deleted) {
      if (local && local.updatedAt <= r.updated_at) await localTable(table).delete(r.id);
    } else if (!local || local.updatedAt < r.updated_at) {
      await (localTable(table) as never as { put: (v: unknown) => Promise<unknown> }).put(r.data);
    }
  }
  await db.kv.put({ key: kvKey, value: maxSeen });
}

export async function pullAll(): Promise<boolean> {
  try {
    setStatus("syncing");
    for (const t of SYNC_TABLES) await pullTable(t);
    if ((await db.outbox.count()) === 0) setStatus("synced");
    return true;
  } catch (e) {
    setStatus("offline", e instanceof Error ? e.message : String(e));
    return false;
  }
}

/** Queue every local record for push (used after seeding / restoring a backup). */
export async function enqueueEverything() {
  for (const t of SYNC_TABLES) {
    const ids = (await localTable(t).toCollection().primaryKeys()) as string[];
    for (const id of ids) await db.outbox.add({ table: t, recId: id, op: "upsert", at: Date.now() });
  }
  scheduleFlush(200);
}

// ── engine startup ─────────────────────────────────────────────────────────
let started = false;
export function startSync() {
  if (started) return;
  started = true;
  scheduleFlush(500);
  setInterval(() => {
    void pullAll();
    scheduleFlush(300);
  }, 15000);
  window.addEventListener("online", () => {
    void pullAll();
    scheduleFlush(300);
  });
}
