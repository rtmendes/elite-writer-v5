# Changelog

All notable operational and code changes to Elite Writer.

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
