# ZimmWriter → Elite Writer Ingest

## Endpoint

`POST /api/ingest/zimmwriter`

Dual auth (either passes):

1. **HMAC** — header `x-ingest-signature` = `HMAC-SHA256(ZIMMWRITER_INGEST_SECRET, rawBody)` hex
2. **Token** — header `x-ingest-token` or query `?token=` = `ZIMMWRITER_INGEST_TOKEN`

## Schema mapping

| ZimmWriter field | `articles` column |
|---|---|
| webhook_name | `brandId` (lookup `brands` by name/slug) |
| title | `title` |
| markdown | `content`, `body_markdown` |
| html | `body_html` |
| excerpt | `excerpt` |
| category | `category` |
| tags | `tags` (jsonb) |
| image_url | `featured_image_url` |
| image_base64 | `featured_image_b64` |
| — | `source` = `zimmwriter` |
| — | `source_id` = sha256(webhook_name:slug\|title) |
| — | `status` = `draft`, `needs_scoring` = true |

Migration: `drizzle/0012_zimmwriter_ingest.sql`

## Smoke test

```bash
bash code/elite-writer-ingest/test-ingest.sh https://elitewriter.insightprofit.live <secret> [token]
```

## Env

Set `ZIMMWRITER_INGEST_SECRET` and `ZIMMWRITER_INGEST_TOKEN` in Infisical / `.env` (see `.env.production.template`).
