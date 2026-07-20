#!/usr/bin/env node
// Conservative Infisical secret creation: CREATE-IF-MISSING ONLY.
// This tool structurally cannot update, overwrite, or delete secrets — if the
// name already exists it exits 0 and changes nothing. That's what makes it
// safe to allowlist in .claude/settings.json (see CLAUDE.md).
//
// Usage:
//   scripts/infisical-ensure-secret.mjs NAME --ref OTHER_SECRET   # alias: value becomes ${OTHER_SECRET}
//   scripts/infisical-ensure-secret.mjs NAME --value-from-env VAR # value read from env var VAR
//   options: --env <slug> (default prod) --path <secretPath> (default /)
//
// Values are never passed on the command line and never printed.
// Auth: INFISICAL_TOKEN or INFISICAL_CLIENT_ID/_SECRET from the environment,
// falling back to .env.local at the repo root.

import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const name = args[0];
const opt = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const ref = opt("--ref");
const valueFromEnv = opt("--value-from-env");
const envSlug = opt("--env") || process.env.INFISICAL_ENV || "prod";
const secretPath = opt("--path") || "/";

if (!name || !/^[A-Z0-9_]+$/.test(name) || (!ref && !valueFromEnv) || (ref && valueFromEnv)) {
  console.error("usage: infisical-ensure-secret.mjs NAME (--ref OTHER_SECRET | --value-from-env VAR) [--env prod] [--path /]");
  process.exit(2);
}

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.INFISICAL_TOKEN && !(process.env.INFISICAL_CLIENT_ID && process.env.INFISICAL_CLIENT_SECRET)) {
  try { process.loadEnvFile(path.join(repoRoot, ".env.local")); } catch { /* no fallback file */ }
}

const API = (process.env.INFISICAL_API_URL || "https://app.infisical.com/api").replace(/\/$/, "");
const PROJECT = process.env.INFISICAL_PROJECT_ID || "75ce45d4-9209-45b0-a24d-a2078132f2f8";

let token = process.env.INFISICAL_TOKEN;
if (!token) {
  const { INFISICAL_CLIENT_ID: cid, INFISICAL_CLIENT_SECRET: csec } = process.env;
  if (!cid || !csec) {
    console.error("no Infisical credentials available (INFISICAL_TOKEN or INFISICAL_CLIENT_ID/_SECRET)");
    process.exit(1);
  }
  const res = await fetch(`${API}/v1/auth/universal-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: cid, clientSecret: csec }),
  });
  if (!res.ok) { console.error(`login failed: ${res.status}`); process.exit(1); }
  token = (await res.json()).accessToken;
}
const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

// Create-if-missing gate: bail out silently-successfully if the name exists.
const checkQs = new URLSearchParams({ workspaceId: PROJECT, environment: envSlug, secretPath, expandSecretReferences: "false" });
const check = await fetch(`${API}/v3/secrets/raw/${name}?${checkQs}`, { headers: auth });
if (check.ok) {
  console.log(`${name}: already exists in ${envSlug}${secretPath} — unchanged (create-if-missing)`);
  process.exit(0);
}
if (check.status !== 404) { console.error(`existence check failed: ${check.status}`); process.exit(1); }

let secretValue;
let comment;
if (ref) {
  if (!/^[A-Z0-9_]+$/.test(ref)) { console.error("--ref must be a secret name"); process.exit(2); }
  const refCheck = await fetch(`${API}/v3/secrets/raw/${ref}?${checkQs}`, { headers: auth });
  if (!refCheck.ok) { console.error(`referenced secret ${ref} not found in ${envSlug}${secretPath} — refusing to create a dangling alias`); process.exit(1); }
  secretValue = "${" + ref + "}";
  comment = `Alias of ${ref} (Infisical reference — rotation stays single-source). Created by infisical-ensure-secret.mjs.`;
} else {
  secretValue = process.env[valueFromEnv];
  if (secretValue === undefined || secretValue === "") { console.error(`env var ${valueFromEnv} is empty or unset`); process.exit(1); }
  comment = `Created by infisical-ensure-secret.mjs from env var ${valueFromEnv}.`;
}

const create = await fetch(`${API}/v3/secrets/raw/${name}`, {
  method: "POST",
  headers: auth,
  body: JSON.stringify({ workspaceId: PROJECT, environment: envSlug, secretPath, secretValue, type: "shared", secretComment: comment }),
});
if (!create.ok) { console.error(`create failed: ${create.status} ${await create.text()}`); process.exit(1); }
console.log(`${name}: created in ${envSlug}${secretPath}${ref ? ` as alias of ${ref}` : ""}`);
