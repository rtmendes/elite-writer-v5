import crypto from "crypto";
import { eq, and, sql, or, like } from "drizzle-orm";
import { getDb, getUserByOpenId, upsertUser } from "../db";
import { syncArticleToPipeline } from "./supabase-sync";
import { ENV } from "../_core/env";
import { articles, brands } from "../../drizzle/schema";
import {
  hasComplianceFlag,
  scoreHealthClaimsSafety,
} from "../../shared/health-claims-safety";
import {
  zimmwriterSourceId,
  type ZimmWriterPayload,
} from "../../shared/zimmwriter-ingest";

export type ZimmwriterIngestResult =
  | { status: "created"; id: number }
  | { status: "exists"; id: number };

function adminOpenId(email: string): string {
  return "admin_" + crypto.createHash("md5").update(email).digest("hex").slice(0, 16);
}

// Self-heal the ZimmWriter article columns. PR #81's migration was written to
// the retired drizzle/ (MySQL) dir and never reached the Postgres set after the
// Supabase cutover, so these columns are missing on prod and every ingest was
// throwing "column does not exist". Idempotent ADD COLUMN IF NOT EXISTS, run
// once per process — same resilience idiom used in products.ts / workspace.ts.
// Redundant (harmless) once drizzle-pg migration 0001 is applied.
let _ingestColsEnsured = false;
async function ensureIngestColumns(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>
): Promise<void> {
  if (_ingestColsEnsured) return;
  _ingestColsEnsured = true;
  const cols: Array<[string, string]> = [
    ["source", "text"],
    ["source_id", "text"],
    ["body_markdown", "text"],
    ["body_html", "text"],
    ["excerpt", "text"],
    ["category", "varchar(200)"],
    ["tags", "jsonb"],
    ["featured_image_url", "text"],
    ["featured_image_b64", "text"],
    ["needs_scoring", "boolean DEFAULT false NOT NULL"],
    ["compliance_flag", "boolean DEFAULT false NOT NULL"],
    ["neuron_score", "integer"],
    ["neuron_share_url", "text"],
  ];
  try {
    for (const [name, type] of cols) {
      await db.execute(sql.raw(`ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "${name}" ${type}`));
    }
    await db.execute(
      sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS "articles_source_source_id_uidx" ON "articles" ("source","source_id")`)
    );
  } catch {
    // Best-effort: if the DB role lacks ALTER (or a transient error), ingest
    // still proceeds; a later process retries (flag is per-process).
  }
}

async function resolveIngestUserId(): Promise<number> {
  const email = ENV.adminEmail || "admin@elitewriter.app";
  const openId = adminOpenId(email);
  let user = await getUserByOpenId(openId);
  if (!user) {
    await upsertUser({
      openId,
      email,
      name: "Admin",
      loginMethod: "ingest",
      role: "admin",
      lastSignedIn: new Date(),
    });
    user = await getUserByOpenId(openId);
  }
  if (!user) throw new Error("Failed to resolve ingest user");
  return user.id;
}

function normalizeBrandKey(webhookName: string): string {
  return webhookName.replace(/_/g, " ").trim();
}

async function resolveBrandId(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  webhookName: string
): Promise<string> {
  try {
    const label = normalizeBrandKey(webhookName);
    const rows = await db
      .select({ id: brands.id, name: brands.name })
      .from(brands)
      .where(
        and(
          eq(brands.userId, userId),
          or(
            sql`lower(replace(${brands.name}, ' ', '_')) = lower(${webhookName})`,
            like(brands.name, label)
          )
        )
      )
      .limit(1);

    if (rows[0]) return String(rows[0].id);
  } catch {
    /* brand lookup is best-effort */
  }
  return webhookName;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function coerceString(value: string | false | undefined): string | null {
  if (value === false || value === undefined || value === "") return null;
  return value;
}

function coerceTags(value: string[] | false | undefined): string[] | null {
  if (value === false || !value?.length) return null;
  return value;
}

export async function ingestZimmwriterArticle(
  payload: ZimmWriterPayload
): Promise<ZimmwriterIngestResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await ensureIngestColumns(db);

  const userId = await resolveIngestUserId();
  const source = "zimmwriter";
  const sourceId = zimmwriterSourceId(
    payload.webhook_name,
    payload.slug,
    payload.title
  );

  const existing = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.source, source), eq(articles.sourceId, sourceId)))
    .limit(1);

  if (existing[0]) {
    return { status: "exists", id: existing[0].id };
  }

  const bodyMarkdown = payload.markdown;
  const bodyHtml = payload.html;
  const combined = `${bodyMarkdown}\n${bodyHtml}`;
  const complianceFlag = hasComplianceFlag(combined);
  const healthClaims = scoreHealthClaimsSafety(bodyMarkdown, bodyHtml);
  const brandId = await resolveBrandId(db, userId, payload.webhook_name);

  const [inserted] = await db
    .insert(articles)
    .values({
      userId,
      title: payload.title,
      content: bodyMarkdown,
      bodyMarkdown,
      bodyHtml,
      excerpt: coerceString(payload.excerpt),
      category: coerceString(payload.category),
      tags: coerceTags(payload.tags),
      featuredImageUrl: coerceString(payload.image_url),
      featuredImageB64:
        typeof payload.image_base64 === "string" ? payload.image_base64 : null,
      source,
      sourceId,
      brandId,
      importedFrom: `zimmwriter:${payload.webhook_name}`,
      status: "draft",
      needsScoring: true,
      complianceFlag,
      wordCount: wordCount(bodyMarkdown),
      scoreData: {
        healthClaimsSafety: healthClaims.score,
        healthClaimsFlaggedPhrases: healthClaims.flaggedPhrases,
      },
    })
    .returning({ id: articles.id });

  syncArticleToPipeline({
    articleId: inserted.id,
    title: payload.title,
    status: "draft",
    brandId,
    wordCount: wordCount(bodyMarkdown),
  });

  return { status: "created", id: inserted.id };
}
