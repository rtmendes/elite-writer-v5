# Anthropic → OpenRouter Migration Audit

## `give-engine`

### CRITICAL RISK
- None identified directly matching critical criteria for this app.

### HIGH RISK
- **Response Format Dependency:** The routers `server/routers/give.ts` (lines 25, 96) and `server/routers/bridges.ts` (line 797) make direct calls to `https://give.insightprofit.live/api/visualize` and `https://give.insightprofit.live/api/score`. If this external service directly uses Anthropic responses in the `{ content: [{ type: "text", text: "..." }] }` format, switching to OpenRouter without an adapter mapping it from `{ choices: [{ message: { content: "..." } }] }` will break `give-engine` visualizer.

### MEDIUM RISK
- **Model Availability:** Model ID `claude-sonnet-4-6` is requested but does not exist on OpenRouter. The OpenRouter identifier format requires `anthropic/` prepended, e.g., `anthropic/claude-3.5-sonnet-20241022` or a matching equivalent version.

### LOW RISK
- None identified.

---

## `elite-writer-v5`

### CRITICAL RISK
- **Streaming Compatibility:** The `streamLLM()` function in `server/_core/llm.ts` strictly parses Anthropic's Server-Sent Events (SSE). It hardcodes listening for `event.type === "content_block_delta"` and reads `event.delta.text`. Moving to OpenRouter (which follows OpenAI streaming standards emitting `data: {"choices":[{"delta":{"content":"..."}}]}`) will completely break `streamLLM()`, resulting in silent failures yielding no chunks.

### HIGH RISK
- **Response Format Dependency:** In `server/_core/llm.ts`, the `invokeAnthropic` method expects Anthropic schema `data.content`, `data.stop_reason`, and `data.usage.input_tokens`. Changing to OpenRouter requires relying exclusively on the OpenAI-compatible mapped responses (e.g., via `invokeOpenRouter` returning `choices[0].finish_reason` and `usage.prompt_tokens`).

### MEDIUM RISK
- None identified directly.

### LOW RISK
- **Error Handling:** Fallback chains catch OpenRouter generic HTTP errors with `!response.ok` identically to Anthropic logic in `server/_core/llm.ts`. Although Anthropic structures specific JSON errors differently (e.g., `error.type = "rate_limit_error"` for 429), the existing `throw new Error` handles both stringified bodies safely. Specific downstream error matching might break.

---

## `elite-writer-app`

### CRITICAL RISK
- None identified.

### HIGH RISK
- None identified.

### MEDIUM RISK
- **Frontend Consumer Dependency:** `client/src/lib/ai-engine.ts` sets `provider: 'anthropic'` across specific models and hits `https://api.anthropic.com/v1/messages` natively on lines 192-211. Switching to OpenRouter means these direct Anthropic hits will fail or must be patched to point `provider: 'anthropic'` models to OpenRouter with an `openrouter_key`.
- **Response Format Dependency:** Similarly, `client/src/lib/ai-engine.ts` depends on Anthropic schema inside the `provider === 'anthropic'` block: extracting `data.content?.[0]?.text`, `data.usage?.input_tokens`, and `data.usage?.output_tokens`.
- **Model Availability:** The models `claude-sonnet-4-20250514`, `claude-3-5-sonnet-20241022` (in `score.js` equivalents) and `claude-haiku-4-5-20251001` (in `stream.js` equivalents) must be swapped to valid OpenRouter identifiers (`anthropic/claude-3-5-sonnet-20241022`, `anthropic/claude-3-5-haiku-20241022`).

### LOW RISK
- **Error Handling:** The `!res.ok` catch in `client/src/lib/ai-engine.ts` attempts to extract `e?.error?.message` which may parse differently for OpenRouter vs Anthropic errors but will still throw safely.

---

## `insightprofit-command`

### CRITICAL RISK
- None identified.

### HIGH RISK
- None identified.

### MEDIUM RISK
- **Settings Storage & Propagation:** While the specific `insightprofit-command` module/directory and `route-instruction.js` are not present in this workspace, the pattern via `client/src/pages/Settings.tsx` and `client/src/lib/ai-engine.ts` shows `anthropic_key` stored in `localStorage` and passed to backend providers. For the command center, any setting transmitting `anthropic_key` to `route-instruction.js` must be updated to pass `openrouter_key` instead so orchestrators can successfully route via OpenRouter.

### LOW RISK
- None identified.
