#!/usr/bin/env bash
# pre-pr-gate.sh — InsightProfit Lane Gate
# Run before any merge. Exits 1 on any failure.
# Reads .gate.json at repo root for per-repo config.
# Usage: bash scripts/pre-pr-gate.sh [path/to/repo] [--env-only]
#   --env-only  Skip typecheck/test/build/secrets-scan; run env-guard only.
#               Use on VPS where node_modules may not be writable.

set -euo pipefail

ENV_ONLY=false
REPO_DIR=""
for arg in "$@"; do
  case "$arg" in
    --env-only) ENV_ONLY=true ;;
    *) REPO_DIR="$arg" ;;
  esac
done
REPO_DIR="${REPO_DIR:-$(pwd)}"

GATE_FILE="$REPO_DIR/.gate.json"
PASS=0
FAIL=1
overall=0

# ── helpers ──────────────────────────────────────────────────────────────────

red()    { printf '\033[0;31m%s\033[0m' "$*"; }
green()  { printf '\033[0;32m%s\033[0m' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m' "$*"; }

pad() {
  local s="$1" width="${2:-20}"
  printf "%-${width}s" "$s"
}

print_row() {
  local check="$1" result="$2" detail="${3:-}"
  local result_colored
  case "$result" in
    PASS) result_colored=$(green "$result") ;;
    SKIP) result_colored=$(yellow "$result") ;;
    *)    result_colored=$(red "$result") ;;
  esac
  printf "  %s | %s | %s\n" "$(pad "$check")" "$result_colored" "$detail"
}

json_field() {
  local file="$1" field="$2" default="${3:-}"
  if command -v jq &>/dev/null; then
    val=$(jq -r ".$field // empty" "$file" 2>/dev/null)
  else
    val=$(grep -o "\"$field\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$file" 2>/dev/null \
          | sed 's/.*: *"\(.*\)"/\1/' | head -1)
  fi
  echo "${val:-$default}"
}

run_typecheck() {
  local configured="$1"
  cd "$REPO_DIR"
  if [[ "$configured" == "auto" ]] || [[ "$configured" == "tsc --noEmit" ]] || [[ "$configured" == *"tsc --noEmit"* ]]; then
    if command -v pnpm &>/dev/null && { [[ -f pnpm-lock.yaml ]] || [[ -f pnpm-workspace.yaml ]]; }; then
      pnpm exec tsc --noEmit
    else
      npx tsc --noEmit
    fi
  else
    eval "$configured"
  fi
}

run_secrets_scan() {
  cd "$REPO_DIR"
  if ! git rev-parse --git-dir &>/dev/null; then
    print_row "secrets-scan" "SKIP" "not a git repo"
    return 0
  fi
  local hits
  hits=$(git grep -lE 'AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|xox[baprs]-[a-zA-Z0-9-]{10,}|-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----' \
    -- . \
    ':(exclude)*.example' ':(exclude)*.template' ':(exclude)*.sample' ':(exclude)*.md' \
    ':(exclude)package-lock.json' ':(exclude)pnpm-lock.yaml' 2>/dev/null || true)
  if [[ -n "$hits" ]]; then
    local count
    count=$(echo "$hits" | grep -c . || echo 0)
    print_row "secrets-scan" "FAIL" "$count tracked file(s) match secret patterns"
    return 1
  fi
  print_row "secrets-scan" "PASS" "no secret patterns in tracked files"
  return 0
}

# ── gate config ──────────────────────────────────────────────────────────────

echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │          InsightProfit Pre-PR Gate       │"
echo "  └─────────────────────────────────────────┘"
echo ""
echo "  Repo: $REPO_DIR"
echo ""

if [[ ! -f "$GATE_FILE" ]]; then
  printf "  %s\n" "$(red "GATE: FAIL — no .gate.json found at $REPO_DIR")"
  echo "  Add .gate.json to opt this repo into the gate."
  exit 1
fi

printf "  %-20s | %-6s | %s\n" "CHECK" "RESULT" "DETAIL"
printf "  %-20s-+-%s\n" "--------------------" "--------+-------------------------------------"

# ── 1–4. typecheck / tests / build / secrets-scan (skipped in --env-only) ───

if [[ $ENV_ONLY == true ]]; then
  print_row "typecheck"     "SKIP" "--env-only mode"
  print_row "tests"         "SKIP" "--env-only mode"
  print_row "build"         "SKIP" "--env-only mode"
  print_row "secrets-scan"  "SKIP" "--env-only mode"
else

  # ── 1. typecheck ────────────────────────────────────────────────────────────
  tc_cmd=$(json_field "$GATE_FILE" "typecheck")
  if [[ -n "$tc_cmd" ]]; then
    tc_out=$(run_typecheck "$tc_cmd" 2>&1) && tc_exit=0 || tc_exit=$?
    if [[ $tc_exit -eq 0 ]]; then
      if [[ "$tc_cmd" == "auto" ]]; then
        if command -v pnpm &>/dev/null && { [[ -f "$REPO_DIR/pnpm-lock.yaml" ]] || [[ -f "$REPO_DIR/pnpm-workspace.yaml" ]]; }; then
          print_row "typecheck" "PASS" "pnpm exec tsc --noEmit"
        else
          print_row "typecheck" "PASS" "npx tsc --noEmit"
        fi
      else
        print_row "typecheck" "PASS" "$tc_cmd"
      fi
    else
      first_err=$(echo "$tc_out" | grep -m1 "error TS" | head -c 80 || echo "$tc_out" | tail -1 | head -c 80)
      print_row "typecheck" "FAIL" "$first_err"
      overall=1
    fi
  else
    print_row "typecheck" "SKIP" "not configured"
  fi

  # ── 2. tests ────────────────────────────────────────────────────────────────
  test_cmd=$(json_field "$GATE_FILE" "test")
  if [[ -n "$test_cmd" ]]; then
    test_out=$(cd "$REPO_DIR" && eval "$test_cmd" 2>&1) && test_exit=0 || test_exit=$?
    if [[ $test_exit -eq 0 ]]; then
      passed=$(echo "$test_out" | grep -oE '[0-9]+ passed' | tail -1 || echo "")
      print_row "tests" "PASS" "${passed:-exit 0}"
    else
      failed=$(echo "$test_out" | grep -oE '[0-9]+ failed' | tail -1 \
               || echo "$test_out" | tail -1 | head -c 80)
      print_row "tests" "FAIL" "$failed"
      overall=1
    fi
  else
    print_row "tests" "SKIP" "not configured"
  fi

  # ── 3. build ────────────────────────────────────────────────────────────────
  build_cmd=$(json_field "$GATE_FILE" "build")
  if [[ -n "$build_cmd" ]]; then
    build_out=$(cd "$REPO_DIR" && eval "$build_cmd" 2>&1) && build_exit=0 || build_exit=$?
    if [[ $build_exit -eq 0 ]]; then
      print_row "build" "PASS" "$build_cmd"
    else
      first_build=$(echo "$build_out" | grep -iE "error|failed" | head -1 | head -c 80 \
                    || echo "exit $build_exit")
      print_row "build" "FAIL" "$first_build"
      overall=1
    fi
  else
    print_row "build" "SKIP" "not configured"
  fi

  # ── 4. secrets-scan ───────────────────────────────────────────────────────────
  if ! run_secrets_scan; then
    overall=1
  fi

fi # end non-env-only checks

# ── 5. env guard ─────────────────────────────────────────────────────────────

if command -v jq &>/dev/null; then
  env_enabled=$(jq -r '.envGuard.enabled // false' "$GATE_FILE" 2>/dev/null)
  env_min_keys=$(jq -r '.envGuard.minKeys // 20' "$GATE_FILE" 2>/dev/null)
  env_min_bytes=$(jq -r '.envGuard.minBytes // 500' "$GATE_FILE" 2>/dev/null)
  env_glob=$(jq -r '.envGuard.globs[0] // ""' "$GATE_FILE" 2>/dev/null)
else
  env_enabled="false"
fi

if [[ "$env_enabled" == "true" && -n "$env_glob" ]]; then
  env_file="$REPO_DIR/$env_glob"
  if [[ ! -f "$env_file" ]]; then
    print_row "env-guard" "SKIP" "$env_glob not found (new repo?)"
  else
    actual_keys=$(grep -cE '^[A-Z_][A-Z0-9_]*=' "$env_file" 2>/dev/null || echo 0)
    actual_bytes=$(wc -c < "$env_file" | tr -d ' ')
    if [[ "$actual_keys" -lt "$env_min_keys" ]]; then
      print_row "env-guard" "FAIL" "$env_glob: $actual_keys keys < min $env_min_keys (possible wipe!)"
      overall=1
    elif [[ "$actual_bytes" -lt "$env_min_bytes" ]]; then
      print_row "env-guard" "FAIL" "$env_glob: ${actual_bytes}B < min ${env_min_bytes}B (possible wipe!)"
      overall=1
    else
      print_row "env-guard" "PASS" "$env_glob: $actual_keys keys, ${actual_bytes}B"
    fi
  fi
else
  print_row "env-guard" "SKIP" "not configured"
fi

# ── result ───────────────────────────────────────────────────────────────────

echo ""
if [[ $overall -eq 0 ]]; then
  printf "  %s\n\n" "$(green "GATE: PASS — safe to merge")"
  exit 0
else
  printf "  %s\n\n" "$(red "GATE: FAIL — fix above errors before merging")"
  exit 1
fi
