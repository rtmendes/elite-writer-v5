'use client';

import * as React from 'react';

import {
  CheckCheckIcon,
  Maximize2Icon,
  Minimize2Icon,
  PencilLineIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  WandSparklesIcon,
} from 'lucide-react';
import { useEditorRef } from 'platejs/react';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  type InlineAIAction,
  useInlineAI,
} from '@/components/writer/inline-ai-context';

import { ToolbarButton } from './toolbar';

const QUICK_ACTIONS: {
  action: InlineAIAction;
  label: string;
  icon: React.ReactNode;
}[] = [
  { action: 'improve', label: 'Improve writing', icon: <SparklesIcon /> },
  { action: 'shorten', label: 'Make shorter', icon: <Minimize2Icon /> },
  { action: 'expand', label: 'Make longer', icon: <Maximize2Icon /> },
  { action: 'grammar', label: 'Fix grammar & spelling', icon: <CheckCheckIcon /> },
  { action: 'tone', label: 'Change tone…', icon: <PencilLineIcon /> },
];

export function InlineAIToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>
) {
  const editor = useEditorRef();
  const { rewrite } = useInlineAI();
  const [open, setOpen] = React.useState(false);

  const run = React.useCallback(
    async (action: InlineAIAction) => {
      if (!rewrite) return;

      // Capture the selection Range up front. The LLM call is async, so the
      // user could click away before it resolves — we re-apply this exact
      // Range before swapping in the rewritten text.
      const saved = editor.selection;
      if (!saved || !editor.api.isExpanded()) {
        toast.error('Select some text first, then ask AI.');
        return;
      }
      const passage = editor.api.string(saved).trim();
      if (!passage) {
        toast.error('Select some text first, then ask AI.');
        return;
      }

      let customPrompt: string | undefined;
      if (action === 'tone' || action === 'custom') {
        const answer = window.prompt(
          action === 'tone'
            ? 'Describe the tone you want (e.g. "warm and conversational"):'
            : 'What should AI do with the selected text?'
        );
        if (answer == null || !answer.trim()) return; // cancelled
        customPrompt = answer.trim();
      }

      const toastId = toast.loading('AI is rewriting your selection…');
      try {
        const rewritten = await rewrite(passage, action, customPrompt);
        if (!rewritten || !rewritten.trim()) {
          toast.error('AI returned nothing — selection left unchanged.', {
            id: toastId,
          });
          return;
        }
        // Re-select the saved Range, then insertText — on an expanded
        // selection Slate deletes the old text then inserts, i.e. replace.
        editor.tf.focus();
        editor.tf.select(saved);
        editor.tf.insertText(rewritten.trim());
        toast.success('Selection rewritten.', { id: toastId });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'AI rewrite failed.',
          { id: toastId }
        );
      }
    },
    [editor, rewrite]
  );

  // If the host page never wired a rewrite handler, don't show a dead button.
  if (!rewrite) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={open} tooltip="Ask AI" isDropdown {...props}>
          <WandSparklesIcon />
          Ask AI
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="ignore-click-outside/toolbar min-w-[220px]"
        align="start"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          editor.tf.focus();
        }}
      >
        <DropdownMenuLabel>Edit selection with AI</DropdownMenuLabel>
        {QUICK_ACTIONS.map(({ action, label, icon }) => (
          <DropdownMenuItem key={action} onSelect={() => run(action)}>
            {icon}
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => run('custom')}>
          <SlidersHorizontalIcon />
          Custom instruction…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
