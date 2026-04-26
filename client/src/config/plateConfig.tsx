import React from 'react';

import type { PlatePlugin, Value } from '@udecode/plate-common';
import { createPlugins } from '@udecode/plate-common';

import {
  createParagraphPlugin,
  createHeadingPlugin,
  createBlockquotePlugin,
  createCodeBlockPlugin,
  createHorizontalRulePlugin,
  createBoldPlugin,
  createItalicPlugin,
  createUnderlinePlugin,
  createStrikethroughPlugin,
  createCodePlugin,
  createSubscriptPlugin,
  createSuperscriptPlugin,
  createAutoformatPlugin,
  createAlignPlugin,
  createIndentPlugin,
  createHistoryPlugin,
  createHighlightPlugin,
} from '@udecode/plate';

import { createListPlugin } from '@udecode/plate-list';
import { createLinkPlugin } from '@udecode/plate-link';
import { createImagePlugin } from '@udecode/plate-media';
import { createTablePlugin } from '@udecode/plate-table';

import { createIndentListPlugin } from '@udecode/plate-indent-list';
import { createLineHeightPlugin } from '@udecode/plate-line-height';
import { createNodeIdPlugin } from '@udecode/plate-node-id';
import { createResetNodePlugin } from '@udecode/plate-reset-node';
import { createSelectOnBackspacePlugin } from '@udecode/plate-select';
import { createTrailingBlockPlugin } from '@udecode/plate-trailing-block';
import { createExitBreakPlugin, createSoftBreakPlugin } from '@udecode/plate-break';
import { createDndPlugin } from '@udecode/plate-dnd';

import {
  ELEMENT_BLOCKQUOTE,
} from '@udecode/plate-block-quote';
import { ELEMENT_CODE_BLOCK } from '@udecode/plate-code-block';
import { ELEMENT_H1, ELEMENT_H2, ELEMENT_H3, ELEMENT_H4, ELEMENT_H5, ELEMENT_H6 } from '@udecode/plate-heading';
import { ELEMENT_HR } from '@udecode/plate-horizontal-rule';
import { ELEMENT_PARAGRAPH } from '@udecode/plate-paragraph';
import { ELEMENT_IMAGE } from '@udecode/plate-media';
import { ELEMENT_TABLE, ELEMENT_TD, ELEMENT_TH, ELEMENT_TR } from '@udecode/plate-table';
import { ELEMENT_LI, ELEMENT_OL, ELEMENT_UL } from '@udecode/plate-list';

import { withPlateDraggables } from '@udecode/plate-ui-dnd';

import {
  BlockquoteElement,
  CodeBlockElement,
  HeadingElement,
  HrElement,
  ImageElement,
  ListItemElement,
  ListElement,
  ParagraphElement,
  TableCellElement,
  TableElement,
  TableRowElement,
} from '@/components/plate-ui/element';
import { DragHandle } from '@/components/plate-ui/drag-handle';

/**
 * Plate plugins configuration (v21 line) that mirrors the intent of the Playground config:
 * - Rich blocks + marks
 * - Alignment/indentation
 * - Autoformat, reset-node, soft/exit breaks
 * - Node IDs (collab-ready)
 * - Select-on-backspace + trailing block
 *
 * Note:
 * - The official Plate playground (platejs) uses newer @platejs/* packages.
 *   This project is on @udecode/plate v21, so we implement the same capabilities with v21 APIs.
 */
export const platePlugins: PlatePlugin<Value>[] = createPlugins(
  [
    createHistoryPlugin(),
    createDndPlugin(),

    // Basic blocks
    createParagraphPlugin(),
    createHeadingPlugin({ options: { levels: 6 } as any }),
    createBlockquotePlugin(),
    createCodeBlockPlugin(),
    createHorizontalRulePlugin(),

    // Marks
    createBoldPlugin(),
    createItalicPlugin(),
    createUnderlinePlugin(),
    createStrikethroughPlugin(),
    createCodePlugin(),
    createSubscriptPlugin(),
    createSuperscriptPlugin(),
    createHighlightPlugin(),

    // Lists, links, media, tables
    createListPlugin(),
    createLinkPlugin(),
    createImagePlugin(),
    createTablePlugin(),

    // Layout
    createAlignPlugin(),
    createIndentPlugin(),
    createIndentListPlugin(),
    createLineHeightPlugin(),

    // Behavior
    createAutoformatPlugin(),
    createResetNodePlugin(),
    createSoftBreakPlugin(),
    createExitBreakPlugin(),
    createNodeIdPlugin(),
    createSelectOnBackspacePlugin(),
    createTrailingBlockPlugin(),
  ],
  {
    components: withPlateDraggables(
      {
        [ELEMENT_PARAGRAPH]: ParagraphElement,
        [ELEMENT_H1]: HeadingElement,
        [ELEMENT_H2]: HeadingElement,
        [ELEMENT_H3]: HeadingElement,
        [ELEMENT_H4]: HeadingElement,
        [ELEMENT_H5]: HeadingElement,
        [ELEMENT_H6]: HeadingElement,
        [ELEMENT_BLOCKQUOTE]: BlockquoteElement,
        [ELEMENT_CODE_BLOCK]: CodeBlockElement,
        [ELEMENT_HR]: HrElement,
        [ELEMENT_UL]: ListElement,
        [ELEMENT_OL]: ListElement,
        [ELEMENT_LI]: ListItemElement,
        [ELEMENT_TABLE]: TableElement,
        [ELEMENT_TR]: TableRowElement,
        [ELEMENT_TD]: TableCellElement,
        [ELEMENT_TH]: TableCellElement,
        [ELEMENT_IMAGE]: ImageElement,
      },
      {
        // left gutter drag handle
        level: 0,
        onRenderDragHandle: (props: any) => <DragHandle {...props} />,
      }
    ),
  }
);

