# Elite Writer V5 Upgrade TODO

## Completed
- [x] Upgrade to full-stack (web-db-user) with tRPC, Drizzle ORM, MySQL, OAuth
- [x] Push database schema — 9 tables: ideas, articles, pitches, research_notes, brands, products, earnings, intelligence_items, users
- [x] Build backend AI router with 7 tRPC endpoints (score, draft, pitch, research, ideas, dailyBrief, summarize)
- [x] Connect all frontend AI buttons to backend LLM endpoints (Gemini 2.5 Flash, no API keys needed)
- [x] Add drag-and-drop Kanban board to Ideas page (6 stages: Idea → Researching → Drafting → Scoring → Pitching → Published)
- [x] Add CSV export to Publications (176 publications)
- [x] Auto-generate tailored pitch emails for matched publications
- [x] Build tRPC CRUD routes for all data entities (ideas, articles, pitches, research, brands, products, earnings, intelligence)
- [x] Wire frontend pages to sync mutations to MySQL (Writer, Ideas, Pitches, Research, Brands, Financial)
- [x] Add DB hydration hook — loads persisted data from MySQL on mount for authenticated users
- [x] Merge DB data with local state in AppContext (DB-first with local fallback)
- [x] Write vitest tests for AI router endpoints (4 tests passing)

## Deferred
- [ ] Teable integration (user chose built-in MySQL for now to save tokens)
- [ ] Full end-to-end persistence verification (create → reload → data survives) — requires user login to test authenticated flow
