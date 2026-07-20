// Evergreen secrets loader — pulls the project's secrets straight from
// Infisical at process start using a machine identity (Universal Auth), so no
// surface ever needs a hand-copied .env.local again. Zero dependencies; uses
// global fetch (Node 18+).
//
// Auth inputs (either works):
//   INFISICAL_TOKEN                                 pre-issued access token
//   INFISICAL_CLIENT_ID + INFISICAL_CLIENT_SECRET   machine identity creds
// Scope inputs (defaults match this repo):
//   INFISICAL_PROJECT_ID   default: this repo's project
//   INFISICAL_ENV          default: "prod"
//   INFISICAL_API_URL      default: https://app.infisical.com/api
//
// Usage (idempotent, safe to call from any entrypoint):
//   import { loadSecrets } from "../packages/research-core/secrets.mjs";
//   await loadSecrets(); // populates process.env, existing vars win

const DEFAULT_PROJECT_ID = "75ce45d4-9209-45b0-a24d-a2078132f2f8";
const DEFAULT_API_URL = "https://app.infisical.com/api";

async function universalAuthLogin(apiUrl, clientId, clientSecret) {
  const res = await fetch(`${apiUrl}/v1/auth/universal-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`Infisical universal-auth login failed: ${res.status} ${await res.text()}`);
  const { accessToken } = await res.json();
  return accessToken;
}

async function fetchRawSecrets(apiUrl, token, projectId, environment, secretPath) {
  const qs = new URLSearchParams({
    workspaceId: projectId,
    environment,
    secretPath,
    expandSecretReferences: "true",
    include_imports: "true",
  });
  const res = await fetch(`${apiUrl}/v3/secrets/raw?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Infisical secrets fetch failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  const out = {};
  for (const group of body.imports ?? []) {
    for (const s of group.secrets ?? []) out[s.secretKey] = s.secretValue;
  }
  for (const s of body.secrets ?? []) out[s.secretKey] = s.secretValue;
  return out;
}

/**
 * Load secrets into process.env. Resolution order:
 *   1. Infisical via INFISICAL_TOKEN or INFISICAL_CLIENT_ID/_SECRET
 *   2. .env.local at the repo root (legacy fallback), if `envFile` given
 * Already-set process.env vars are never overwritten.
 *
 * @param {object} [opts]
 * @param {string} [opts.projectId]
 * @param {string} [opts.environment]
 * @param {string} [opts.secretPath="/"]
 * @param {string} [opts.envFile]   absolute path to a dotenv fallback file
 * @param {boolean} [opts.quiet]    suppress the info log line
 * @returns {Promise<{source: "infisical"|"env-file"|"none", loaded: number}>}
 */
export async function loadSecrets(opts = {}) {
  const apiUrl = (process.env.INFISICAL_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  const projectId = opts.projectId || process.env.INFISICAL_PROJECT_ID || DEFAULT_PROJECT_ID;
  const environment = opts.environment || process.env.INFISICAL_ENV || "prod";
  const secretPath = opts.secretPath || "/";

  let token = process.env.INFISICAL_TOKEN;
  const { INFISICAL_CLIENT_ID: cid, INFISICAL_CLIENT_SECRET: csec } = process.env;

  if (token || (cid && csec)) {
    try {
      if (!token) token = await universalAuthLogin(apiUrl, cid, csec);
      const secrets = await fetchRawSecrets(apiUrl, token, projectId, environment, secretPath);
      let loaded = 0;
      for (const [k, v] of Object.entries(secrets)) {
        if (process.env[k] === undefined) {
          process.env[k] = v;
          loaded++;
        }
      }
      if (!opts.quiet) console.log(`[secrets] loaded ${loaded} vars from Infisical (${environment})`);
      return { source: "infisical", loaded };
    } catch (err) {
      console.error(`[secrets] Infisical fetch failed, falling back: ${err.message}`);
    }
  }

  if (opts.envFile) {
    try {
      const before = Object.keys(process.env).length;
      process.loadEnvFile(opts.envFile);
      const loaded = Object.keys(process.env).length - before;
      if (!opts.quiet) console.log(`[secrets] loaded ${loaded} vars from ${opts.envFile}`);
      return { source: "env-file", loaded };
    } catch {
      /* no fallback file — fall through */
    }
  }

  return { source: "none", loaded: 0 };
}
