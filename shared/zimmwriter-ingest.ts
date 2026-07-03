import crypto from "crypto";

export interface ZimmWriterPayload {
  webhook_name: string;
  title: string;
  markdown: string;
  html: string;
  excerpt?: string | false;
  category?: string | false;
  slug?: string | false;
  tags?: string[] | false;
  image_url?: string | false;
  image_base64?: string | false;
}

export function zimmwriterSourceId(webhookName: string, slug: string | false | undefined, title: string): string {
  const key = `${webhookName}:${slug || title}`;
  return crypto.createHash("sha256").update(key).digest("hex");
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export type IngestAuthResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "unauthorized" };

export function verifyZimmwriterIngestAuth(opts: {
  rawBody: Buffer;
  signatureHeader?: string | null;
  tokenHeader?: string | null;
  tokenQuery?: string | null;
  secret?: string;
  token?: string;
}): IngestAuthResult {
  const { rawBody, signatureHeader, tokenHeader, tokenQuery, secret, token } = opts;

  if (!secret && !token) {
    return { ok: false, reason: "not_configured" };
  }

  if (signatureHeader && secret) {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (timingSafeEqual(signatureHeader, expected)) {
      return { ok: true };
    }
  }

  const providedToken = tokenHeader || tokenQuery;
  if (providedToken && token && timingSafeEqual(providedToken, token)) {
    return { ok: true };
  }

  return { ok: false, reason: "unauthorized" };
}

export function computeIngestHmac(rawBody: Buffer | string, secret: string): string {
  const buf = typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody;
  return crypto.createHmac("sha256", secret).update(buf).digest("hex");
}
