#!/bin/bash
# SessionStart hook: install deps (if node project) + evergreen Infisical secrets.
# See CLAUDE.md and https://github.com/rtmendes/design-research docs/INFISICAL_EVERGREEN.md
set -uo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi
cd "$CLAUDE_PROJECT_DIR"
[ -f package.json ] && npm install --no-audit --no-fund || true
PROJECT_ID="${INFISICAL_PROJECT_ID:-75ce45d4-9209-45b0-a24d-a2078132f2f8}"
ENV_SLUG="${INFISICAL_ENV:-prod}"
if [ -n "${INFISICAL_CLIENT_ID:-}" ] && [ -n "${INFISICAL_CLIENT_SECRET:-}" ]; then
  command -v infisical >/dev/null 2>&1 || npm install -g @infisical/cli --no-audit --no-fund || true
  if command -v infisical >/dev/null 2>&1; then
    TOKEN="$(infisical login --method=universal-auth --client-id="$INFISICAL_CLIENT_ID" --client-secret="$INFISICAL_CLIENT_SECRET" --silent --plain 2>/dev/null)"
    if [ -n "$TOKEN" ] && INFISICAL_TOKEN="$TOKEN" infisical export --projectId "$PROJECT_ID" --env "$ENV_SLUG" --format=dotenv > .env.local.tmp 2>/dev/null; then
      mv .env.local.tmp .env.local
      [ -n "${CLAUDE_ENV_FILE:-}" ] && echo "export INFISICAL_TOKEN=\"$TOKEN\"" >> "$CLAUDE_ENV_FILE"
      echo "[hook] Infisical secrets exported to .env.local ($ENV_SLUG)"
    else
      rm -f .env.local.tmp; echo "[hook] Infisical export failed — continuing without secrets"
    fi
  fi
else
  echo "[hook] INFISICAL_CLIENT_ID/_SECRET not set in this environment — skipping secret fetch"
fi
exit 0
