# PRD — Payload-style Admin UX Overhaul

Status: approved to build (grill-me 2026-07-15). Branch `feat/admin-ux-overhaul`.

## Goal
Bring Payload/Airtable-grade content *management* into Elite Writer — without
adopting a second CMS. Keep the existing engine (tRPC + drizzle + agents +
Plate Writer) as the single source of truth; add a uniform management layer on
top: dense collection lists, a side-drawer edit panel, a real media library,
relation chips, and per-user saved views.

Why not Payload/Strapi: both are separate CMS platforms that would hold a second
copy of the articles and force rewiring every agent/pipeline off drizzle. The
value the founder wants is the *admin UX* — ~4 shared components on the current
stack, no platform tax, no second source of truth.

## Locked decisions (grill-me)
1. **Metadata drawer**, not full-body editor. Drawer edits everything *about* a
   record (title, status, publication, brand/product relations, SEO, sources,
   images, scores). Long-form article body stays in the existing Writer — drawer
   has an "Open in Writer" button. Short entities (studio/social/research/ideas/
   pitches) get their full body editable in the drawer since they're small.
2. **Keep both article pages** (Queue + Library) — each retrofitted with the same
   new components. No merge. (Revisit later if the two-page split still confuses.)
3. **Media library = full uploads.** Drag-drop → R2, thumbnails, dedupe, alt text,
   tags, browse/search, attach/detach to articles from inside the drawer.
4. **Autosave** in the drawer (debounced ~800ms, quiet "Saved" indicator, no Save
   button). List row reflects changes instantly.
5. **Saved views server-side** — new `saved_views` table `(userId, page, name,
   config jsonb)`: filters + sort + visible columns + view mode. Syncs devices.
6. **Collections in scope (8):** Queue, Library, ContentStudio, Research, Media
   (new), + Social, Ideas, Pitches. Out: Calendar, Geo, Financial, Publications
   (not document collections / static data).

## Architecture — shared building blocks

### `<CollectionList>` (generalizes the existing list-selection pattern)
One component driving every collection. Props: column defs, row→id, data,
current view config, handlers. Renders: dense table (Airtable rows) with column
picker, full-text search, filter chips, sortable headers, `list-selection`
multi-select + bulk bar, view-mode switch (list/gallery/kanban per UI_STANDARDS),
pagination >100. Row click → opens drawer. Does NOT replace pages — pages mount
it with their config.

### `<EditDrawer>` (shadcn sheet.tsx, right side, wide)
Field-group sections (Content / SEO / Publication / Pipeline / Media), sticky
meta sidebar (status, dates, scores, relations). Autosave per field via the
collection's existing tRPC update mutation (no new server writes invented).
Relation fields render as clickable chips (article↔brand↔product↔images).
"Open in Writer" for long-form. Esc / click-out closes.

### Media library (new page + drawer picker)
New `/media` page: unified grid over `generated_images` + `image_library`,
search, tag filter, drag-drop upload to R2 (reuse existing upload path), alt
text edit, dedupe on hash. Attach-picker component embeds in EditDrawer's Media
group.

### Saved views
`saved_views` table + tRPC CRUD router. View switcher on each `<CollectionList>`;
"Save current view" captures live filter/sort/columns/mode. Per user, per page.

## Schema changes (additive, one migration)
- `saved_views` new table: id serial, userId int, page varchar, name varchar,
  config jsonb, isDefault bool, createdAt/updatedAt.
- `generated_images.altText` + `image_library.altText` varchar null (drawer + a11y).
- `image_library.contentHash` varchar null + index (upload dedupe).
Nothing dropped. Existing agent write paths untouched.

## Non-goals
- No change to the Plate Writer, AI toolbar, agents, scoring, or pitch flywheel.
- No merge of Queue/Library (decision 2).
- No CMS platform, no second datastore.
- Calendar/Geo/Financial/Publications unchanged.

## Gate
tsc 0 · vitest green · build clean · local flow test (open each collection, edit
via drawer, autosave persists to DB, media upload lands in R2, saved view
round-trips). PR to main; founder merges.

## Build status (2026-07-16)
- [x] Phase 1 — saved_views table + router + media fields (PR #88, merged)
- [x] Phase 2/3 — EditDrawer (autosave) + SavedViewBar (branch feat/admin-ux-cms)
- [x] Phase 4 — Media library (/media): grid, search, tags, drag-drop R2 upload
      + content-hash dedup, click-to-edit; MediaPicker attaches article covers
- [x] Phase 5 — drawer + saved-views rolled across 8 collections: Queue,
      Library, ContentStudio, Social, Ideas, Pitches, Research, Media
- [x] Phase 6 — saved-views UI live on every wired collection
- Server: data.articles.update + excerpt/category/tags/featuredImageUrl;
  data.pitches.update + publication/editor; library.images + upload/update.
- Gate: tsc 0 · vitest 87/87 · build clean.
- NOT yet done: live browser flow test — blocked on the VPS SSH outage (dev
  server can't reach Supabase via the tunnel). Verify post-merge when the app
  runs against the real DB, or once SSH is restored.

Field-level notes (mutations that don't accept a field render it readonly, by
design — no silent data loss): Social.platform, Research reference
authors/doi/url. Everything else round-trips.

## Original rollout plan (one branch, staged commits)
1. Schema migration + saved_views router + media alt/hash fields.
2. `<CollectionList>` extracted from list-selection; Library adopts it first (proof).
3. `<EditDrawer>` + autosave; wire Library + Queue.
4. Media page + uploads + attach picker.
5. Roll CollectionList+Drawer across ContentStudio, Research, Social, Ideas, Pitches.
6. Saved views UI on all 8. Docs (UI_STANDARDS addendum) + CHANGELOG.
