// ── Object storage for media (Cloudflare R2, S3-compatible) ────────────────
// Keeps generated images OUT of the database. Cover images used to be stored
// as base64 data URLs inside wsRows JSON — fine at low volume, but it bloats
// the DB and every sync once you're producing images at scale. Here we PUT the
// bytes to R2 and store only the public URL.
//
// Dormant until configured: if the R2 env vars aren't set, uploadDataUrl()
// returns null and callers keep the data URL (graceful fallback). Set
// R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET /
// R2_PUBLIC_URL to switch it on.
import { AwsClient } from "aws4fetch";
import { ENV } from "./env";

export function storageConfigured(): boolean {
  return Boolean(ENV.r2AccountId && ENV.r2AccessKeyId && ENV.r2SecretAccessKey && ENV.r2Bucket);
}

let client: AwsClient | null = null;
function getClient(): AwsClient {
  if (!client) {
    client = new AwsClient({
      accessKeyId: ENV.r2AccessKeyId,
      secretAccessKey: ENV.r2SecretAccessKey,
      service: "s3",
      region: "auto",
    });
  }
  return client;
}

/** Decode a `data:<mime>;base64,...` URL into bytes + content type. */
function parseDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return null;
  return { contentType: m[1], bytes: Buffer.from(m[2], "base64") };
}

const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
};

/** Upload a base64 data URL to R2; returns the public URL, or null if storage
 *  isn't configured or the input isn't a data URL (caller keeps the original). */
export async function uploadDataUrl(dataUrl: string, keyPrefix = "covers"): Promise<string | null> {
  if (!storageConfigured() || !dataUrl.startsWith("data:")) return null;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const ext = EXT[parsed.contentType] ?? "png";
  const key = `${keyPrefix}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const endpoint = `https://${ENV.r2AccountId}.r2.cloudflarestorage.com/${ENV.r2Bucket}/${key}`;

  const resp = await getClient().fetch(endpoint, {
    method: "PUT",
    // Buffer is a valid body at runtime; cast satisfies the strict DOM BodyInit type.
    body: parsed.bytes as unknown as BodyInit,
    headers: { "Content-Type": parsed.contentType },
  });
  if (!resp.ok) {
    throw new Error(`R2 upload failed: ${resp.status} ${(await resp.text()).slice(0, 160)}`);
  }

  // Public URL: prefer a custom domain / r2.dev base if set; else the S3 endpoint.
  const base = ENV.r2PublicUrl.replace(/\/$/, "");
  return base ? `${base}/${key}` : endpoint;
}

/** Upload arbitrary bytes to R2. Returns the r2 key (not a public URL) so callers
 *  can construct signed or private URLs. Returns null if storage not configured. */
export async function uploadBuffer(
  buf: Buffer | Uint8Array,
  key: string,
  contentType = "text/plain",
): Promise<string | null> {
  if (!storageConfigured()) return null;
  const endpoint = `https://${ENV.r2AccountId}.r2.cloudflarestorage.com/${ENV.r2Bucket}/${key}`;
  const resp = await getClient().fetch(endpoint, {
    method: "PUT",
    body: buf as unknown as BodyInit,
    headers: { "Content-Type": contentType },
  });
  if (!resp.ok) {
    throw new Error(`R2 upload failed: ${resp.status} ${(await resp.text()).slice(0, 160)}`);
  }
  return key;
}

/** Download a key from R2 as text. Returns null if not configured or key missing. */
export async function downloadText(key: string): Promise<string | null> {
  if (!storageConfigured()) return null;
  const endpoint = `https://${ENV.r2AccountId}.r2.cloudflarestorage.com/${ENV.r2Bucket}/${key}`;
  const resp = await getClient().fetch(endpoint, { method: "GET" });
  if (!resp.ok) return null;
  return resp.text();
}
