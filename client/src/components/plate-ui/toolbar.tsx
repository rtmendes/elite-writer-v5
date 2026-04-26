import React from 'react';
import { Toolbar, MarkToolbarButton, BlockToolbarButton } from '@udecode/plate-ui-toolbar';
import {
  MARK_BOLD,
  MARK_CODE,
  MARK_ITALIC,
  MARK_STRIKETHROUGH,
  MARK_UNDERLINE,
} from '@udecode/plate-basic-marks';
import { ELEMENT_H1, ELEMENT_H2, ELEMENT_H3 } from '@udecode/plate-heading';
import { ELEMENT_BLOCKQUOTE } from '@udecode/plate-block-quote';
import { ELEMENT_CODE_BLOCK } from '@udecode/plate-code-block';
import { ELEMENT_HR } from '@udecode/plate-horizontal-rule';

import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Minus,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react';

export function FixedToolbar() {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-1 px-4 py-2">
        <Toolbar>
          <MarkToolbarButton type={MARK_BOLD} tooltip="Bold">
            <Bold className="h-4 w-4" />
          </MarkToolbarButton>
          <MarkToolbarButton type={MARK_ITALIC} tooltip="Italic">
            <Italic className="h-4 w-4" />
          </MarkToolbarButton>
          <MarkToolbarButton type={MARK_UNDERLINE} tooltip="Underline">
            <Underline className="h-4 w-4" />
          </MarkToolbarButton>
          <MarkToolbarButton type={MARK_STRIKETHROUGH} tooltip="Strikethrough">
            <Strikethrough className="h-4 w-4" />
          </MarkToolbarButton>
          <MarkToolbarButton type={MARK_CODE} tooltip="Inline code">
            <Code className="h-4 w-4" />
          </MarkToolbarButton>

          <div className="mx-1 h-6 w-px bg-slate-800" />

          <BlockToolbarButton type={ELEMENT_H1} tooltip="Heading 1">
            <Heading1 className="h-4 w-4" />
          </BlockToolbarButton>
          <BlockToolbarButton type={ELEMENT_H2} tooltip="Heading 2">
            <Heading2 className="h-4 w-4" />
          </BlockToolbarButton>
          <BlockToolbarButton type={ELEMENT_H3} tooltip="Heading 3">
            <Heading3 className="h-4 w-4" />
          </BlockToolbarButton>
          <BlockToolbarButton type={ELEMENT_BLOCKQUOTE} tooltip="Quote">
            <Quote className="h-4 w-4" />
          </BlockToolbarButton>
          <BlockToolbarButton type={ELEMENT_CODE_BLOCK} tooltip="Code block">
            <Code className="h-4 w-4" />
          </BlockToolbarButton>
          <BlockToolbarButton type={ELEMENT_HR} tooltip="Divider">
            <Minus className="h-4 w-4" />
          </BlockToolbarButton>
        </Toolbar>
      </div>
    </div>
  );
}

