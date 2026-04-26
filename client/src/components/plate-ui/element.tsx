import React from 'react';
import type { PlateRenderElementProps } from '@udecode/plate-common';

const blockBase =
  'group relative rounded-md px-1 py-0.5 transition-colors focus-within:ring-2 focus-within:ring-primary/30 hover:bg-muted/30';

export function ParagraphElement(props: PlateRenderElementProps) {
  const { attributes, children } = props;
  return (
    <p {...attributes} className={blockBase + ' my-2 leading-7 text-foreground'}>
      {children}
    </p>
  );
}

export function HeadingElement(props: PlateRenderElementProps) {
  const { attributes, children, element } = props as any;
  const type = element?.type as string;
  const Tag =
    type === 'h1'
      ? 'h1'
      : type === 'h2'
        ? 'h2'
        : type === 'h3'
          ? 'h3'
          : type === 'h4'
            ? 'h4'
            : type === 'h5'
              ? 'h5'
              : 'h6';
  const size =
    Tag === 'h1'
      ? 'text-3xl'
      : Tag === 'h2'
        ? 'text-2xl'
        : Tag === 'h3'
          ? 'text-xl'
          : 'text-lg';
  return (
    <Tag {...attributes} className={blockBase + ` my-3 font-semibold ${size} text-foreground`}>
      {children}
    </Tag>
  );
}

export function BlockquoteElement(props: PlateRenderElementProps) {
  const { attributes, children } = props;
  return (
    <blockquote
      {...attributes}
      className={
        blockBase +
        ' my-3 border-l-2 border-border pl-4 italic text-foreground/80'
      }
    >
      {children}
    </blockquote>
  );
}

export function CodeBlockElement(props: PlateRenderElementProps) {
  const { attributes, children } = props;
  return (
    <pre
      {...attributes}
      className={
        'my-3 overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-sm text-foreground'
      }
    >
      {children}
    </pre>
  );
}

export function HrElement(props: PlateRenderElementProps) {
  const { attributes } = props;
  return <hr {...attributes} className="my-6 border-border" />;
}

export function ListElement(props: PlateRenderElementProps) {
  const { attributes, children, element } = props as any;
  const Tag = element?.type === 'ol' ? 'ol' : 'ul';
  return (
    <Tag
      {...attributes}
      className={blockBase + ' my-2 pl-6 text-foreground'}
      style={{ listStyleType: Tag === 'ol' ? 'decimal' : 'disc' }}
    >
      {children}
    </Tag>
  );
}

export function ListItemElement(props: PlateRenderElementProps) {
  const { attributes, children } = props;
  return (
    <li {...attributes} className="my-1">
      {children}
    </li>
  );
}

export function TableElement(props: PlateRenderElementProps) {
  const { attributes, children } = props;
  return (
    <div {...attributes} className="my-4 overflow-x-auto">
      <table className="w-full border-collapse overflow-hidden rounded-lg border border-border">
        {children}
      </table>
    </div>
  );
}

export function TableRowElement(props: PlateRenderElementProps) {
  const { attributes, children } = props;
  return <tr {...attributes}>{children}</tr>;
}

export function TableCellElement(props: PlateRenderElementProps) {
  const { attributes, children, element } = props as any;
  const Tag = element?.type === 'th' ? 'th' : 'td';
  return (
    <Tag
      {...attributes}
      className="min-w-[120px] border border-border px-3 py-2 align-top text-sm text-foreground"
    >
      {children}
    </Tag>
  );
}

export function ImageElement(props: PlateRenderElementProps) {
  const { attributes, children, element } = props as any;
  const url = element?.url || element?.src;
  return (
    <div {...attributes} className={blockBase + ' my-4'}>
      {url ? (
        <img
          src={url}
          alt={element?.alt || 'Image'}
          className="max-h-[520px] w-full rounded-lg border border-border object-contain"
        />
      ) : null}
      {children}
    </div>
  );
}

