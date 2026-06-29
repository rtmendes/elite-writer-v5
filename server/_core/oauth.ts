/**
 * Auth Routes — Standalone login endpoint.
 * Replaces Manus OAuth callback with simple email/password login.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

export function registerOAuthRoutes(app: Express) {
  // POST /api/auth/login — Email/password login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body || {};

      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const { token, user } = await sdk.login(email, password);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error: any) {
      console.error("[Auth] Login failed:", error.message);
      // In dev, surface the real reason (e.g. "User creation failed" when no DB)
      // instead of masking every failure as a wrong password — that masking is
      // what made a missing-database look like a bad credential for hours.
      const message = ENV.isProduction ? "Invalid credentials" : (error.message || "Invalid credentials");
      res.status(401).json({ error: message });
    }
  });

  // GET /api/auth/check — Check if session is valid
  app.get("/api/auth/check", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      res.json({ authenticated: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch {
      res.json({ authenticated: false });
    }
  });

  // POST /api/auth/hash — Generate password hash (setup utility)
  app.post("/api/auth/hash", (req: Request, res: Response) => {
    const { password } = req.body || {};
    if (!password) {
      res.status(400).json({ error: "Password required" });
      return;
    }
    res.json({ hash: sdk.generatePasswordHash(password) });
  });

  // GET /api/auth/bypass?token=… — Owner one-click login (token from OWNER_BYPASS_TOKEN)
  app.get("/api/auth/bypass", async (req: Request, res: Response) => {
    const provided = String(req.query.token ?? "");
    const expected = ENV.ownerBypassToken;

    if (!expected || !provided || provided !== expected) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    try {
      const { token } = await sdk.issueBypassSession(ENV.adminEmail);
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (err: any) {
      res.status(500).json({ error: "Bypass failed" });
    }
  });

  // Legacy: Keep /api/oauth/callback for compatibility, redirect to login
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/login");
  });
}
