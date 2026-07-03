import { describe, expect, it } from "vitest";
import {
  blocksApproval,
  HEALTH_CLAIMS_SAFETY_THRESHOLD,
  scoreHealthClaimsSafety,
} from "../shared/health-claims-safety";
import {
  computeIngestHmac,
  verifyZimmwriterIngestAuth,
  zimmwriterSourceId,
} from "../shared/zimmwriter-ingest";

const SAMPLE = {
  webhook_name: "second_spring",
  title: "What Is Perimenopause? A Plain-English Guide",
  markdown: "## What's Actually Happening\nA plain guide.",
  html: "<h2>What's Actually Happening</h2><p>A plain guide.</p>",
  excerpt: "A plain-English guide.",
  image_base64: false as const,
  category: "Perimenopause 101",
  image_url: false as const,
  slug: "what-is-perimenopause",
  tags: ["perimenopause", "midlife"],
};

describe("healthClaimsSafety", () => {
  it("scores 100 for clean health copy", () => {
    const result = scoreHealthClaimsSafety(
      "Perimenopause is a natural transition. Many women notice sleep changes during this phase."
    );
    expect(result.score).toBe(100);
    expect(result.flaggedPhrases).toHaveLength(0);
  });

  it("penalizes banned cure language and blocks approval", () => {
    const result = scoreHealthClaimsSafety(
      "This supplement cures menopause insomnia overnight."
    );
    expect(result.score).toBeLessThan(HEALTH_CLAIMS_SAFETY_THRESHOLD);
    expect(blocksApproval(result.score)).toBe(true);
    expect(result.flaggedPhrases.some((p) => p.includes("cure"))).toBe(true);
  });
});

describe("zimmwriter ingest auth", () => {
  const body = Buffer.from(JSON.stringify(SAMPLE));
  const secret = "test-secret-32-chars-long!!!!";
  const token = "test-token-value";

  it("authorizes valid HMAC signature", () => {
    const sig = computeIngestHmac(body, secret);
    expect(
      verifyZimmwriterIngestAuth({
        rawBody: body,
        signatureHeader: sig,
        secret,
      })
    ).toEqual({ ok: true });
  });

  it("authorizes valid token without signature", () => {
    expect(
      verifyZimmwriterIngestAuth({
        rawBody: body,
        tokenHeader: token,
        token,
      })
    ).toEqual({ ok: true });
  });

  it("rejects when neither signature nor token is valid", () => {
    expect(
      verifyZimmwriterIngestAuth({
        rawBody: body,
        signatureHeader: "bad",
        tokenHeader: "bad",
        secret,
        token,
      })
    ).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("returns not_configured when both env vars unset", () => {
    expect(
      verifyZimmwriterIngestAuth({ rawBody: body })
    ).toEqual({ ok: false, reason: "not_configured" });
  });
});

describe("zimmwriter source id", () => {
  it("is deterministic from webhook_name and slug", () => {
    const a = zimmwriterSourceId("second_spring", "what-is-perimenopause", "Title");
    const b = zimmwriterSourceId("second_spring", "what-is-perimenopause", "Other");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
