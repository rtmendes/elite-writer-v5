# Elite Writer V5 — Technical Infrastructure Spec

> Authoritative infra reference. Update this file (not ad-hoc chat) when infra changes.

---

## Deployment Environment

| Item | Value |
|---|---|
| VPS | Oracle ARM Free Tier — `129.213.162.114` |
| App container | `elite-writer-v5` |
| Health endpoint | `https://elitewriter.insightprofit.live/api/health` |
| Live URL | `https://elitewriter.insightprofit.live` |
| Reverse proxy | **Traefik** (Coolify-managed) — terminates TLS, routes domain → container port 3000 |

> ⚠️ Port 3000 on the VPS host is **Wiki.js**, NOT Elite Writer. Never route directly to `:3000`.
> All traffic goes through Traefik on the `coolify` Docker network.

---

## Database

| Item | Value |
|---|---|
| MySQL container | `thepopebot-mysql` (shared; also used by thepopebot and other apps) |
| Database name | **`elite_writer`** |
| Host (inside coolify network) | `10.0.2.2:3306` (host-gateway alias, or container name if on same Docker network) |
| ORM | Drizzle ORM (MySQL dialect) |
| Schema file | `drizzle/schema.ts` |
| Migration dir | `drizzle/` (SQL files `0000_*.sql` → `0011_*.sql`) |
| Connection var | `DATABASE_URL` in `.env.production` on VPS |

**Critical:** Always confirm `DATABASE_URL` points to `elite_writer` — not another DB in the shared container — before running any migration.

### Known Databases in thepopebot-mysql
- `elite_writer` — EW production database (CORRECT target)
- `thepopebot` (or similar) — thepopebot app database (do NOT touch)
- See stray-DB cleanup section in `_founder-os/SESSION_C_INFRA_CLEANUP.md` for the P3a migration incident

---

## Docker Compose

```yaml
# Key facts extracted from docker-compose.yml
container_name: elite-writer-v5
networks:   [coolify]          # external, Traefik-managed
redis:      elite-writer-redis # BullMQ backing store
env_file:   .env.production    # on VPS only, never committed
```

Network labels route `elitewriter.insightprofit.live` → container port `3000` via Traefik.

---

## Migration Discipline

| Rule | Detail |
|---|---|
| Generate | `drizzle-kit generate` — creates new SQL files locally |
| Apply (dev) | `drizzle-kit migrate` against local DB |
| Apply (prod) | Manual approval gate → `drizzle-kit migrate` on VPS with mysqldump backup first |
| **FORBIDDEN on prod** | `drizzle-kit push` — bypasses journal, unsafe |

Migration files must be committed before deploy. Never push schema changes without a prior `mysqldump` backup.

---

## Stray-DB Cleanup (Queued — awaiting approval)

**Incident:** P3a migration `0010_research_article_bridge.sql` may have run against the wrong database in `thepopebot-mysql` before `DATABASE_URL` was confirmed as `elite_writer`. This would create stray tables in that DB.

**Tables to verify (should be empty + unused in the wrong DB):**
- `research_series`
- `research_share`
- `article_tag`

**Verification SQL (run on VPS inside thepopebot-mysql):**
```sql
-- Identify which DB has stray tables (run as root / admin)
SELECT table_schema, table_name, table_rows
FROM information_schema.tables
WHERE table_name IN ('research_series', 'research_share', 'article_tag')
  AND table_schema != 'elite_writer';

-- Confirm rows = 0 before drop
SELECT 'research_series' AS tbl, COUNT(*) FROM <stray_db>.research_series
UNION ALL SELECT 'research_share', COUNT(*) FROM <stray_db>.research_share
UNION ALL SELECT 'article_tag', COUNT(*) FROM <stray_db>.article_tag;
```

**Proposed DROP (run only after backup + row-count confirmed = 0):**
```sql
-- Back up first: mysqldump <stray_db> research_series research_share article_tag > stray_tables_backup_$(date +%Y%m%d).sql
DROP TABLE IF EXISTS `<stray_db>`.`research_series`;
DROP TABLE IF EXISTS `<stray_db>`.`article_tag`;
DROP TABLE IF EXISTS `<stray_db>`.`research_share`;
```

**Status:** 🟡 Queued for founder approval. Replace `<stray_db>` with the actual database name found by the `information_schema` query above.

---

## Drizzle Migration Journal Baseline (Queued — awaiting approval)

The repo journal (`drizzle/meta/_journal.json`) only tracks migrations 0000–0004.  
Migrations 0005–0011 exist as SQL files and are applied in prod but not recorded in the journal.

**Prepared journal fix:** See `drizzle/meta/_journal_baseline.json` (safe to commit to repo — does not touch the DB).

**DB-side baseline:** The `__drizzle_migrations` table in `elite_writer` also needs records for 0005–0011 so `drizzle-kit migrate` won't try to re-apply them. Prepared SQL: see `scripts/baseline_migrations.sql`.

**Status:** 🟡 Queued. Journal file update is safe; DB-side insert requires VPS access + approval.

---

## Redis

```
container: elite-writer-redis
image:     redis:7-alpine
purpose:   BullMQ job queue (proactive agent loop, AI Ledger)
maxmem:    256MB, noeviction policy
```

---

## Environment Variables

- Live location: `.env.production` on the VPS (managed via `ip-os secrets sync --vps`)
- Never committed to repo
- 66 vars as of 2026-06-30 (see `ELITE_WRITER_ENV_KEYS_FIX.md`)
- Key vars: `DATABASE_URL`, `JWT_SECRET`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `REDIS_URL`
