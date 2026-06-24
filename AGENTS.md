# Elite Writer v5 — AI Agent Instructions

> **THIS IS THE CANONICAL ELITE WRITER REPO.** The old `elite-writer-app` repo is archived for reference only. All development happens here.

## Identity
- **Repo:** `rtmendes/elite-writer-v5`
- **Live URL:** `https://elitewriter.insightprofit.live` (Oracle VPS)
- **Command Center iframe:** `command.insightprofit.live/#/iframe-elite-writer`
- **Stack:** React 18 + Vite + TypeScript + Drizzle ORM + Express + Mantine/Radix/Tailwind
- **Database:** PostgreSQL via Drizzle ORM (Supabase PG17)
- **Editor:** BlockNote rich text editor

## Setup
```bash
bun install
bun run dev     # local dev server (Vite)
bun run build   # production build
bun run db:push # push Drizzle schema to database
```

## Critical Rules for ALL AI Agents

### DO NOT
- **Never delete or overwrite** `client/`, `server/`, `drizzle/`, or `shared/` directories
- **Never replace** the full application with stubs, demos, or placeholder pages
- **Never remove** working features to "simplify" or "modernize"
- **Never touch** `.env` files or commit secrets
- **Never deploy** to `elite-writer-app.insightprofit.live` — that is the archived legacy version

### DO
- Work in feature branches, never push directly to `main`
- Run `bun run build` before committing
- Test database migrations locally before pushing
- Preserve all existing functionality when adding new features
- Follow the existing code patterns (Drizzle for DB, Express routers, React components)

## Architecture
```
client/          # React frontend (Vite)
  src/
    pages/       # Page components
    components/  # Shared UI components
    hooks/       # Custom React hooks
    lib/         # Utilities, API client
server/          # Express backend
  index.ts       # Server entry
  routers.ts     # Route registry
  db.ts          # Database connection
  storage.ts     # Storage layer
  *.router.ts    # Feature routers
drizzle/         # Database schema & migrations
  schema.ts      # Drizzle schema
  relations.ts   # Table relations
shared/          # Shared types & constants
data/            # Publications CSV databases
docs/            # PRDs, roadmap, architecture
```

## Key Features (DO NOT REMOVE)
1. Content Command HQ — publication matching, pitch generation
2. Writing Editor — BlockNote-based rich text editor
3. AI Scoring — article quality scoring pipeline
4. Publications Database — 174 target publications with pay rates
5. Kanban Pipeline — 8-column project tracking
6. Financial Accelerator — $100K-$200K monetization engine
7. Research Hub — academic search APIs (OpenAlex, CrossRef, Semantic Scholar)
8. Video Scripts — AI video script generation
9. Data Visualization — Visual Capitalist-style infographics
10. Offer Creation — product/service offer builder
11. RAG Integration — KB, memory, and content context wiring
12. OpenRouter Migration — multi-provider LLM routing

## History
- **May 5-17, 2026:** Daily Cursor agent updates (Content Command HQ, RAG, Pulse Pipeline, Supabase sync, OpenRouter)
- **May 19, 2026:** CB-013d Cursor dispatch — Writing Studio Aesthetic upgrade (PR #8 merged)
- **May 21, 2026:** Consolidated as canonical repo. Old `elite-writer-app` archived.

## Cursor Cloud specific instructions

The Cursor Cloud update script runs `pnpm install` in this repo on startup, so dependencies are already installed. Standard commands live in `package.json` (`dev`, `build`, `check`, `lint`, `test`, `db:push`) and `README.md`. Notes below are the non-obvious gotchas only.

- **Package manager is pnpm, runtime is Node 22.** Use `pnpm`, not `bun` — the `## Setup` section above is stale. The `bun.lock` in the repo is ignored; `pnpm-lock.yaml` + `packageManager: pnpm@10.4.1` are authoritative. (The ignored build scripts warning from `pnpm install` is harmless — `pnpm build` and `pnpm dev` both work without approving them.)
- **One process serves everything.** `pnpm dev` runs Express with Vite in middleware mode on `http://0.0.0.0:3000` (auto-bumps to the next free port if 3000 is busy). There is no separate frontend/backend dev server.
- **Database is MySQL, not Postgres/Supabase.** Despite the `## Identity` section, the schema (`drizzle/schema.ts`) and driver (`mysql2`) are MySQL. The app boots and serves the UI with no DB, but auth and all persistence need one. In cloud, a local MariaDB (MySQL-compatible) works: create a `elite_writer` db + user and set `DATABASE_URL=mysql://user:pass@127.0.0.1:3306/elite_writer` in a gitignored `.env` (also set `JWT_SECRET`). MariaDB has no systemd here — start it with `sudo mariadbd-safe &`.
- **Create the schema with `npx drizzle-kit push`, NOT `pnpm db:push`.** The committed migration journal (`drizzle/meta/_journal.json`) only lists `0000`–`0002` while migration SQL files go up to `0008`, so `pnpm db:push` (= `drizzle-kit generate && drizzle-kit migrate`) generates a spurious migration and fails to apply. `npx drizzle-kit push` syncs `schema.ts` directly and creates all 45 tables. Do not commit any migration/journal files it may touch.
- **Default local login:** `admin@elitewriter.app` / `admin` (used whenever `ADMIN_PASSWORD_HASH` is unset; see `server/_core/sdk.ts`).
- **Browser login needs HTTPS.** The session cookie is `SameSite=None` and only gets the `Secure` flag when the request is HTTPS (or carries `x-forwarded-proto: https`; see `server/_core/cookies.ts`). Chrome silently drops a `SameSite=None` cookie without `Secure`, so logging in over plain `http://localhost:3000` loops back to the login page. For browser/UI testing, front the dev server with a TLS proxy that adds `x-forwarded-proto: https` and visit over `https://`. API/`curl` testing is unaffected over http.
- AI/news/image features are key-gated and degrade gracefully when their env vars are missing (full list in `server/_core/env.ts`); none are needed to run the app or exercise core CRUD (ideas, articles, brands, publications, etc.).
