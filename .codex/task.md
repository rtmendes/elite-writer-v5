# Agent Dispatch Task

## Metadata
- **Dispatched by:** Viktor AI
- **Timestamp:** 2026-05-17T00:04:12.347829+00:00
- **Agent:** Codex
- **Priority:** high
- **Source branch:** main
- **Dispatch branch:** agent/codex-20260517-000410

## Task

# Anthropic → OpenRouter Migration Audit (AUDIT ONLY — DO NOT MODIFY CODE)

## Your Role
You are performing an independent code audit as part of a 3-way audit (Viktor, Codex, Jules).
**DO NOT MAKE ANY CODE CHANGES.** Only produce an audit report.

## What to Investigate

### 1. GIVE Engine (`give-engine` repo)
- `src/lib/ai-clients.ts` — `callClaudeCodeGen()` function
- `src/app/api/score/route.ts` — scoring endpoint
- `src/app/api/visualize-fallback/route.ts` — reference OpenRouter implementation
- Document: What request format is used? How is the response parsed? What model names?

### 2. Elite Writer v5 (`elite-writer-v5` repo)
- `server/_core/llm.ts` — Full LLM routing (invokeAnthropic, invokeOpenRouter, streamLLM)
- All files in `server/routers/` that call `invokeLLM` or `streamLLM`
- Document: The provider fallback chain. How streaming works. What breaks if ANTHROPIC_API_KEY is empty.

### 3. Elite Writer App v4 (`elite-writer-app` repo)
- `functions/api/anthropic.js` — direct proxy
- `functions/api/llm.js` — multi-provider router
- `functions/api/stream.js` — multi-provider streaming
- `functions/api/score.js`, `style-analyze.js`, `import-article.js`
- Document: Which endpoints hard-require Anthropic vs can fallback

### 4. Command Center (`insightprofit-command` repo)
- `api/route-instruction.js` — where does the Anthropic key come from?
- Check frontend source for where users configure/store the Anthropic API key

## Output
Create a file `AUDIT_REPORT.md` at the repo root with:
1. Every Anthropic API call location (file, line, function)
2. Request format used (Anthropic Messages vs OpenAI Chat)
3. Response parsing code (exact field paths)
4. Streaming format if applicable
5. Risk assessment for each migration point
6. Model names used and OpenRouter equivalents
7. Any hidden dependencies or edge cases

**REMINDER: DO NOT MODIFY ANY EXISTING CODE. AUDIT ONLY.**

## Instructions for Codex

1. Read this task carefully
2. Explore the codebase to understand the current state
3. Implement the changes described above
4. Run any available tests (`npm test`, `bun run tsc --noEmit`, etc.)
5. Commit your changes to this branch
6. Create a PR back to `main` with a clear description of what was changed

## Acceptance Criteria
- All existing tests pass
- No TypeScript errors
- Changes are scoped to the task description
- PR description clearly explains what was done
