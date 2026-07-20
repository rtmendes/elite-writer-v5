#!/usr/bin/env bash
# Evergreen env wrapper: `scripts/with-env.sh <command...>`
# Resolves secrets in this order, then execs the command with them injected:
#   1. INFISICAL_TOKEN                          — pre-issued Infisical access token
#   2. INFISICAL_CLIENT_ID + _CLIENT_SECRET     — machine identity (Universal Auth)
#   3. an interactive `infisical login` session — dev laptops
#   4. .env.local                               — legacy fallback
# See docs/INFISICAL_EVERGREEN.md for the one-time setup per surface.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ID="${INFISICAL_PROJECT_ID:-75ce45d4-9209-45b0-a24d-a2078132f2f8}"
ENV_SLUG="${INFISICAL_ENV:-prod}"

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/with-env.sh <command...>" >&2
  exit 2
fi

run_via_infisical() {
  exec infisical run --projectId "$PROJECT_ID" --env "$ENV_SLUG" -- "$@"
}

if command -v infisical >/dev/null 2>&1; then
  if [ -n "${INFISICAL_TOKEN:-}" ]; then
    run_via_infisical "$@"
  fi
  if [ -n "${INFISICAL_CLIENT_ID:-}" ] && [ -n "${INFISICAL_CLIENT_SECRET:-}" ]; then
    INFISICAL_TOKEN="$(infisical login --method=universal-auth \
      --client-id="$INFISICAL_CLIENT_ID" \
      --client-secret="$INFISICAL_CLIENT_SECRET" \
      --silent --plain)"
    export INFISICAL_TOKEN
    run_via_infisical "$@"
  fi
  # Interactive user session (laptop after a one-time `infisical login`).
  if infisical run --projectId "$PROJECT_ID" --env "$ENV_SLUG" -- true >/dev/null 2>&1; then
    run_via_infisical "$@"
  fi
fi

if [ -f "$REPO_ROOT/.env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_ROOT/.env.local"
  set +a
  exec "$@"
fi

echo "with-env.sh: no Infisical credentials found and no .env.local fallback." >&2
echo "  -> see docs/INFISICAL_EVERGREEN.md" >&2
exit 1
