# Agent Wiring Audit — Elite Writer V5

18 agent personas (`server/routers/agents.ts`). Status after this PR:

| Persona | Role | Wired? | Where it runs |
|---|---|---|---|
| scout | Topic scout | ✅ | Proactive loop — files US news-pegged ideas matched to outlets, on your beats |
| scorer | Idea scorer | ✅ | `score_idea` + proactive auto-scorer |
| analyst | Publication matcher | ✅ | `match_publications` + outline-suggestions |
| deepresearch | Researcher | ✅ | `research_brief` (live Perplexity) |
| outliner | Outline builder | ✅ | `buildOutline` + `headlines` |
| drafter | Full-draft writer | ✅ | `writeFullDraft` + tournament + `expand` |
| editor | Commissioning editor | ✅ | `create_offer` + `tighten` |
| rewriter | Humanizer | ✅ | `humanize` |
| continuator | Draft continuer | ✅ | `continue` |
| factchecker | Fact verification | ✅ | `verifyFacts` → Claim Ledger |
| quality | Quality Guardian | ✅ | Proactive gate on Edit/Submitted rows |
| **artdirector** | Hero-image art direction | ✅ **(wired this PR)** | `generateCoverImage` — now composes the image prompt from title + publication/brand visual cues |
| **proofreader** | Final polish gate | ✅ **(wired this PR)** | `proofread` action — grammar / US-English / AI-tell cleanup before submission |
| infographic | Data-viz | ✅ | Chart block (`/chart`) |
| seo | SEO | ✅ | SEO surfaces (v5 core) |
| researcher | Basic research | ⚪ Superseded by `deepresearch` (intentionally redundant; kept for fallback) |
| imagecreator | Generic image gen | ⚪ Covered by `artdirector` + `generateCoverImage`; reserve for future per-section images |
| appbuilder | App scaffolding | ⚪ Out of scope for the editorial workflow |

## Proactive loop (server, `proactiveAgents.ts`)
- **Scout** — ≤1×/20h, USA-only news, beat-filtered, outlet-matched, relevance-gated.
- **Scorer** — every 10 min, auto-scores new Idea/Research rows.
- **Quality Guardian** — every 10 min, gates Edit/Submitted rows.
- **Follow-up** — every 12h, Slack nudges for 4-day-silent pitches.
- All budget-capped (`WORKSPACE_AGENT_BUDGET`), logged to the AI Ledger + central cost system.

## Brand awareness (this PR)
Every drafting agent (outline, full draft, offer) now injects the article's **Brand** context — voice, audience, backend offer — alongside the **publication** style guide. Articles serve both the brand's funnel and the outlet's house style at once.
