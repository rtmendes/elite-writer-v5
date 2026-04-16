# Elite Writer V5 Upgrade TODO

## Completed
- [x] Upgrade to full-stack (web-db-user) with tRPC, Drizzle ORM, MySQL, OAuth
- [x] Push database schema — 9 tables: ideas, articles, pitches, research_notes, brands, products, earnings, intelligence_items, users
- [x] Build backend AI router with 7 tRPC endpoints (score, draft, pitch, research, ideas, dailyBrief, summarize)
- [x] Connect all frontend AI buttons to backend LLM endpoints (Gemini 2.5 Flash, no API keys needed)
- [x] Add drag-and-drop Kanban board to Ideas page (6 stages)
- [x] Add CSV export to Publications (176 publications)
- [x] Auto-generate tailored pitch emails for matched publications
- [x] Build tRPC CRUD routes for all data entities
- [x] Wire frontend pages to sync mutations to MySQL (Writer, Ideas, Pitches, Research, Brands, Financial)
- [x] Add DB hydration hook — loads persisted data from MySQL on mount for authenticated users
- [x] Write vitest tests — 13 tests passing (AI router: 3, auth: 1, data router: 9)

## Requires User Action
- [ ] End-to-end persistence test (create → reload → verify data survives) — requires user to log in and test the authenticated flow
- [ ] Teable integration — deferred per user decision, can be added later as a sync layer
