// Editor AI bar actions — prompts built here, executed server-side via the
// agent layer (model routing, budget gate, ledger, central cost recording).
import { runTask } from "./agent";

export type AIAction = "humanize" | "tighten" | "expand" | "headlines" | "continue";

const ACTION_PROMPTS: Record<AIAction, (text: string) => string> = {
  humanize: (t) =>
    `Rewrite the passage below so it reads as unmistakably human prose — irregular rhythm, concrete detail, a real point of view. Remove every AI-sounding construction while preserving all facts and meaning.\n\nPASSAGE:\n${t}`,
  tighten: (t) =>
    `Cut this passage by 25-40% without losing any facts or nuance. Tighter verbs, no throat-clearing.\n\nPASSAGE:\n${t}`,
  expand: (t) =>
    `Expand this passage with richer reporting texture: add transitions, concrete framing, and one rhetorical turn. Keep the author's voice. Do not invent facts — where a statistic or source would be needed, insert [TK: what to verify].\n\nPASSAGE:\n${t}`,
  headlines: (t) =>
    `Write 8 headline options for the story below — mix of news-pegged, analytical, and contrarian angles, in the style of Bloomberg / The Atlantic. One per line, no numbering.\n\nSTORY:\n${t}`,
  continue: (t) =>
    `Continue this draft with the next 2-3 paragraphs, matching its voice and argument exactly. Where reporting is needed, insert [TK: what to verify].\n\nDRAFT SO FAR:\n${t}`,
};

export async function runAI(action: AIAction, text: string): Promise<string> {
  return runTask(action, ACTION_PROMPTS[action](text), text.slice(0, 60));
}
