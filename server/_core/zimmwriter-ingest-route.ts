import express from "express";
import { ENV } from "./env";
import { verifyZimmwriterIngestAuth } from "../../shared/zimmwriter-ingest";
import { ingestZimmwriterArticle } from "../lib/zimmwriter-ingest";
import { zimmwriterPayloadSchema } from "../routers/ingest";

/** POST /api/ingest/zimmwriter — dual-auth ZimmWriter webhook (HMAC or token). */
export function registerZimmwriterIngestRoute(app: express.Express): void {
  app.post(
    "/api/ingest/zimmwriter",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const rawBody = req.body as Buffer;
      const auth = verifyZimmwriterIngestAuth({
        rawBody,
        signatureHeader: req.headers["x-ingest-signature"] as string | undefined,
        tokenHeader: req.headers["x-ingest-token"] as string | undefined,
        tokenQuery: typeof req.query.token === "string" ? req.query.token : null,
        secret: ENV.zimmwriterIngestSecret || undefined,
        token: ENV.zimmwriterIngestToken || undefined,
      });

      if (!auth.ok) {
        if (auth.reason === "not_configured") {
          res.status(500).json({ error: "Ingest auth not configured" });
          return;
        }
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(rawBody.toString("utf8"));
      } catch {
        res.status(400).json({ error: "Invalid JSON" });
        return;
      }

      const parsed = zimmwriterPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
        return;
      }

      try {
        const result = await ingestZimmwriterArticle(parsed.data);
        res.status(result.status === "created" ? 201 : 200).json(result);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Ingest failed";
        console.error("[ZimmWriter ingest]", message);
        res.status(500).json({ error: message });
      }
    }
  );
}
