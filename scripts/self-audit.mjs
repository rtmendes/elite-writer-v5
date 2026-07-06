#!/usr/bin/env node
// Self-audit: boots the app (or targets AUDIT_URL), verifies API health and
// drives the Settings UI with headless Chromium. Exits non-zero on failure.
//
// Usage:
//   node scripts/self-audit.mjs                          # spawn local dev server, audit it
//   AUDIT_URL=https://elitewriter.insightprofit.live \
//     AUDIT_EMAIL=... AUDIT_PASSWORD=... node scripts/self-audit.mjs   # audit a live deployment
//
// Requires playwright + a Chromium binary (both preinstalled in Claude Code
// web environments; locally: npm i -g playwright && npx playwright install chromium).
// Screenshots land in audit-artifacts/.

import { spawn } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const ARTIFACTS = resolve(ROOT, "audit-artifacts");
const PORT = process.env.AUDIT_PORT || "3100";
const BASE = process.env.AUDIT_URL || `http://localhost:${PORT}`;
const EMAIL = process.env.AUDIT_EMAIL || "admin@elitewriter.app";
const PASSWORD = process.env.AUDIT_PASSWORD || "admin";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

async function loadChromium() {
  for (const spec of ["playwright", "/opt/node22/lib/node_modules/playwright/index.mjs"]) {
    try { return (await import(spec)).chromium; } catch { /* next */ }
  }
  throw new Error("playwright not found (npm i -g playwright)");
}

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { await fetch(url); return true; } catch { await new Promise(r => setTimeout(r, 1000)); }
  }
  return false;
}

let server = null;
if (!process.env.AUDIT_URL) {
  server = spawn("pnpm", ["exec", "tsx", "server/_core/index.ts"], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "development", PORT },
    stdio: "ignore",
    detached: true,
  });
}

try {
  check("server reachable", await waitFor(BASE), BASE);

  // API layer
  const status = await fetch(`${BASE}/api/trpc/news.status`).then(r => r.json()).catch(() => null);
  const apis = status?.result?.data?.json?.apis;
  check("news.status responds", !!apis, apis ? JSON.stringify(apis) : "no response");
  for (const source of ["newsapi", "gnews", "mediastack", "perigon"]) {
    check(`news.status exposes ${source}`, apis ? source in apis : false, apis?.[source] ? "configured" : "not configured");
  }
  const keys = await fetch(`${BASE}/api/server-keys`).then(r => r.json()).catch(() => null);
  check("server-keys sync endpoint", !!keys && "perigon_key" in keys);

  // UI layer
  mkdirSync(ARTIFACTS, { recursive: true });
  const chromium = await loadChromium();
  const executablePath = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
  check("login", !page.url().includes("/login"), page.url());

  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /news/i }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  for (const label of ["NewsAPI", "GNews", "MediaStack", "Perigon"]) {
    const visible = await page.getByText(label, { exact: false }).first().isVisible().catch(() => false);
    check(`settings shows ${label}`, visible);
  }
  await page.screenshot({ path: `${ARTIFACTS}/settings-news.png`, fullPage: true });
  await browser.close();
} catch (e) {
  check("audit runner", false, String(e).slice(0, 300));
} finally {
  if (server) { try { process.kill(-server.pid); } catch { /* already gone */ } }
}

const failed = results.filter(r => !r.ok);
console.log(failed.length ? `\n${failed.length} check(s) failed` : "\nall checks passed");
process.exit(failed.length ? 1 : 0);
