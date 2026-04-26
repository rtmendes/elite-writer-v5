import React, { forwardRef, useMemo } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { DragHandleProps } from '@udecode/plate-ui-dnd';
import {
  findNodePath,
  focusEditor,
  insertNodes,
  moveNodes,
  removeNodes,
  setNodes,
  type TElement,
  usePlateEditorRef,
} from '@udecode/plate-common';
import { GripVertical, Trash2, Copy, ArrowUp, ArrowDown, Type, Heading1, Heading2 } from 'lucide-react';

function cloneElementDeep(el: TElement): TElement {
  // Plate elements are plain objects; JSON clone is fine for our use.
  return JSON.parse(JSON.stringify(el)) as TElement;
}

export const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(function DragHandle(
  { element, ...buttonProps },
  ref
) {
  const editor = usePlateEditorRef();

  const blockId = (element as any)?.id as string | undefined;
  const blockLink = useMemo(() => {
    if (!blockId) return '';
    try {
      const u = new URL(window.location.href);
      u.hash = `block=${encodeURIComponent(blockId)}`;
      return u.toString();
    } catch {
      return '';
    }
  }, [blockId]);

  const getPath = () => {
    const p = findNodePath(editor, element);
    return p ?? null;
  };

  const menuItem =
    'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground outline-none hover:bg-muted data-[disabled]:opacity-50';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          {...buttonProps}
          ref={ref}
          type="button"
          aria-label="Block menu"
          className={[
            // Notion-ish handle: hidden until hover of the gutter/toolbar area
            'opacity-0 group-hover:opacity-100',
            'flex h-7 w-7 items-center justify-center rounded-md',
            'text-muted-foreground hover:bg-muted hover:text-foreground',
            'transition-opacity',
            // plate-dnd attaches drag handlers via props
            (buttonProps as any)?.className || '',
          ].join(' ')}
          onMouseDown={(e) => {
            // Keep selection stable; allow drag start.
            e.preventDefault();
            (buttonProps as any)?.onMouseDown?.(e);
          }}
        >
          <GripVertical className="h-[18px] w-[18px]" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="right"
          align="start"
          className="z-50 w-56 rounded-lg border border-border bg-background p-1 shadow-xl"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            focusEditor(editor);
          }}
        >
          <DropdownMenu.Label className="px-2 py-1 text-xs text-muted-foreground">Block</DropdownMenu.Label>

          <DropdownMenu.Item
            className={menuItem}
            onSelect={() => {
              const path = getPath();
              if (!path) return;
              removeNodes(editor, { at: path });
              focusEditor(editor);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenu.Item>

          <DropdownMenu.Item
            className={menuItem}
            onSelect={() => {
              const path = getPath();
              if (!path) return;
              const dup = cloneElementDeep(element);
              // Insert after this block
              insertNodes(editor, dup as any, { at: [...path.slice(0, -1), path[path.length - 1] + 1] as any });
              focusEditor(editor);
            }}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-slate-800" />

          <DropdownMenu.Label className="px-2 py-1 text-xs text-muted-foreground">Turn into</DropdownMenu.Label>
          <DropdownMenu.Item
            className={menuItem}
            onSelect={() => {
              const path = getPath();
              if (!path) return;
              setNodes(editor, { type: 'p' } as any, { at: path });
              focusEditor(editor);
            }}
          >
            <Type className="h-4 w-4" />
            Paragraph
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={menuItem}
            onSelect={() => {
              const path = getPath();
              if (!path) return;
              setNodes(editor, { type: 'h1' } as any, { at: path });
              focusEditor(editor);
            }}
          >
            <Heading1 className="h-4 w-4" />
            Heading 1
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={menuItem}
            onSelect={() => {
              const path = getPath();
              if (!path) return;
              setNodes(editor, { type: 'h2' } as any, { at: path });
              focusEditor(editor);
            }}
          >
            <Heading2 className="h-4 w-4" />
            Heading 2
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-slate-800" />

          <DropdownMenu.Item
            className={menuItem}
            onSelect={() => {
              const path = getPath();
              if (!path) return;
              if (path[path.length - 1] === 0) return;
              const to = [...path.slice(0, -1), path[path.length - 1] - 1] as any;
              moveNodes(editor, { at: path, to });
              focusEditor(editor);
            }}
          >
            <ArrowUp className="h-4 w-4" />
            Move up
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={menuItem}
            onSelect={() => {
              const path = getPath();
              if (!path) return;
              const to = [...path.slice(0, -1), path[path.length - 1] + 1] as any;
              moveNodes(editor, { at: path, to });
              focusEditor(editor);
            }}
          >
            <ArrowDown className="h-4 w-4" />
            Move down
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-slate-800" />

          <DropdownMenu.Item
            className={menuItem}
            disabled={!blockLink}
            onSelect={async () => {
              if (!blockLink) return;
              await navigator.clipboard.writeText(blockLink);
            }}
          >
            <Copy className="h-4 w-4" />
            Copy link to block
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
});

