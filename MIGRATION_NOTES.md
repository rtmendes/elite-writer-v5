# MySQL → Supabase (Postgres) Migration Notes — elite-writer-v5

Phase 0 discovery snapshot. Date: 2026-07-02. Read-only — nothing changed yet.

## Source (MySQL)

- Location: Oracle VPS (`oracle-vm` SSH alias), container `thepopebot-mysql` (mysql:8.0), reachable as network alias `elite-writer-mysql` on docker network `coolify`
- Connection: `DATABASE_URL` in `/opt/elite-writer-v5/.env.production` (mysql://, credentials NOT recorded here — references only)
- Database: `elite_writer`
- App container: `elite-writer-v5` (same `coolify` network)
- Nightly backups: `/opt/backups/elite-writer/` via `scripts/backup-db.sh` (keeps 14)

## Target (Supabase Postgres) — VERIFIED REACHABLE

- Container `supabase-db` — PostgreSQL 17.6 (aarch64), up 2 months, healthy
- pgvector 0.8.0 installed and available ✅
- No `elite_writer` database exists yet (will create in Phase 2)
- Disk: 9.6G free (data is ~734KB — ample)

## Live row counts (TRUTH for post-migration verify) — 2026-07-02

| table | rows |
|---|---|
| __drizzle_migrations | 12 (drizzle bookkeeping — not migrated; Postgres gets fresh migrations) |
| agent_assignments | 5 |
| agent_chats | 5 |
| agent_memories | 9 |
| agent_messages | 14 |
| ai_interviews | 0 |
| ai_usage | 76 |
| article_research | 1 |
| article_tag | 0 |
| articles | 9 |
| brand_contexts | 0 |
| brands | 10 |
| content_calendar | 0 |
| content_library | 0 |
| content_sources | 0 |
| content_strategies | 1 |
| content_studio_items | 316 |
| daily_briefs | 1 |
| earnings | 0 |
| feed_seen | 0 |
| feeds | 0 |
| funnels | 0 |
| generated_images | 0 |
| geo_projects | 0 |
| geo_scores | 0 |
| google_tokens | 2 |
| ideas | 3 |
| image_library | 0 |
| image_presets | 0 |
| intelligence_items | 100 |
| intelligence_learnings | 0 |
| kb_items | 0 |
| keyword_research | 0 |
| marketing_assets | 0 |
| news_items | 131 |
| pitches | 1 |
| products | 1 |
| publications | 19 |
| pulse_stories | 78 |
| research_folders | 1 |
| research_highlights | 0 |
| research_items | 1 |
| research_notes | 5 |
| research_projects | 2 |
| research_references | 1 |
| research_series | 0 |
| research_share | 0 |
| social_posts | 0 |
| source_items | 0 |
| style_profiles | 0 |
| template_sops | 8 |
| trending_topics | 0 |
| user_settings | 2 |
| users | 4 |
| wsDatabases | 9 |
| wsPages | 2 |
| wsRows | 580 |

Total data rows (app tables): ~1,397. Non-empty tables: 27.

### Orphan-table note — CORRECTED

Earlier draft flagged `article_tag`, `research_series`, `research_share` as orphans.
Wrong: that was based on a stale local checkout (9 commits behind origin). After
`git pull` all 3 ARE in drizzle/schema.ts — live DB and schema match 56/56.

## Schema inventory (drizzle/schema.ts — 56 tables, mysql-core)

- 56 `mysqlTable` definitions; `relations.ts` is empty (no drizzle FK relations to port)
- No explicit FOREIGN KEY constraints — only implicit int refs (userId, brandId, …)
- Patterns to port to pg-core:
  - `int().autoincrement().primaryKey()` → `serial` (or identity)
  - `mysqlEnum(...)` → `varchar(..., { enum: [...] })` — NOT pgEnum. MySQL enum column
    names ("status", "platform", …) repeat across tables with different value sets;
    Postgres named enum types are DB-wide and would force ~40 invented type names.
    varchar-with-enum keeps identical TS union types; DB column is plain varchar.
  - `timestamp().defaultNow().onUpdateNow()` → Postgres has no ON UPDATE; use drizzle `$onUpdate(() => new Date())` (app-level)
  - `json().$type<…>()` → `jsonb`
  - `decimal(10,2)/(5,2)/(6,2)` → same in pg-core
  - `bigint({ mode: "number" })` → same in pg-core
  - `boolean` (wsPages, wsDatabases, wsRows, template_sops) → native boolean
  - `varchar(32)` PKs on wsRows → same
- Unique indexes to preserve: ai_usage(day+model) `day_model_idx`, user_settings(userId), template_sops(templateId), users(openId)

## MySQL-specific SQL to port (Phase 4)

Raw `ON DUPLICATE KEY UPDATE ... VALUES(col)` → `INSERT ... ON CONFLICT (pk) DO UPDATE SET col = EXCLUDED.col`:
- server/routers/workspace.ts:253, 469, 665
- server/_core/proactiveAgents.ts:93, 104
- server/_core/skills.ts:147

Runtime self-migration DDL (MySQL syntax → PG syntax):
- server/routers/workspace.ts:33-50 and server/_core/proactiveAgents.ts:59-61 —
  `ensureTables()` creates ws tables + `ALTER TABLE wsRows ADD COLUMN dbId ... GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(data,'$.dbId'))) STORED` + `idx_wsRows_dbId`.
  PG equivalent (already applied to Supabase in Phase 3):
  `ALTER TABLE "wsRows" ADD COLUMN IF NOT EXISTS "dbId" varchar(40) GENERATED ALWAYS AS (data->>'dbId') STORED` + `CREATE INDEX IF NOT EXISTS`.
  App code must emit PG syntax after driver swap (queried by proactiveAgents.ts:81, skills.ts:135).

Drizzle `.onDuplicateKeyUpdate({set})` → `.onConflictDoUpdate({target, set})`:
- server/db.ts:96 (users.openId)
- server/routers/sources.ts:293
- server/routers/templateSops.ts:291
- server/_core/budget.ts:111–116 (ai_usage day+model unique index)

Driver swap: `drizzle-orm/mysql2` → `drizzle-orm/postgres-js` (server/db.ts only place mysql2 imported). Add `postgres` dep; keep `mysql2` installed until decommission.

Portable raw sql`` fragments (verify behavior, likely no change): interviews.ts:53, sources.ts:320/577, ai.ts:164/174, studio.ts:21–27, trending.ts:20–26, calendar.ts:25–28, agents.ts:599, pulse.ts:252/273/387, budget.ts:52.

## Config surface

- `drizzle.config.ts`: dialect "mysql" → "postgresql"
- `package.json`: add `postgres`; `db:push` unchanged (drizzle-kit generate+migrate)
- Existing MySQL migrations in `drizzle/` → new pg migration set generated fresh (dir strategy decided in Phase 2)

## Rollback

Revert `DATABASE_URL` in `/opt/elite-writer-v5/.env.production` to MySQL value +
redeploy Phase-1 git SHA. MySQL never touched, never decommissioned in this migration.

## Phase 1 artifacts — 2026-07-02

- Fresh pre-migration dump: `/tmp/ew-premigration-20260702-1410.sql.gz` on VPS (735K, 57 CREATE TABLEs, "Dump completed on 2026-07-02 14:10:13")
- Durable copy: `~/backups/elite-writer/ew-premigration-20260702-1410.sql.gz` on VPS
- Pre-pull local SHA snapshot: `80f32391cf719e85cb38fd3de0599b6bb26a627a`
- Prod SHA (= post-pull local main HEAD): `a1d93436362ff6a76a59e5745e5cc267cd062dfd` ← rollback redeploy target
- 🔴 Finding: nightly backups broken since Jun 29 (20-byte empty gzips; last good Jun 28, 687K).
  Cause: `scripts/backup-db.sh` read `.env` (no DATABASE_URL there — it lives in `.env.production`)
  and used `--network host` (MySQL alias only resolves on `coolify` network).
  Fixed on this branch (+ `--no-tablespaces`); verified manually on VPS 2026-07-02 15:33 → 736K good dump.
  Fix reaches cron path when branch merges to main.

## Phase 2 record — 2026-07-02

- `drizzle/schema.ts` ported mysql-core → pg-core: 56 pgTable, 53 serial PKs (3 ws tables keep varchar(32) PKs), varchar-enums, jsonb, `$onUpdate`, tinyint flags → integer. Column/table names preserved exactly (camelCase quoted) so data copy is name-for-name.
- `drizzle.config.ts`: dialect `postgresql`, out `./drizzle-pg` (mysql journal in `./drizzle` untouched)
- `pnpm add postgres` (postgres 3.4.9); mysql2 stays until decommission
- Generated `drizzle-pg/0000_cultured_carmella_unuscione.sql`: 56 CREATE TABLE, 4 unique constraints (users.openId, user_settings.userId, template_sops.templateId, research_share.token), unique index `day_model_idx`
- Supabase: created database `elite_writer`, `CREATE EXTENSION vector` (pgvector), applied schema → 56/56 tables in `public`
- NOTE: serial PKs accept explicit id inserts during Phase 3 copy; run `setval` per sequence after

## Phase 3 record — 2026-07-02

- Full drift scan (MySQL information_schema vs PG) before copy. 3 findings:
  1. **wsRows.dbId** — MySQL STORED GENERATED column created at runtime by `ensureTables()`
     raw SQL (workspace.ts / proactiveAgents.ts), absent from drizzle schema. Blocked first
     copy attempt (fail-safe FATAL, no partial verify). Fixed: PG generated column
     `data->>'dbId'` + `idx_wsRows_dbId` applied to Supabase.
  2. **image_presets** — live MySQL table stale vs schema.ts (old columns description/
     isPublic/settings/usageCount; schema.ts has brandId/model/prompt* etc — drizzle
     migration never applied in prod). 0 rows, copy unaffected. PG side = schema.ts, correct.
  3. **intelligence_items.metadata** — in schema.ts/PG, missing in live MySQL (same cause).
     Copy unaffected (PG column fills NULL for 100 migrated rows).
- Runtime MySQL indexes replicated in PG: idx_wsPages_updated, idx_wsDatabases_updated,
  idx_wsRows_updated, idx_wsRows_dbId.
- Copy script: `scripts/migrate-mysql-to-pg.py` (run in throwaway dual-network container,
  creds via env from .env.production / supabase-db, never printed). Truncate-first =
  idempotent; skips PG generated columns; per-table count verify; sequence setval.
- **Row counts: 56/56 tables MATCH MySQL exactly** (incl. wsRows 580, content_studio_items 316,
  news_items 131, intelligence_items 100 — full table above is the truth reference).
- Spot checks: articles id 1 title/status ✓, research_items id 1 (riStatus inbox) ✓,
  users id 1 openId+admin ✓, articles_id_seq=9 ✓, content_studio_items_id_seq=316 ✓,
  wsRows.dbId populated 580/580 with 9 distinct values (= 9 wsDatabases) ✓.
- Rerun before Phase 6 cutover to pick up fresh prod data (script is idempotent).

## Phase 4 record — 2026-07-02

- Driver swap: `drizzle-orm/mysql2` → `drizzle-orm/postgres-js` in server/db.ts (only import site).
- All MySQL-specific SQL ported:
  - `ON DUPLICATE KEY UPDATE` → `ON CONFLICT ... DO UPDATE` (workspace push keeps the
    newest-wins `IF()` logic as `CASE WHEN EXCLUDED."updatedAt" >= ...`).
  - Drizzle `.onDuplicateKeyUpdate` → `.onConflictDoUpdate` with explicit targets
    (users.openId, template_sops.templateId, ai_usage day+model, feed_seen userId+urlHash).
  - `.$returningId()` (30 sites) and mysql2 `insertId` (22 sites + 3 in agents.ts) →
    `.returning({ id: table.id })`; test stub server/test/memoryDb.ts updated to match.
  - Runtime DDL (ensureTables / ensureWsTables / ensureFeedSeenTable / products articleId)
    rewritten in PG syntax with `IF NOT EXISTS`; inline INDEX → separate CREATE INDEX;
    dbId generated column now `data->>'dbId'`.
  - Result shapes: postgres-js returns rows directly — removed all `[rows, fields]`
    destructures; `JSON.stringify(id)` string literals (double quotes = identifiers in PG)
    → single-quoted escaped literals; camelCase identifiers quoted in all raw SQL.
  - feed_seen unique key (was runtime-created in MySQL, not in drizzle schema) added as
    `uq_feed_seen` unique index in Supabase + ensured at runtime.
- Dev-only cutover: local `.env` DATABASE_URL → Supabase through SSH tunnel
  (socat sidecar `ew-pg-tunnel` on VPS loopback 127.0.0.1:55432 + `ssh -L 55432`).
  Previous MySQL value kept commented in `.env`. Production `.env.production` UNTOUCHED.
- Gate: `tsc --noEmit` 0 errors · vitest 76/76 pass · `pnpm build` clean.
- Local flow test against Supabase (all verified in DB afterward):
  login ✓ (matched the migrated admin row via openId upsert) · list shows migrated
  articles ✓ · create article → id 10 (continues migrated seq after 9) ✓ · research
  query (academicSearch, 5 results) ✓ · research note → id 6 ✓ · update/save article ✓ ·
  workspace pull reads migrated data ✓ · workspace push upsert insert + conflict-update ✓.
  No DB errors in server logs (only benign IF NOT EXISTS notices).

## Phase log

- [x] Phase 0 discovery — 2026-07-02 (this file)
- [x] Phase 1 backup — 2026-07-02
- [x] Phase 2 schema port — 2026-07-02 (56/56 tables live in Supabase `elite_writer`)
- [x] Phase 3 data migration + verify — 2026-07-02 (56/56 counts match, spot checks pass)
- [x] Phase 4 app swap + gate + local flow test — 2026-07-02 (gate green, flows match MySQL)
- [ ] Phase 5 founder approval 🛑 ← WE ARE HERE
- [ ] Phase 6 cutover (rerun data copy for freshness, then prod DATABASE_URL swap)
