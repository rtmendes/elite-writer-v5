/**
 * Public REST API for the Opportunities workspace database, consumed by
 * Pipeline HQ (pipeline.insightprofit.live). Internal tooling — no auth wall
 * per house rules; CORS open so the Vercel-hosted frontend can read it.
 *
 *   GET  /api/opportunities          → { items: [...] }
 *   POST /api/opportunities/status   → { ids: string[], status: "New"|"Reviewing"|"Pitched"|"Skipped" }
 */
import type { Express, Request, Response } from "express";
import { fieldByName, loadDatabases, loadRows, saveRow } from "./proactiveAgents";

function cors(res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function getOpportunitiesDb() {
  const databases = await loadDatabases();
  return databases.find((d) => d.name === "Opportunities") ?? null;
}

export function registerOpportunityRoutes(app: Express) {
  app.options("/api/opportunities*", (_req, res) => { cors(res); res.sendStatus(204); });

  app.get("/api/opportunities", async (_req: Request, res: Response) => {
    cors(res);
    try {
      const db = await getOpportunitiesDb();
      if (!db) return res.json({ items: [] });
      const f = (n: string) => fieldByName(db, n)?.id ?? "";
      const statusField = fieldByName(db, "Status");
      const statusName = (v: unknown) => statusField?.options?.find((o) => o.id === v)?.name ?? "New";
      const rows = await loadRows(db.id);
      const items = rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => ({
          id: r.id,
          title: String(r.values[f("Opportunity")] ?? ""),
          source: String(r.values[f("Outlet/Source")] ?? ""),
          url: String(r.values[f("URL")] ?? ""),
          pay: String(r.values[f("Pay")] ?? ""),
          deadline: String(r.values[f("Deadline")] ?? ""),
          beat: String(r.values[f("Beat")] ?? ""),
          status: statusName(r.values[f("Status")]),
          found: String(r.values[f("Found")] ?? "") || new Date(r.createdAt).toISOString().slice(0, 10),
        }));
      res.json({ items });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "failed" });
    }
  });

  app.post("/api/opportunities/status", async (req: Request, res: Response) => {
    cors(res);
    try {
      const { ids, status } = req.body as { ids?: string[]; status?: string };
      if (!Array.isArray(ids) || ids.length === 0 || !status) {
        return res.status(400).json({ error: "ids[] and status required" });
      }
      const db = await getOpportunitiesDb();
      if (!db) return res.status(404).json({ error: "Opportunities database not found" });
      const statusField = fieldByName(db, "Status");
      const option = statusField?.options?.find((o) => o.name.toLowerCase() === status.toLowerCase());
      if (!statusField || !option) return res.status(400).json({ error: `unknown status: ${status}` });
      const rows = await loadRows(db.id);
      const wanted = new Set(ids);
      let updated = 0;
      for (const row of rows) {
        if (!wanted.has(row.id)) continue;
        row.values[statusField.id] = option.id;
        await saveRow(row);
        updated++;
      }
      res.json({ ok: true, updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "failed" });
    }
  });
}
