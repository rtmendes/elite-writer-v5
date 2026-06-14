# Cost Sources

Every external/integrated service must have a way to *see* its cost. This file
registers each source, the method used to capture spend, and a **cost coverage**
flag. Method is chosen in this order:

1. **native** — provider exposes a cost/usage API → log to `record_cost_event`
2. **wrap** — no native API → the central `record_cost_event` call wraps the spend
3. **browser** — neither → `agent-browser` scrapes the provider's billing dashboard on a schedule

| Source | Method | Cost coverage | `/api/health` flag | Notes |
| --- | --- | --- | --- | --- |
| OpenRouter (LLM) | wrap | ✅ covered | `openrouter` | Free-first; per-call spend wrapped to `record_cost_event` / AI Ledger |
| Cloudflare R2 (assets) | browser | ⚠️ planned | `r2` | Storage/egress read from R2 billing dashboard |
| Redis | n/a | ✅ covered | `redis` | Self-hosted on VPS — no marginal cost |
| NewsAPI / GNews | wrap | ⚠️ planned | `newsapi` | Free tier; wrap on paid upgrade |
| Slack (webhook) | n/a | ✅ covered | `slack` | Free webhook — no marginal cost |
| Exa (search) | wrap | ⚠️ planned | `exa` | Per-search spend wrapped to `record_cost_event` |
| **Supabase Realtime (collab)** | **n/a** | **✅ covered** | **`supabaseRealtime`** | **Self-hosted Supabase on the Oracle VPS — no per-message/per-connection fee. Cost is capacity-bound (VPS CPU/RAM), not usage-billed, so there is no marginal spend to meter. If ever migrated to Supabase Cloud, switch method to `browser` (scrape Supabase billing) and add a `record_cost_event` wrap.** |

## Coverage legend
- ✅ **covered** — spend is visible (logged, or zero marginal cost by design)
- ⚠️ **planned** — integration live; cost path scoped but not yet wired
- ❌ **none** — must not ship; every integration needs a path

## Why Supabase Realtime is "covered" with no meter
Slice 4 runs realtime collaboration on the **self-hosted** Supabase already on the
Oracle VPS (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`). Broadcast + presence
traffic rides the VPS we already pay for — there is no per-event or per-seat
charge to track. The only "cost" is server load, which the VPS budget already
accounts for. The client throttles outbound events (`eventsPerSecond: 5`) to keep
that load light. The `supabaseRealtime` boolean in `/api/health` lets outside
checks confirm the integration is configured.
