/**
 * In-memory drizzle stub for pipeline persistence E2E tests.
 */
import { ideas, articles, pitches } from "../../drizzle/schema";

type Row = Record<string, unknown> & { id: number };

const TABLE_MAP = new Map<object, string>([
  [ideas, "ideas"],
  [articles, "articles"],
  [pitches, "pitches"],
]);

export function createMemoryDb() {
  const stores: Record<string, Row[]> = { ideas: [], articles: [], pitches: [] };
  let seq = 1;

  function storeFor(table: object): Row[] {
    const key = TABLE_MAP.get(table);
    if (!key) throw new Error("Unknown table");
    return stores[key];
  }

  function evalWhere(row: Row, where: unknown, userId: number): boolean {
    if (!where) return true;
    const w = where as { type?: string; left?: { name?: string }; right?: unknown; conditions?: unknown[] };
    if (w.type === "and" && w.conditions) {
      return w.conditions.every((c) => evalWhere(row, c, userId));
    }
    if (w.left?.name === "userId") return row.userId === w.right;
    if (w.left?.name === "id") return row.id === w.right;
    if (w.left?.name === "source") return row.source === w.right;
    if (w.left?.name === "sourceId") return row.sourceId === w.right;
    return true;
  }

  function chainSelect(table: object, userId: number) {
    let rows = [...storeFor(table)];
    const api = {
      from: () => api,
      where: (where: unknown) => {
        rows = rows.filter((r) => evalWhere(r, where, userId));
        return api;
      },
      orderBy: () => api,
      limit: (n: number) => rows.slice(0, n),
      then: (resolve: (v: Row[]) => void) => {
        resolve(rows.map((r) => ({ ...r })));
      },
    };
    return api;
  }

  return {
    insert: (table: object) => ({
      values: (vals: Record<string, unknown>) => ({
        returning: async (_fields?: unknown) => {
          const id = seq++;
          storeFor(table).push({ ...vals, id, createdAt: new Date(), updatedAt: new Date() });
          return [{ id }];
        },
      }),
    }),
    select: () => ({
      from: (table: object) => chainSelect(table, 0),
    }),
    update: (table: object) => {
      let setObj: Record<string, unknown> = {};
      let whereClause: unknown = null;
      const api = {
        set: (s: Record<string, unknown>) => {
          setObj = s;
          return api;
        },
        where: (w: unknown) => {
          whereClause = w;
          return api;
        },
        then: (resolve: (v: undefined) => void) => {
          for (const row of storeFor(table)) {
            if (evalWhere(row, whereClause, row.userId as number)) {
              Object.assign(row, setObj, { updatedAt: new Date() });
            }
          }
          resolve(undefined);
        },
      };
      return api;
    },
    delete: () => ({
      where: async () => undefined,
    }),
    _stores: stores,
  };
}

/** Patch eq/and SQL builders to expose column names for where evaluation */
export function testEq(column: { name: string }, value: unknown) {
  return { type: "eq", left: { name: column.name }, right: value };
}

export function testAnd(...conditions: unknown[]) {
  return { type: "and", conditions };
}
