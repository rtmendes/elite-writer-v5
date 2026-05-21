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
