// ── Financial model: revenue goal, projection from pay rates, mix math ──────
// Restores the revenue tracker + goal from the legacy app, now powered by the
// pipeline's fees and the publication pay-rate swipe file.
import { db, updateRow } from "./db";
import type { Database, Row } from "./types";

export function getRevenueGoal(): number {
  return Number(localStorage.getItem("ew_revenue_goal") ?? 10000);
}
export function setRevenueGoal(v: number) {
  localStorage.setItem("ew_revenue_goal", String(v));
}

function findPipeline(databases: Database[]): Database | undefined {
  return (
    databases.find((d) => d.name === "Article Pipeline") ??
    databases.find((d) => d.fields.some((f) => f.type === "currency") && d.fields.some((f) => f.name.toLowerCase() === "status"))
  );
}

export interface RevenueSummary {
  goal: number;
  projected: number; // sum of fees on live (non-killed) articles this month
  earned: number; // sum of fees on Published articles this month
  inflight: number; // projected not yet earned
  pct: number; // earned / goal
  liveCount: number;
  publishedCount: number;
  avgFee: number;
  needToHitGoal: number; // articles at avgFee still needed
}

export function computeRevenue(databases: Database[], rows: Row[], goal: number): RevenueSummary | null {
  const pipeline = findPipeline(databases);
  if (!pipeline) return null;
  const feeField = pipeline.fields.find((f) => f.type === "currency");
  const statusField = pipeline.fields.find((f) => f.name.toLowerCase() === "status" && f.type === "select");
  if (!feeField) return null;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const optName = (id: unknown) => statusField?.options?.find((o) => o.id === id)?.name ?? "";

  const pipeRows = rows.filter((r) => r.dbId === pipeline.id);
  let projected = 0, earned = 0, liveCount = 0, publishedCount = 0, feeSum = 0, feeN = 0;
  for (const r of pipeRows) {
    const fee = Number(r.values[feeField.id]) || 0;
    const status = statusField ? optName(r.values[statusField.id]).toLowerCase() : "";
    const killed = /kill|dead|archive/.test(status);
    if (killed) continue;
    if (fee > 0) { feeSum += fee; feeN++; }
    if (/publish/.test(status)) { earned += fee; publishedCount++; }
    else { projected += fee; liveCount++; }
  }
  const avgFee = feeN ? Math.round(feeSum / feeN) : 0;
  const remaining = Math.max(0, goal - earned);
  return {
    goal, projected: projected + earned, earned, inflight: projected,
    pct: goal ? Math.min(100, (earned / goal) * 100) : 0,
    liveCount, publishedCount, avgFee,
    needToHitGoal: avgFee ? Math.ceil(remaining / avgFee) : 0,
  };
}

export interface BrandPnL { brand: string; goal: number; earned: number; inflight: number; pct: number }

/** Per-brand profit-and-loss: earned (published) + in-flight pipeline fees,
 *  grouped by the article's linked Brand, each toward its monthly goal. */
export function computeBrandPnL(databases: Database[], rows: Row[]): BrandPnL[] {
  const pipeline = findPipeline(databases);
  const brandsDb = databases.find((d) => d.name === "Brands");
  if (!pipeline || !brandsDb) return [];
  const feeField = pipeline.fields.find((f) => f.type === "currency");
  const statusField = pipeline.fields.find((f) => f.name.toLowerCase() === "status" && f.type === "select");
  const brandRel = pipeline.fields.find((f) => f.type === "relation" && /brand/i.test(f.name));
  if (!feeField || !brandRel) return [];

  const goalField = brandsDb.fields.find((f) => f.name.toLowerCase().includes("goal"));
  const brandRows = rows.filter((r) => r.dbId === brandsDb.id);
  const pipeRows = rows.filter((r) => r.dbId === pipeline.id);
  const optName = (id: unknown) => statusField?.options?.find((o) => o.id === id)?.name ?? "";

  return brandRows.map((b) => {
    const name = String(b.values[brandsDb.fields[0].id] ?? "Brand");
    const goal = goalField ? Number(b.values[goalField.id]) || 0 : 0;
    let earned = 0, inflight = 0;
    for (const r of pipeRows) {
      const ids = Array.isArray(r.values[brandRel.id]) ? (r.values[brandRel.id] as string[]) : [];
      if (!ids.includes(b.id)) continue;
      const fee = Number(r.values[feeField.id]) || 0;
      const status = statusField ? optName(r.values[statusField.id]).toLowerCase() : "";
      if (/kill|dead|archive/.test(status)) continue;
      if (/publish/.test(status)) earned += fee; else inflight += fee;
    }
    return { brand: name, goal, earned, inflight, pct: goal ? Math.min(100, (earned / goal) * 100) : 0 };
  });
}

/** Highest $ figure found in a pay-rate string, e.g. "$1,000 to $3,000" → 3000. */
function payFromText(s: string): number {
  const nums = [...String(s || "").matchAll(/\$\s?([\d,]{2,})/g)].map((m) => Number(m[1].replace(/,/g, "")));
  return nums.length ? Math.max(...nums) : 0;
}

/** When an article's Publication is set, suggest its fee from the pay-rate swipe file. */
export async function autoFillFeeFromPublication(database: Database, row: Row): Promise<boolean> {
  const feeField = database.fields.find((f) => f.type === "currency");
  if (!feeField) return false;
  const fresh = (await db.rows.get(row.id))!;
  if (Number(fresh.values[feeField.id]) > 0) return false; // don't overwrite

  const pubsDb = (await db.databases.toArray()).find((d) => d.name === "Publications");
  if (!pubsDb) return false;
  const nameId = pubsDb.fields[0].id;
  const pubRows = await db.rows.where("dbId").equals(pubsDb.id).toArray();

  // Resolve linked outlet: relation field (row IDs) or text field (by name)
  let match: Row | undefined;
  const relField = database.fields.find((f) => f.type === "relation" && /publication|outlet/i.test(f.name));
  if (relField) {
    const ids = Array.isArray(fresh.values[relField.id]) ? (fresh.values[relField.id] as string[]) : [];
    if (ids[0]) match = pubRows.find((r) => r.id === ids[0]);
  } else {
    const textField = database.fields.find((f) => f.type === "text" && /publication/i.test(f.name));
    const pubName = textField ? String(fresh.values[textField.id] ?? "").trim() : "";
    if (pubName) match = pubRows.find((r) => String(r.values[nameId] ?? "").trim().toLowerCase() === pubName.toLowerCase());
  }
  if (!match) return false;
  const get = (fname: string) => {
    const f = pubsDb.fields.find((x) => x.name.toLowerCase() === fname.toLowerCase());
    return f ? match.values[f.id] : undefined;
  };
  const fee = Number(get("Pay Max ($)")) || Number(get("Projection $")) || payFromText(String(get("Pay Rate (Article)") ?? "")) || payFromText(String(get("Pay Range") ?? ""));
  if (fee > 0) {
    await updateRow(row.id, { values: { ...fresh.values, [feeField.id]: fee } });
    return true;
  }
  return false;
}
