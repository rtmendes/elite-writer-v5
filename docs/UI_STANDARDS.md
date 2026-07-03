# UI/UX Standards — applies to EVERY view in this app (and all InsightProfit apps)

Owner: Rashida. These are standing expectations — do not ship a view that
violates them. The canonical copy lives in `~/.claude/rules/elitewriter.md`
on the operator's machine; keep the two in sync.

## Every list / table / grid / kanban / gallery view MUST have
- [ ] Full-text search
- [ ] Filterable fields
- [ ] Sortable columns (click header)
- [ ] Row/card multi-select with bulk actions (delete + set-status minimum)
- [ ] Pagination/virtualization past ~100 rows
- [ ] Mobile card layout < 768px, touch targets ≥ 44px
- [ ] Loading skeleton, error-with-retry, descriptive empty state
- [ ] Real data, real logos, clickable URLs

## Visual system
- Quiet-luxury palette (cool slate + antique-gold accent), light + dark mode
- Lora for display headings, Inter for UI
- Tags/pills use the token color ramps; no raw hex in components

## Platform
- FREE-FIRST MODEL POLICY: every AI task defaults to free LLMs (OpenRouter :free);
  paid models are never a default — explicit override or fallback-ladder last rung only.
  Quality comes from injected expert Skills/SOPs, not bigger models.
- Every AI-agent app ships: (a) operator-editable "Agent Skills & SOPs" database
  (SOP per agent/stage, injected into every call, live edits); (b) "Model Quality
  Watch" — recurring free-vs-paid benchmark; UPGRADE alert when paid beats free
  by ≥1.5 points or free scores under 7/10 against calibration anchors.
- Paid services cost-logged to record_cost_event (command center / CFO agent)
- Every integration surfaced as a boolean in /api/health
- AI calls server-side, budget-capped, recorded in the AI Ledger

## Status (workspace module)
- Table view: search ✓ filter ✓ sort ✓ multi-select+bulk ✓
- Kanban/Gallery/List: search ✓ filter ✓ sort ✓ multi-select+bulk ✓ (PR #40)

## Status (v5 core pages — marker audit June 12, 2026; bulk-select pass July 2, 2026 — Issue #44)
Grep-marker audit (search/filter, sort, multi-select usage per page). Multi-select with
bulk actions (delete + set-status minimum) rolled out via shared `useSelection` +
`ListSelectionBar` (`client/src/components/list-selection.tsx`, extracted from PR #40).

| Page | Search/Filter | Sort | Multi-select | Bulk actions | Notes |
|---|---|---|---|---|---|
| Agents | ✓ | ✓ | ✓ | ✓ | compliant |
| Pitches | ✓ | ✓ | ✓ | ✓ | delete + set-status |
| Publications | ✓ | ✓ | ✓ | partial | export/copy (static ref DB — no delete) |
| PulsePipeline | ✓ | ✓ | ✓ | partial | set-status only (no delete API) |
| Ideas | ✓ | ✓ | ✓ | ✓ | delete + set-status |
| Giststack | ✓ | ✓ | ✓ | partial | save/unsave + create ideas (ephemeral feed) |
| Queue | ✓ | ✓ | ✓ | ✓ | full bulk bar (pre-existing) |
| Research | ✓ | ✓ | ✓ | partial | delete + save-to-KB (no status field) |
| ContentInsights | ✓ | ✓ | ✓ | ✓ | delete + mark saved/unsaved |
| ContentStudio | ✓ | ✓ | ✓ | ✓ | delete + set-status |
| Library | ✓ | ✓ | ✓ | ✓ | delete (+ star toggle on content tab) |
| Interviews | ✓ | ✓ | ✓ | ✓ | delete + set-status |
| Social | ✓ | ✓ | ✓ | ✓ | delete + set-status (posts tab) |
| Pipeline | partial | ✗ | ✗ | n/a | single-run wizard — not a list view |
| ContentCalendar | partial | ✗ | ✗ | n/a | calendar grid — per-day events, not row list |
| Geo | partial | ✗ | ✗ | n/a | project cards + tool tabs — assess per-tab later |
| Financial | partial | ✗ | ✗ | n/a | earnings ledger + dashboards — not bulk-list |
| Brands / BrandVoice | weak | ✗ | ✗ | ✗ | data entry first (brands empty) |
| Dashboard / Home / Settings / Login / Writer | n/a | n/a | n/a | n/a | not list views |

## Imported from Manus (June 12, 2026 — deduped from ~95 knowledge entries)

### UI/UX
- Default data view = tabular list rows (Airtable-style): one row per item, all info visible, sortable/filterable. Universal search across all projects/folders/tags/content; multi-select; drag-and-drop organizing; clickable tags that filter related content.
- Left-hand nav holds projects/folders/subfolders with accordion nesting (Notion-style); add/delete/tag/sort/filter available in every area; breadcrumbs everywhere (never rely on browser back); a small "what does this section do" explainer area at the bottom-left of the nav.
- High-contrast color schemes (especially mobile/older audiences) — luxurious + bold, readable above all; for science/math topics use light ivory + caramel tones, not dark.
- Data in/out everywhere: CSV download, send-to-Google-Sheet, copy content, bulk or single upload (doc/link/video), bulk-import reference URLs from list/CSV; "Remember API key" checkboxes; job history with re-download; last-run date/time stamps on saved searches + scheduled re-runs.
- Settings screens include a dedicated integrations area. Dashboards: every widget is live and links to its feature. Save-project-as-template. Custom tags on assets. Usage/analytics visible to the operator.
- Hyperrealistic thematic images on all page sections ("bring it to life"); demographics in imagery exactly congruent with the audience described; no "AI slop" — for professional/technical audiences images must be precise and accurate.

### Writing & content
- Structured-data outputs as interactive HTML pages or paste-ready tables (Google Sheets-safe), not static docs. Strategy/tactic extraction = multi-column checklist tables: Tactic, Expected Input, Expected Output, Use Case, click-by-click SOP, 9th-grade-level explanation.
- Specialized templates per format: short-form video ads (<30s TikTok), VSLs (Fladlien/Kern style), advertorials (Haddad/Sultanic style), topical-authority articles for Business Insider/Forbes-class outlets. Forbes always included in freelance-writing outputs.
- Publication info organized as detailed tables (audience, style guide, editor preferences, editorial demands) feeding custom article templates and per-publication AI agents; article ideas sorted by acceptance likelihood and pay.
- Perimenopause projects: no specific health claims — describe symptom impact on women's lives; never medical terms like "prescription" (use relief/recommendation/framework); 1990s-Oprah community engagement style; target women 40-55; topical-authority clusters (600-topic pillar tables); "daily dopamine habit" app design.
- Spiritual/personal-growth tone: loving and supportive (Franklin Covey-style planning voice), never militaristic ("war room", "campaigns" banned); faith app recommendation voice = TD Jakes × Joe Hudson × Jordan Peterson blend without naming them.
- Educational kids' content: entertaining, age-appropriate, no foul language, ~3-minute visual stories; characters reflect high diversity (African American girl & boy, Asian, Hispanic) as a core design requirement.
- Personal-transformation tools incorporate Joe Hudson methodology (get unstuck, reframe hard decisions into easy choices) as signature innovation. Remove guru personal branding (e.g. "Hormozi") — keep methods, use proprietary naming.
- Audio = high-quality natural US-English voices (ElevenLabs-grade); never robotic.

### Workflow & business
- Confirm before proceeding: ask several clarifying questions and get confirmation before building big things.
- Content/websites stay private until explicit approval; previews before permanent deploys; permanent hosting with stable URLs once approved; report raw error logs verbatim when deploys fail.
- Digital-product economics: target ~90% margin, low fixed costs, low CPA, automated fulfillment (no sales calls); distinct target markets get separate offers/sites — never combined.
- Web scraping: measured pace (never all at once), batches of ~50, cumulative CSV + per-batch list.
- Intelligence tools pull from YouTube, TikTok, Amazon reviews, Reddit into one canvas workspace; split-pane data+comments view; saved/bookmarkable comments with collections + share links; sentiment/keyword filters; persistent saved searches with scheduled refresh.
- Supabase (self-hosted) is the default persistence/sync layer — wire it after the build works, then keep everything synced to it.

