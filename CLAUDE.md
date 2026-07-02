# ENTERPRISE BASELINE RULES

## 1. Architecture & Infrastructure
- Prioritize self-hosted, open-source software solutions. 
- Target private VPS instances for deployment to maintain data ownership and cost efficiency.
- Default to Supabase and Baserow for database architecture and backend structure.

## 2. UI/UX Standards
- Enforce a luxury minimalist aesthetic across all digital touchpoints.
- Target Stripe and Linear UI paradigms: clean lines, high-contrast readability, intuitive spacing, and absolute zero visual clutter.

## 3. Agent Execution Parameters
- Output strict, modular, and deterministic code.
- Eliminate conversational filler, redundant confirmations, and verbose error logging.
- Execute commands silently where possible; report only critical failures or definitive success states.
## Secrets (Infisical primary, Vault fallback)
- Load secrets via `infisical run -- <cmd>` (primary); Vault and `.env` retained as fallback.
- Never print or commit secret values; reference env var NAMES only.
