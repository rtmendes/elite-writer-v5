#!/usr/bin/env node
/**
 * Auto-wires every Vercel project in the team to Infisical prod root.
 * Runs on deploy webhook OR as a cron. Idempotent — skips already-wired projects.
 *
 * Env vars required (already in Infisical prod):
 *   VERCEL_TOKEN, INFISICAL_TOKEN, INFISICAL_AUTH_ID
 *
 * Usage:
 *   node scripts/infisical-sync-vercel.mjs          # wire all missing projects
 *   node scripts/infisical-sync-vercel.mjs --check  # report status only
 */

const VERCEL_TOKEN     = process.env.VERCEL_TOKEN     || process.env.VERCEL_ACCESS_TOKEN;
const INFISICAL_TOKEN  = process.env.INFISICAL_TOKEN;
const AUTH_ID          = process.env.INFISICAL_AUTH_ID;
const TEAM_ID          = process.env.VERCEL_TEAM_ID   || "team_RDc9rfG2nyUydjZvco8L06C9";
const INFISICAL_BASE   = "https://app.infisical.com/api";

const CHECK_ONLY = process.argv.includes("--check");

if (!VERCEL_TOKEN || !INFISICAL_TOKEN || !AUTH_ID) {
  console.error("Missing: VERCEL_TOKEN, INFISICAL_TOKEN, or INFISICAL_AUTH_ID");
  process.exit(1);
}

async function getVercelProjects() {
  const projects = [];
  let cursor;
  do {
    const url = new URL("https://api.vercel.com/v9/projects");
    url.searchParams.set("teamId", TEAM_ID);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("until", cursor);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } });
    const data = await res.json();
    projects.push(...(data.projects || []));
    cursor = data.pagination?.next ? data.pagination.next : null;
  } while (cursor);
  return projects;
}

async function getExistingIntegrations() {
  const res = await fetch(
    `${INFISICAL_BASE}/v1/integration-auth/${AUTH_ID}/integrations`,
    { headers: { Authorization: `Bearer ${INFISICAL_TOKEN}` } }
  );
  if (!res.ok) return new Set();
  const data = await res.json();
  return new Set((data.integrations || []).map(i => i.appId));
}

async function wireProject(id, name) {
  const res = await fetch(`${INFISICAL_BASE}/v1/integration`, {
    method: "POST",
    headers: { Authorization: `Bearer ${INFISICAL_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      integrationAuthId: AUTH_ID,
      sourceEnvironment: "prod",
      secretPath: "/",
      app: name,
      appId: id,
      targetEnvironment: "production",
      isActive: true,
    }),
  });
  return res.status;
}

export async function wireNewProject(id, name) {
  const wired = await getExistingIntegrations();
  if (wired.has(id)) { console.log(`[infisical-wire] already wired: ${name}`); return; }
  const code = await wireProject(id, name);
  console.log(`[infisical-wire] [${code}] ${name}`);
}

// Called from webhooks.ts with env vars set for a single new project
if (process.env.WIRE_PROJECT_ID && process.env.WIRE_PROJECT_NAME) {
  wireNewProject(process.env.WIRE_PROJECT_ID, process.env.WIRE_PROJECT_NAME)
    .catch(err => { console.error(err); process.exit(1); });
} else {
  main().catch(err => { console.error(err); process.exit(1); });
}

async function main() {
  console.log("Fetching Vercel projects...");
  const projects = await getVercelProjects();
  console.log(`Found ${projects.length} projects`);

  console.log("Fetching existing Infisical integrations...");
  const wired = await getExistingIntegrations();
  console.log(`Already wired: ${wired.size}`);

  const missing = projects.filter(p => !wired.has(p.id));
  console.log(`To wire: ${missing.length}`);

  if (CHECK_ONLY || missing.length === 0) {
    missing.forEach(p => console.log(`  MISSING: ${p.name} (${p.id})`));
    return;
  }

  let ok = 0, fail = 0;
  for (const p of missing) {
    const code = await wireProject(p.id, p.name);
    if (code === 200) {
      console.log(`  [✓] ${p.name}`);
      ok++;
    } else {
      console.log(`  [${code}] FAIL: ${p.name}`);
      fail++;
    }
    // Rate limit guard
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`\nDone — wired: ${ok} | failed: ${fail}`);
}
