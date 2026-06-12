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
- Paid services cost-logged to record_cost_event (command center / CFO agent)
- Every integration surfaced as a boolean in /api/health
- AI calls server-side, budget-capped, recorded in the AI Ledger

## Status (workspace module)
- Table view: search ✓ filter ✓ sort ✓ multi-select+bulk ✓
- Kanban/Gallery/List: search ✓ filter ✓ sort (via toolbar) ✓ — multi-select TODO
- v5 core pages (Publications/Giststack/etc.): partial — audit tracked separately
