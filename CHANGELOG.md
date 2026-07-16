# Changelog

All notable operational and code changes to Elite Writer.

## 2026-07-16 — Customizable left navigation (drag, regroup, hide, per-user)

- New `user_nav_layout` table + `navLayout` router (get/save/reset), per user.
- AppLayout: a "Customize" toggle turns the sidebar into edit mode — drag items
  within a section, drag items between sections, drag whole sections to reorder,
  and hide/show items (dimmed inline with an eye toggle). "Reset" restores the
  code default. Layout saves to the server and syncs across devices.
- Canonical nav moved to `client/src/lib/nav-config.tsx`; `resolveLayout()`
  merges the saved layout over code so newly-shipped items always appear (a
  saved layout can never permanently hide a future feature). ⌘K palette still
  lists every destination regardless of customization.
- Verified live: hide persists + survives reload + removes the item; section
  reorder persists; reset restores default. Gate: tsc 0 · tests 87/87 · build clean.
- (Collapse-to-rail + section accordion already existed and are unchanged.)

## 2026-07-16 — Schema migrations now auto-apply at boot (permanent drift fix)

Root cause of both recent prod bugs (ZimmWriter #81 columns, saved_views):
deploys only rebuilt the container — nothing ever ran drizzle-pg SQL.

- `server/_core/migrations.ts`: at startup, before serving traffic, applies any
  not-yet-applied drizzle-pg migration in journal order; tracked in
  `ew_migrations`; one transaction per migration.
- Baseline-aware: an existing untracked DB gets the current set STAMPED (not
  re-run) — verified live against prod (stamped 0000/0001, applied 0). Fresh
  DBs build everything — verified on a scratch DB (57+19 statements, 58 tables).
- Fail-open: a migration error logs loudly + shows in `/api/health` as
  `migrations: {state:"error"}` — the app keeps serving on the current schema
  (no crash-loop). `migrations` state is now in health for outside monitoring.
- Dockerfile ships `drizzle-pg/` into the runtime image.
- POLICY: merging a PR that contains a drizzle-pg migration IS the approval to
  apply it — the founder migration gate moves to PR review.

## 2026-07-16 — Ops: migration 0001 applied, ZimmWriter armed, SSH postmortem

- **Migration 0001 applied to prod Supabase** (founder-approved): saved_views
  table, image altText/contentHash, the 13 ZimmWriter article columns. All
  IF NOT EXISTS; verified object-by-object. Saved views + drawer autosave +
  media fields confirmed working end-to-end against the live DB.
- **ZimmWriter webhook armed** (founder-approved): ZIMMWRITER_INGEST_TOKEN set
  in .env.production (token value never in chat/git; founder copy on Desktop),
  app container recreated. Verified live: 401 without token, 201 created with
  token, resend → exists (idempotent), probe article cleaned up.
- **SSH outage postmortem**: founder IP was never banned (fail2ban list checked,
  iptables clean, no CrowdSec) — outage was the local ISP/router blocking
  outbound port 22; cleared on its own. The two one-shot recovery blocks in
  deploy-poll.sh (PRs #86/#87) are removed — they were harmless no-ops.

## 2026-07-16 — ZimmWriter integration: full-functionality wiring

Verified the end-to-end path and closed three gaps:
- `/api/health` now reports `zimmwriterIngest` (true when SECRET or TOKEN is set)
  — standing rule: every integration gets a health boolean for outside checks.
- Queue surfaces the previously-dead `needsScoring` flag as a "Needs scoring"
  badge (auto-hides once an article is scored) + a "ZimmWriter" imported badge,
  so ingested drafts are visible and actionable (score via the existing Re-score).

## 2026-07-16 — Payload-style CMS admin UX (branch feat/admin-ux-cms)

In-app content management overhaul — no CMS platform adopted; the engine
(tRPC + drizzle + agents + Plate Writer) stays the single source of truth.

- **EditDrawer** — generic, config-driven side panel with debounced autosave
  (no Save button), field groups, save indicator, Open-in-Writer.
- **SavedViewBar** — per-user saved collection views (search/filter/sort/mode),
  on the Phase 1 savedViews router.
- **Media Library** (`/media`) — unified image grid, search, tag filter,
  drag-drop upload → R2 with content-hash dedup, multi-select delete,
  click-to-edit (name/alt text/tags). MediaPicker attaches article covers.
- **Rolled across 8 collections**: Queue + Library (articles), ContentStudio,
  Social, Ideas, Pitches, Research, Media — each gets row-click edit-in-panel +
  saved views. Existing lists, bulk actions, and Writer flow untouched.
- Server: data.articles.update gains excerpt/category/tags/featuredImageUrl;
  data.pitches.update gains publication/editor; library.images gains
  upload (R2+dedup) + update (name/altText/tags).
- Prior prod fixes shipped alongside: ZimmWriter PG column drift self-heal
  (#89) and the reconciling migration (#88).
- Gate: tsc 0 · vitest 87/87 · build clean. Live browser flow test deferred —
  blocked on the VPS SSH outage (dev server can't reach Supabase); verify
  post-merge against the real DB.

## 2026-07-06 — Issue #44 completion: shared list-selection on the 5 remaining pages

Wired `client/src/components/list-selection.tsx` (canonical Ideas.tsx usage) onto
ContentCalendar (bulk delete + set-status), Financial earnings (bulk delete),
Geo projects (bulk delete + select-all), Publications (local selection migrated to
shared hook, export/copy actions preserved, still non-destructive), Research references
(local plumbing migrated, page-scoped select-all + save-to-KB preserved).
Gate: tsc 0 · tests 87/87 · build clean. PR #85.

## 2026-07-03 — Infisical run scripts

- chore: add `pnpm *:secrets` Infisical wrappers for dev/test/build/start and ignore `.cursor/` in git.

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
- 2026-07-02 — fix: corrected gate template (auto typecheck, remove ponytail lint, add secrets-scan).

## 2026-07-02 — Issue #44: multi-select + bulk actions (branch `feat/issue-44-bulk-select`)

Extracted shared `useSelection` + `ListSelectionBar` from workspace `views.tsx` into
`client/src/components/list-selection.tsx` (PR #40 pattern). Wired delete + set-status
(or domain-equivalent bulk actions) on: Giststack, ContentInsights, ContentStudio,
Library, Interviews, Social. Verified/fixed: Queue (already complete), Research (already
had sort + bulk delete/KB), Pitches, Ideas, PulsePipeline (added bulk set-status + sort).
Assessed smaller views — Pipeline, ContentCalendar, Geo, Financial: not row-list UIs;
bulk select deferred. Gate: tsc 0 · tests 76/76 · build clean.
