/**
 * Auto-apply drizzle-pg migrations at app startup.
 *
 * Why: the VPS deploy (deploy-poll.sh) only rebuilds + restarts the container —
 * nothing ever ran the SQL in drizzle-pg/, so schema changes silently drifted
 * from prod twice (ZimmWriter #81 columns, saved_views). This runner closes
 * that gap permanently: every boot applies any not-yet-applied migration,
 * in journal order, tracked in an `ew_migrations` table.
 *
 * Safety properties (this app is a live single-node prod — sensitivity first):
 * - BASELINE: on an existing database that has never been tracked (ew_migrations
 *   empty but core tables exist), the current migration set is STAMPED as
 *   applied without running it. Fresh databases run everything. This matches
 *   how the schema was actually provisioned (0000/0001 applied manually).
 * - One migration = one transaction. A failure rolls that migration back.
 * - FAIL-OPEN: a migration error never prevents the app from serving (that
 *   would crash-loop the site); it logs loudly and surfaces via
 *   getMigrationStatus() in /api/health as migrations:"error".
 * - Policy: merging a PR that contains a drizzle-pg migration IS the approval
 *   to apply it (the founder gate moves to PR review).
 */
import fs from "fs";
import path from "path";
import postgres from "postgres";

export type MigrationStatus =
  | { state: "pending" }
  | { state: "ok"; applied: number; baselined: boolean }
  | { state: "skipped"; reason: string }
  | { state: "error"; message: string };

let status: MigrationStatus = { state: "pending" };
export function getMigrationStatus(): MigrationStatus {
  return status;
}

function migrationsDir(): string | null {
  // Works from both dist (container: /app/drizzle-pg) and tsx dev (repo root).
  const candidates = [
    path.resolve(process.cwd(), "drizzle-pg"),
    path.resolve(import.meta.dirname, "../..", "drizzle-pg"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "meta", "_journal.json"))) return dir;
  }
  return null;
}

export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgres")) {
    status = { state: "skipped", reason: "no postgres DATABASE_URL" };
    return;
  }
  const dir = migrationsDir();
  if (!dir) {
    status = { state: "skipped", reason: "drizzle-pg folder not found" };
    return;
  }

  const journal = JSON.parse(fs.readFileSync(path.join(dir, "meta", "_journal.json"), "utf8")) as {
    entries: Array<{ tag: string }>;
  };
  const tags = journal.entries.map((e) => e.tag);

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`CREATE TABLE IF NOT EXISTS ew_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;

    const appliedRows = await sql`SELECT name FROM ew_migrations`;
    const applied = new Set(appliedRows.map((r) => r.name as string));

    let baselined = false;
    if (applied.size === 0) {
      // Never-tracked database. If it already has the core schema (users), it
      // was provisioned manually — stamp the current set instead of re-running
      // non-idempotent CREATEs against live tables.
      const existing = await sql`SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users' LIMIT 1`;
      if (existing.length > 0) {
        for (const tag of tags) {
          await sql`INSERT INTO ew_migrations (name) VALUES (${tag}) ON CONFLICT DO NOTHING`;
          applied.add(tag);
        }
        baselined = true;
        console.log(`[migrations] baseline: stamped ${tags.length} existing migration(s) as applied`);
      }
    }

    let ran = 0;
    for (const tag of tags) {
      if (applied.has(tag)) continue;
      const file = path.join(dir, `${tag}.sql`);
      const body = fs.readFileSync(file, "utf8");
      const statements = body
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      console.log(`[migrations] applying ${tag} (${statements.length} statements)`);
      await sql.begin(async (tx) => {
        for (const stmt of statements) {
          await tx.unsafe(stmt);
        }
        await tx`INSERT INTO ew_migrations (name) VALUES (${tag})`;
      });
      ran++;
    }

    status = { state: "ok", applied: ran, baselined };
    if (ran > 0) console.log(`[migrations] applied ${ran} migration(s)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    status = { state: "error", message };
    console.error(`[migrations] FAILED (app continues on current schema): ${message}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
