'use client';

import * as React from 'react';

// The inline-AI rewrite action set. `custom` and `tone` carry a free-text prompt.
export type InlineAIAction =
  | 'improve'
  | 'shorten'
  | 'expand'
  | 'grammar'
  | 'tone'
  | 'custom';

// Signature the host page (Writer.tsx) implements with a tRPC mutation.
// Takes the selected passage + an action, resolves to the rewritten passage.
export type InlineAIRewrite = (
  text: string,
  action: InlineAIAction,
  customPrompt?: string
) => Promise<string>;

type InlineAIValue = { rewrite?: InlineAIRewrite };

// Context is the cleanest seam here: the "Ask AI" button lives deep inside
// Plate's `afterEditable` render tree, so we can't thread a plain prop to it.
// The provider wraps <Plate>, so every node Plate renders can read the callback.
const InlineAIContext = React.createContext<InlineAIValue>({});

export function InlineAIProvider({
  rewrite,
  children,
}: {
  rewrite?: InlineAIRewrite;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ rewrite }), [rewrite]);
  return <InlineAIContext.Provider value={value}>{children}</InlineAIContext.Provider>;
}

export function useInlineAI(): InlineAIValue {
  return React.useContext(InlineAIContext);
}
