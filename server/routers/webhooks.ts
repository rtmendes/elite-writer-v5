import { Router } from "express";
import { execFile } from "child_process";
import path from "path";

const router = Router();
const SYNC_SCRIPT = path.resolve(process.cwd(), "scripts/infisical-sync-vercel.mjs");

router.post("/vercel-project-created", (req, res) => {
  const { type, payload } = req.body ?? {};
  if (type !== "project.created") return res.json({ ok: true, skipped: true });

  const { id, name } = payload?.project ?? {};
  if (!id || !name) return res.status(400).json({ error: "missing project id/name" });

  // Fire-and-forget
  execFile("node", [SYNC_SCRIPT], {
    env: { ...process.env, WIRE_PROJECT_ID: id, WIRE_PROJECT_NAME: name },
  }, (err) => {
    if (err) console.error(`[infisical-wire] failed for ${name}:`, err.message);
  });

  res.json({ ok: true, project: name });
});

export default router;
