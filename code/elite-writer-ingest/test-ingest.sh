#!/usr/bin/env bash
# Smoke-test ZimmWriter ingest against a running Elite Writer instance.
# Usage: bash code/elite-writer-ingest/test-ingest.sh <base-url> <secret> [token]
set -euo pipefail

BASE_URL="${1:?base URL required, e.g. https://elitewriter.insightprofit.live}"
SECRET="${2:?HMAC secret required}"
TOKEN="${3:-}"

PAYLOAD='{"webhook_name":"second_spring","title":"What Is Perimenopause? A Plain-English Guide","markdown":"## What'\''s Actually Happening\nA plain guide.","html":"<h2>What'\''s Actually Happening</h2><p>A plain guide.</p>","excerpt":"A plain-English guide.","image_base64":false,"category":"Perimenopause 101","image_url":false,"slug":"what-is-perimenopause","tags":["perimenopause","midlife"]}'

SIG=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
URL="${BASE_URL%/}/api/ingest/zimmwriter"

echo "POST $URL (HMAC)"
curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-ingest-signature: $SIG" \
  -d "$PAYLOAD" | jq .

echo "POST $URL (idempotent replay)"
curl -sS -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-ingest-signature: $SIG" \
  -d "$PAYLOAD" | jq .

if [[ -n "$TOKEN" ]]; then
  echo "POST $URL?token=… (token auth)"
  curl -sS -X POST "${URL}?token=${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" | jq .
fi
