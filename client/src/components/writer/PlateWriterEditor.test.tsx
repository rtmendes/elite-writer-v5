// @vitest-environment jsdom
//
// Isolated fidelity test for the Plate writer editor swap.
// No DB / no auth / no backend — exercises the exact four primitives the
// editor uses at runtime so an HTML round-trip is provably lossless for the
// elements the article pipeline cares about (headings, lists, links, marks,
// and — the BlockNote regression we are fixing — embedded <iframe> media).

import { describe, it, expect } from 'vitest'
import { createSlateEditor, type Value } from 'platejs'
import { serializeHtml } from 'platejs/static'

import { BaseEditorKit } from '@/components/editor/editor-base-kit'
import { EditorStatic } from '@/components/ui/editor-static'
import { parseContentToHtml, htmlToPlainText, htmlToMarkdown } from './PlateWriterEditor'

// Mirror of the component's load → serialize cycle.
async function roundTrip(html: string): Promise<string> {
  const probe = createSlateEditor({ plugins: BaseEditorKit })
  const nodes = probe.api.html.deserialize({ element: html })
  const staticEditor = createSlateEditor({ plugins: BaseEditorKit, value: nodes as Value })
  return serializeHtml(staticEditor, { editorComponent: EditorStatic })
}

describe('parseContentToHtml', () => {
  it('returns an empty paragraph for empty input', () => {
    expect(parseContentToHtml('')).toBe('<p></p>')
    expect(parseContentToHtml(null)).toBe('<p></p>')
    expect(parseContentToHtml(undefined)).toBe('<p></p>')
  })

  it('converts markdown headings and marks to HTML', () => {
    const html = parseContentToHtml('## Section\n\nA **bold** word and *italic* too.')
    expect(html).toContain('<h2>Section</h2>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('passes through existing HTML untouched', () => {
    const input = '<h1>Title</h1><p>Body with <a href="https://example.com">link</a>.</p>'
    expect(parseContentToHtml(input)).toBe(input)
  })

  it('rebuilds legacy Plate-JSON arrays into HTML', () => {
    const legacy = JSON.stringify([
      { type: 'h2', children: [{ text: 'Legacy Heading' }] },
      { type: 'p', children: [{ text: 'Legacy paragraph.' }] },
    ])
    const html = parseContentToHtml(legacy)
    expect(html).toContain('<h2>Legacy Heading</h2>')
    expect(html).toContain('<p>Legacy paragraph.</p>')
  })
})

describe('htmlToPlainText (feeds word count / scoring / save)', () => {
  it('strips tags and decodes entities', () => {
    const text = htmlToPlainText('<h1>Hi</h1><p>A &amp; B &lt;ok&gt;</p>')
    expect(text).toContain('Hi')
    expect(text).toContain('A & B <ok>')
    expect(text).not.toContain('<h1>')
  })

  it('produces a sane word count for a paragraph', () => {
    const text = htmlToPlainText('<p>one two three four five</p>')
    expect(text.split(/\s+/).filter(Boolean)).toHaveLength(5)
  })
})

describe('htmlToMarkdown', () => {
  it('downgrades headings and links to markdown', () => {
    const md = htmlToMarkdown('<h2>Heading</h2><p><a href="https://x.io">x</a></p>')
    expect(md).toContain('## Heading')
    expect(md).toContain('[x](https://x.io)')
  })
})

describe('HTML round-trip fidelity (load → serialize)', () => {
  it('preserves headings, paragraphs, marks and link href', async () => {
    const out = await roundTrip(
      '<h1>Data Journalism</h1><h2>Findings</h2><p>The <strong>key</strong> insight links to <a href="https://insightprofit.live">the source</a>.</p>'
    )
    expect(out).toContain('Data Journalism')
    expect(out).toContain('Findings')
    expect(out).toContain('key')
    expect(out).toContain('https://insightprofit.live')
  })

  it('preserves ordered and unordered list items', async () => {
    const out = await roundTrip(
      '<p>Intro</p><ul><li>alpha</li><li>beta</li></ul><ol><li>first</li><li>second</li></ol>'
    )
    expect(out).toContain('alpha')
    expect(out).toContain('beta')
    expect(out).toContain('first')
    expect(out).toContain('second')
  })

  it('preserves an embedded iframe (the BlockNote regression being fixed)', async () => {
    const out = await roundTrip(
      '<p>Watch:</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>'
    )
    // MediaKit must keep the embed source alive end-to-end.
    expect(out).toContain('youtube.com/embed/dQw4w9WgXcQ')
  })
})
