import React, { useMemo, useState } from 'react';
import {
  ToolbarButton,
  getToolbarButtonStyles,
  useFloatingToolbar,
} from '@udecode/plate-ui-toolbar';
import {
  focusEditor,
  getSelectionText,
  isSelectionExpanded,
  setSelection,
  setMarks,
  toggleMark,
  toggleNodeType,
  usePlateEditorRef,
  usePlateEditorState,
} from '@udecode/plate-common';
import {
  MARK_BOLD,
  MARK_CODE,
  MARK_ITALIC,
  MARK_STRIKETHROUGH,
  MARK_UNDERLINE,
} from '@udecode/plate-basic-marks';
import { triggerFloatingLinkInsert } from '@udecode/plate-link';

import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  Paintbrush,
  Highlighter,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';

type TurnIntoOption = { label: string; type: string };

export function FloatingToolbar() {
  const editor = usePlateEditorRef();
  const editorState = usePlateEditorState();
  const { floatingStyles, refs, open } = useFloatingToolbar({
    floatingOptions: {
      placement: 'top',
      middleware: {
        offset: 8,
        shift: { padding: 8 },
        flip: { padding: 8 },
      } as any,
    },
  });

  const [showTurnInto, setShowTurnInto] = useState(false);
  const [showColor, setShowColor] = useState(false);
  const [showBg, setShowBg] = useState(false);

  const visible = open && !!editorState?.selection && isSelectionExpanded(editor);

  const turnInto: TurnIntoOption[] = useMemo(
    () => [
      { label: 'Paragraph', type: 'p' },
      { label: 'Heading 1', type: 'h1' },
      { label: 'Heading 2', type: 'h2' },
      { label: 'Heading 3', type: 'h3' },
      { label: 'Quote', type: 'blockquote' },
      { label: 'Code block', type: 'code_block' },
    ],
    []
  );

  const palette = useMemo(
    () => [
      '#ffffff',
      '#e2e8f0',
      '#94a3b8',
      '#60a5fa',
      '#a78bfa',
      '#f472b6',
      '#fbbf24',
      '#34d399',
      '#fb7185',
    ],
    []
  );

  if (!visible) return null;

  const btnClass = getToolbarButtonStyles?.({}).root?.className ?? '';

  const closeAll = () => {
    setShowTurnInto(false);
    setShowColor(false);
    setShowBg(false);
  };

  return (
    <div
      ref={refs.setFloating}
      style={{
        ...floatingStyles,
        transition: 'opacity 120ms ease, transform 120ms ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0px)' : 'translateY(4px)',
      }}
      className="z-50"
      onMouseDown={(e) => {
        // Keep selection while clicking toolbar buttons.
        e.preventDefault();
      }}
    >
      <div className="flex items-center gap-1 rounded-lg border border-border bg-background/95 p-1 shadow-xl backdrop-blur">
        <ToolbarButton
          icon={<Bold className="h-4 w-4" />}
          tooltip={{ content: 'Bold (Ctrl/Cmd+B)' } as any}
          onMouseDown={(e) => {
            e.preventDefault();
            closeAll();
            toggleMark(editor, { key: MARK_BOLD });
            focusEditor(editor);
          }}
          className={btnClass}
        />
        <ToolbarButton
          icon={<Italic className="h-4 w-4" />}
          tooltip={{ content: 'Italic (Ctrl/Cmd+I)' } as any}
          onMouseDown={(e) => {
            e.preventDefault();
            closeAll();
            toggleMark(editor, { key: MARK_ITALIC });
            focusEditor(editor);
          }}
          className={btnClass}
        />
        <ToolbarButton
          icon={<Underline className="h-4 w-4" />}
          tooltip={{ content: 'Underline (Ctrl/Cmd+U)' } as any}
          onMouseDown={(e) => {
            e.preventDefault();
            closeAll();
            toggleMark(editor, { key: MARK_UNDERLINE });
            focusEditor(editor);
          }}
          className={btnClass}
        />
        <ToolbarButton
          icon={<Strikethrough className="h-4 w-4" />}
          tooltip={{ content: 'Strikethrough' } as any}
          onMouseDown={(e) => {
            e.preventDefault();
            closeAll();
            toggleMark(editor, { key: MARK_STRIKETHROUGH });
            focusEditor(editor);
          }}
          className={btnClass}
        />
        <ToolbarButton
          icon={<Code className="h-4 w-4" />}
          tooltip={{ content: 'Code (Ctrl/Cmd+E)' } as any}
          onMouseDown={(e) => {
            e.preventDefault();
            closeAll();
            toggleMark(editor, { key: MARK_CODE });
            focusEditor(editor);
          }}
          className={btnClass}
        />
        <ToolbarButton
          icon={<Link className="h-4 w-4" />}
          tooltip={{ content: 'Link (Ctrl/Cmd+K)' } as any}
          onMouseDown={(e) => {
            e.preventDefault();
            closeAll();
            triggerFloatingLinkInsert(editor);
            focusEditor(editor);
          }}
          className={btnClass}
        />

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Text color */}
        <div className="relative">
          <ToolbarButton
            icon={<Paintbrush className="h-4 w-4" />}
            tooltip={{ content: 'Text color' } as any}
            onMouseDown={(e) => {
              e.preventDefault();
              setShowColor((v) => !v);
              setShowBg(false);
              setShowTurnInto(false);
            }}
            className={btnClass}
          />
          {showColor ? (
            <div className="absolute left-0 top-full mt-2 w-[180px] rounded-lg border border-border bg-background p-2 shadow-xl">
              <div className="mb-2 text-xs text-muted-foreground">Text color</div>
              <div className="grid grid-cols-9 gap-1">
                {palette.map((c) => (
                  <button
                    key={c}
                    className="h-5 w-5 rounded border border-border"
                    style={{ background: c }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMarks(editor, { color: c } as any);
                      setShowColor(false);
                      focusEditor(editor);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Background color */}
        <div className="relative">
          <ToolbarButton
            icon={<Highlighter className="h-4 w-4" />}
            tooltip={{ content: 'Background color' } as any}
            onMouseDown={(e) => {
              e.preventDefault();
              setShowBg((v) => !v);
              setShowColor(false);
              setShowTurnInto(false);
            }}
            className={btnClass}
          />
          {showBg ? (
            <div className="absolute left-0 top-full mt-2 w-[180px] rounded-lg border border-border bg-background p-2 shadow-xl">
              <div className="mb-2 text-xs text-muted-foreground">Background</div>
              <div className="grid grid-cols-9 gap-1">
                {palette.map((c) => (
                  <button
                    key={c}
                    className="h-5 w-5 rounded border border-border"
                    style={{ background: c }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMarks(editor, { backgroundColor: c } as any);
                      setShowBg(false);
                      focusEditor(editor);
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Turn into */}
        <div className="relative">
          <ToolbarButton
            icon={
              <span className="flex items-center gap-1">
                <span className="text-xs">Turn into</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </span>
            }
            tooltip={{ content: 'Turn into' } as any}
            onMouseDown={(e) => {
              e.preventDefault();
              setShowTurnInto((v) => !v);
              setShowColor(false);
              setShowBg(false);
            }}
            className={btnClass}
          />
          {showTurnInto ? (
            <div className="absolute right-0 top-full mt-2 w-[220px] rounded-lg border border-border bg-background p-1 shadow-xl">
              {turnInto.map((opt) => (
                <button
                  key={opt.type}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggleNodeType(editor, { activeType: opt.type });
                    setShowTurnInto(false);
                    focusEditor(editor);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Comment -> triggers AI panel behavior */}
        <ToolbarButton
          icon={<MessageSquare className="h-4 w-4" />}
          tooltip={{ content: 'Comment (send selection to AI panel)' } as any}
          onMouseDown={(e) => {
            e.preventDefault();
            closeAll();
            const selectionText = getSelectionText(editor) || '';
            // Capture the exact Slate range for later "Replace selection".
            const selectionId = String(Date.now());
            try {
              const range =
                typeof (globalThis as any).structuredClone === 'function'
                  ? (globalThis as any).structuredClone((editor as any).selection)
                  : JSON.parse(JSON.stringify((editor as any).selection));
              (window as any).__elitewriter_ai_selection = { id: selectionId, range };
            } catch {
              (window as any).__elitewriter_ai_selection = { id: selectionId, range: (editor as any).selection };
            }
            window.dispatchEvent(
              new CustomEvent('elitewriter:ai-comment', {
                detail: { text: selectionText, selectionId },
              })
            );
            focusEditor(editor);
          }}
          className={btnClass}
        />
      </div>
    </div>
  );
}

