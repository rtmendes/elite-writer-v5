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

## Secrets & automation (evergreen Infisical — org standard)

- All secrets live in Infisical: project `75ce45d4-9209-45b0-a24d-a2078132f2f8`,
  env `prod`. Never ask the user to paste a secret that exists there.
- Sessions self-provision: the SessionStart hook exports secrets to `.env.local`
  (gitignored), `.mcp.json` provides Infisical MCP tools, `scripts/with-env.sh`
  injects secrets at runtime, and `scripts/secrets.mjs` is a zero-dep Node loader
  (`await loadSecrets()`).
- If a needed secret NAME is missing but an equivalent exists under another name,
  create an alias yourself: `scripts/infisical-ensure-secret.mjs NAME --ref EXISTING`
  (create-if-missing only; allowlisted). Updating/deleting secrets requires asking.
- Automation-first: never ask the user to do manually what can be done
  programmatically from this environment. Only hand over a step when genuinely
  impossible (auth-gated UI), and then as an exact copy-paste.

## Project-Management Mode (standing rule)

This repo tracks its work in `TASKS.md`. That file — not the chat history — is
the source of truth for the goal and the to-do list. Context can compress; the
file cannot. Treat it as the project's memory.

**At the START of every session, before doing anything else:**
1. Read `TASKS.md`.
2. Restate the **Goal** in one line.
3. Show the **To-do**: what is done `[x]`, in progress `[~]`, and pending `[ ]`.
4. State the **Next step** and any **Blocked on** item.
5. Ask the user to confirm the next step (or say "continuing with <X>") before
   starting substantive work.

If `TASKS.md` does not exist, create it from `project-mode/TASKS.template.md`
(or the same template in the design-research repo) by inferring the goal and
current state from the repo, then confirm it with the user.

**As work progresses:** keep `TASKS.md` current — check off finished items,
mark what's in progress, update the **Next step** and **Last updated** lines.

**Before ENDING a session:** update `TASKS.md` so the next session (yours or a
parallel one) can pick up cleanly. The last thing you write is the state, not a
summary that only lives in this thread.

**Credentials never block work here:** secrets load automatically from the vault
on session start (see the Secrets section / `docs/INFISICAL_EVERGREEN.md`). Never
stall a task waiting on a credential — if a needed secret name is missing, create
it with `scripts/infisical-ensure-secret.mjs` and continue.
