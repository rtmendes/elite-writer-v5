# Changelog

All notable operational and code changes to Elite Writer.

## 2026-07-02 — Multi-select + bulk actions on every collection view (Issue #44)

Shared `useSelection` hook (`client/src/hooks/useSelection.ts`) + `SelectionBar` (`client/src/components/SelectionBar.tsx`) — page-level twins of the workspace pattern, Queue-style visuals. Additive only; nothing deleted.

- Wired: ContentInsights (bulk delete + save/unsave), Giststack (bulk save + create-ideas — items have no server persistence, so delete/status impossible without new scope), ContentStudio (+sort), Social (+sort), Library (3 tabs, delete-only — no status fields), Interviews (+sort, delete+status).
- Sort added where missing: Research (asc→desc→none cycle), ContentStudio, Social, Interviews.
- Verified "already-done" claims: Queue TRUE (untouched) · Publications TRUE (static dataset — added missing gallery select-all) · Pitches PARTIAL (added select-all, bulk set-status, confirm) · Ideas PARTIAL (list view had no checkboxes — fixed; added select-all, set-status, confirm) · **PulsePipeline FALSE** (nothing existed — fully wired; no delete mutation on pulse router, "skipped" status is the archive path).
- Assessed smaller views: ContentCalendar + Geo projects + Financial earnings got bulk actions; Pipeline is a single-run tool with no collection — skipped by design.
- Gate: tsc 0 errors · tests pass · build clean.

## 2026-07-02 — Domain standardization

Canonical domain: **elitewriter.insightprofit.live** (VPS, Docker deploy via GitHub main poll).

- Verified canonical: `https://elitewriter.insightprofit.live/api/health` → 200 with all integrations.
- Verified hollow shells: `elite-writer.insightprofit.live` and `elite-writer-app.insightprofit.live` → 404 (empty Vercel deployments).
- Detached via Vercel API:
  - `elite-writer.insightprofit.live` removed from Vercel project `elite-writer-v5`.
  - `elite-writer-app.insightprofit.live` removed from Vercel project `elite-writer-app`.
  - `*.vercel.app` URLs kept on both projects.
- Cloudflare DNS: no API token available locally or on VPS — 3 dead records left for manual deletion (see founder note in session report): CNAME `elite-writer`, CNAME `elite-writer-app`, TXT `_vercel` entry `vc-domain-verify=elite-writer-app.insightprofit.live,392d…`.
- Origin-IP privacy: `elitewriter.insightprofit.live` resolves to Cloudflare proxy IPs (104.21.x / 172.67.x) — proxied, origin hidden. ✅
- Note for later session (different repo): Command Center nav should reference `elitewriter.insightprofit.live`.

## 2026-07-02 — Supabase migration (in progress, branch `feat/supabase-migration`)

- Phase 0 (discovery) complete: 56 tables inventoried, live MySQL row counts recorded in MIGRATION_NOTES.md (truth for post-migration verify).
- Phase 1 (backups) complete: mysqldump gzip `/tmp/ew-premigration-20260702-1410.sql.gz` (735K) + durable copy `~/backups/elite-writer/` on VPS. Pre-pull SHA `80f3239`, prod SHA `a1d9343`.
- Found: nightly backup script broken since Jun 29 (reads `.env` instead of `.env.production`, wrong docker network) — fix included in this branch.
- Phase 2 (schema) complete: drizzle schema ported mysql-core → pg-core (56 tables, serial PKs, varchar-enums, jsonb, `$onUpdate`); Postgres migrations generated to `drizzle-pg/`; `elite_writer` DB created on self-hosted Supabase with pgvector; 56/56 tables applied. `postgres` driver added. `scripts/backup-db.sh` fixed (.env.production, coolify network, --no-tablespaces) — verified manually on VPS (736K dump).
- Phase 3 (data) complete: full MySQL↔PG drift scan (found runtime-created `wsRows.dbId` generated column — replicated in PG with `data->>'dbId'` + index; 2 harmless stale-MySQL findings documented); all data copied via `scripts/migrate-mysql-to-pg.py`; **56/56 table row counts match exactly**; spot checks + sequence resets verified. MySQL untouched.
- Phase 4 (app swap) complete: driver → `drizzle-orm/postgres-js`; every MySQL-specific SQL site ported (`ON DUPLICATE`→`ON CONFLICT`, `$returningId`/`insertId`→`.returning()`, runtime DDL, result shapes, identifier quoting). Gate green (tsc 0 · tests 76/76 · build clean). Local flow test against Supabase: login, create article, research query, save, workspace sync — all pass, sequences continue from migrated data. Dev-only DATABASE_URL swap; production untouched.
- Phase 5: founder approved cutover same day.
- **Phase 6 CUTOVER complete — 2026-07-02 16:36 UTC**: fresh backup → final data copy (56/56 match again) → prod DATABASE_URL → Supabase → PR #76 merged (`adb651a`) → cron deploy → verified (both docker networks, live PG connections, site 200, real login write landed in Postgres). MySQL left running untouched as hot rollback for 24-48h. Rollback: restore `.env.production.pre-supabase-backup` + redeploy `a1d9343`.
- 2026-07-02 — Foundation finish: added PRD.md, SOP.md, CLAUDE.md-infisical, package.json-infisical (standard docs + Infisical wiring).
