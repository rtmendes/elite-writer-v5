import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlateEditorRef } from '@udecode/plate-common';
import { insertTable } from '@udecode/plate-table';
import { upsertLink } from '@udecode/plate-link';
import { insertImage } from '@udecode/plate-media';
import { toggleList, ELEMENT_OL, ELEMENT_UL } from '@udecode/plate-list';

type Command = {
  id: string;
  label: string;
  keywords: string[];
  run: (editor: any) => void;
};

export function SlashCommandMenu() {
  const editor = usePlateEditorRef();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const lastSlashAtRef = useRef<number>(0);

  const commands: Command[] = useMemo(
    () => [
      {
        id: 'h1',
        label: 'Heading 1',
        keywords: ['h1', 'heading', 'title'],
        run: (ed) => ed?.tf?.setNodes?.({ type: 'h1' }),
      },
      {
        id: 'h2',
        label: 'Heading 2',
        keywords: ['h2', 'heading'],
        run: (ed) => ed?.tf?.setNodes?.({ type: 'h2' }),
      },
      {
        id: 'bullets',
        label: 'Bulleted list',
        keywords: ['bullet', 'ul', 'list'],
        run: (ed) => toggleList(ed, { type: ELEMENT_UL }),
      },
      {
        id: 'numbered',
        label: 'Numbered list',
        keywords: ['number', 'ol', 'list'],
        run: (ed) => toggleList(ed, { type: ELEMENT_OL }),
      },
      {
        id: 'quote',
        label: 'Quote',
        keywords: ['quote', 'blockquote'],
        run: (ed) => ed?.tf?.setNodes?.({ type: 'blockquote' }),
      },
      {
        id: 'code',
        label: 'Code block',
        keywords: ['code', 'snippet'],
        run: (ed) => ed?.tf?.setNodes?.({ type: 'code_block' }),
      },
      {
        id: 'divider',
        label: 'Divider',
        keywords: ['hr', 'divider', 'rule'],
        run: (ed) => ed?.tf?.insertNodes?.({ type: 'hr', children: [{ text: '' }] }),
      },
      {
        id: 'table',
        label: 'Table (3×3)',
        keywords: ['table', 'grid'],
        run: (ed) => insertTable(ed, { rowCount: 3, colCount: 3 }),
      },
      {
        id: 'link',
        label: 'Link',
        keywords: ['link', 'url'],
        run: (ed) => {
          const url = window.prompt('Link URL');
          if (!url) return;
          upsertLink(ed, { url });
        },
      },
      {
        id: 'image',
        label: 'Image (URL)',
        keywords: ['image', 'img', 'photo'],
        run: (ed) => {
          const url = window.prompt('Image URL');
          if (!url) return;
          insertImage(ed, url);
        },
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q)));
  }, [commands, query]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!editor) return;

      if (open) {
        if (e.key === 'Escape') {
          setOpen(false);
          setQuery('');
          return;
        }
        if (e.key === 'Backspace') {
          // After a short delay, read the current line to rebuild query. Keep simple.
          setTimeout(() => setQuery((q) => (q.length ? q.slice(0, -1) : '')), 0);
          return;
        }
        if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
          setQuery((q) => (q + e.key).slice(0, 40));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const chosen = filtered[0];
          if (chosen) {
            // remove the slash (best-effort)
            try {
              (editor as any).deleteBackward?.('character');
            } catch {}
            chosen.run(editor as any);
          }
          setOpen(false);
          setQuery('');
        }
        return;
      }

      if (e.key === '/') {
        // Open slash menu near caret.
        lastSlashAtRef.current = Date.now();
        setQuery('');
        setTimeout(() => {
          try {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            setPos({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX });
            setOpen(true);
          } catch {
            setPos({ top: 120, left: 120 });
            setOpen(true);
          }
        }, 0);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [editor, open, filtered]);

  if (!open || !pos) return null;

  return (
    <div
      className="fixed z-50 w-[320px] overflow-hidden rounded-lg border border-border bg-background/95 shadow-xl backdrop-blur"
      style={{ top: pos.top, left: Math.min(pos.left, window.innerWidth - 340) }}
    >
      <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
        Type to filter… <span className="text-muted-foreground/60">{query ? `“${query}”` : ''}</span>
      </div>
      <div className="max-h-[260px] overflow-auto p-1">
        {filtered.map((c) => (
          <button
            key={c.id}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
            onMouseDown={(e) => {
              e.preventDefault();
              try {
                (editor as any).deleteBackward?.('character');
              } catch {}
              c.run(editor as any);
              setOpen(false);
              setQuery('');
            }}
          >
            {c.label}
          </button>
        ))}
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">No matches.</div>
        ) : null}
      </div>
    </div>
  );
}

