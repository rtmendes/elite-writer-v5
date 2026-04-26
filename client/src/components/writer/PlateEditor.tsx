import { useCallback, useEffect, useRef, useState } from 'react';
import type { Value } from '@udecode/plate-common';
import { Plate, PlateContent } from '@udecode/plate-common';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import { platePlugins } from '@/config/plateConfig';
import { FixedToolbar } from '@/components/plate-ui/toolbar';
import { FloatingToolbar } from '@/components/plate-ui/floating-toolbar';
import { SlashCommandMenu } from '@/components/plate-ui/slash-command';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlateEditorProps {
  /** Plate JSON value (structured blocks) */
  value: Value;
  /** Called on every edit with the new structured value */
  onValueChange: (value: Value) => void;
  /** Placeholder when editor is empty */
  placeholder?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
}

const DEFAULT_VALUE: Value = [
  {
    type: 'p',
    children: [{ text: '' }],
  },
];

// ── Helpers: convert between Plate JSON and plain text ───────────────────────

/**
 * Extract plain text from Plate value (for scoring, word count, AI, export).
 */
export function plateToPlainText(value: Value): string {
  const parts: string[] = [];
  const walk = (n: any) => {
    if (!n) return;
    if (typeof n.text === 'string') parts.push(n.text);
    if (Array.isArray(n.children)) n.children.forEach(walk);
  };
  (value as any[]).forEach(walk);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Convert Plate value to Markdown-ish text (for export and AI prompts).
 */
export function plateToMarkdown(value: Value): string {
  const lines: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    const type = node.type;
    const children = Array.isArray(node.children) ? node.children : [];
    const text = children
      .map((c: any) => {
        if (typeof c.text === 'string') {
          let t = c.text;
          if (c.bold) t = `**${t}**`;
          if (c.italic) t = `*${t}*`;
          if (c.code) t = `\`${t}\``;
          return t;
        }
        return '';
      })
      .join('');

    if (type === 'h1') return lines.push(`# ${text}`);
    if (type === 'h2') return lines.push(`## ${text}`);
    if (type === 'h3') return lines.push(`### ${text}`);
    if (type === 'h4') return lines.push(`#### ${text}`);
    if (type === 'h5') return lines.push(`##### ${text}`);
    if (type === 'h6') return lines.push(`###### ${text}`);
    if (type === 'blockquote') return lines.push(`> ${text}`);
    if (type === 'code_block' || type === 'codeBlock') return lines.push('```', text, '```');
    if (type === 'li' || type === 'list_item') return lines.push(`- ${text}`);
    if (type === 'hr') return lines.push('---');

    // Default paragraph
    if (text.trim()) lines.push(text);

    // Recurse into non-text children blocks
    for (const c of children) {
      if (c && typeof c === 'object' && !('text' in c)) walk(c);
    }
  };
  (value as any[]).forEach(walk);
  return lines.join('\n\n').trim() + '\n';
}

/**
 * Convert a plain-text string into Plate Value (for loading legacy content).
 * Handles basic markdown headings, lists, blockquotes, code blocks.
 */
export function plainTextToPlate(text: string): Value {
  if (!text || !text.trim()) return DEFAULT_VALUE;

  const lines = text.split('\n');
  const nodes: any[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    // Code block toggle
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        nodes.push({ type: 'code_block', children: [{ text: codeLines.join('\n') }] });
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue; // skip blank lines

    // Headings
    if (trimmed.startsWith('# ')) {
      nodes.push({ type: 'h1', children: [{ text: trimmed.slice(2) }] });
    } else if (trimmed.startsWith('## ')) {
      nodes.push({ type: 'h2', children: [{ text: trimmed.slice(3) }] });
    } else if (trimmed.startsWith('### ')) {
      nodes.push({ type: 'h3', children: [{ text: trimmed.slice(4) }] });
    } else if (trimmed.startsWith('#### ')) {
      nodes.push({ type: 'h4', children: [{ text: trimmed.slice(5) }] });
    } else if (trimmed.startsWith('> ')) {
      nodes.push({ type: 'blockquote', children: [{ text: trimmed.slice(2) }] });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      // Collect consecutive list items
      nodes.push({ type: 'li', children: [{ text: trimmed.slice(2) }] });
    } else if (trimmed === '---' || trimmed === '***') {
      nodes.push({ type: 'hr', children: [{ text: '' }] });
    } else {
      // Plain paragraph
      nodes.push({ type: 'p', children: [{ text: line }] });
    }
  }

  // Handle unclosed code block
  if (inCodeBlock && codeLines.length) {
    nodes.push({ type: 'code_block', children: [{ text: codeLines.join('\n') }] });
  }

  return nodes.length > 0 ? (nodes as Value) : DEFAULT_VALUE;
}

/**
 * Check if a string is likely Plate JSON (starts with '[' and contains 'type').
 */
export function isPlateJSON(content: string): boolean {
  if (!content) return false;
  const t = content.trim();
  return t.startsWith('[') && t.includes('"type"');
}

/**
 * Parse content: if it's Plate JSON, parse it; if it's plain text, convert it.
 */
export function parseContent(content: string | null | undefined): Value {
  if (!content) return DEFAULT_VALUE;
  if (isPlateJSON(content)) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as Value;
    } catch {
      // Fall through to text conversion
    }
  }
  return plainTextToPlate(content);
}

// ── Component ────────────────────────────────────────────────────────────────

export function WriterPlateEditor({
  value,
  onValueChange,
  placeholder = 'Start writing your article...\n\nTip: Type / for slash commands, or use the toolbar above.',
  readOnly = false,
}: PlateEditorProps) {
  return (
    <DndProvider backend={HTML5Backend}>
      <Plate
        plugins={platePlugins}
        value={value}
        onChange={(newValue: Value) => {
          onValueChange(newValue);
        }}
      >
        <div className="flex flex-col h-full">
          {!readOnly && <FixedToolbar />}
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
            <div className="mx-auto max-w-3xl">
              <PlateContent
                placeholder={placeholder}
                readOnly={readOnly}
                className="min-h-[500px] outline-none text-sm leading-relaxed"
                style={{ fontFamily: "'Merriweather', serif", fontSize: '15px', lineHeight: '1.8' }}
              />
            </div>
          </div>
          {!readOnly && <FloatingToolbar />}
          {!readOnly && <SlashCommandMenu />}
        </div>
      </Plate>
    </DndProvider>
  );
}
