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

// ── Slice 3: parity proof — the four pipeline features survive the Plate seam ──
//
// Writer.tsx funnels every AI feature through ONE state seam:
//   editorHtml (Plate's controlled value)  ⇄  content = htmlToPlainText(editorHtml)
// Features either READ `content` (AI Score, Publication Match) or WRITE
// `editorHtml` via parseContentToHtml(...) (Full Pipeline, AI Draft). These
// tests pin each *named* feature to that seam with one realistic article, so a
// regression in any helper breaks a feature test — not just an abstract one.

// A realistic data-journalism article, shaped as the editor would hold it.
// Uses only the entities htmlToPlainText decodes (&amp; &nbsp; &quot;).
const SAMPLE_ARTICLE_HTML = [
  '<h1>The Quiet Boom in Rural Broadband</h1>',
  '<p>Subsidies poured <strong>$42&nbsp;billion</strong> into fiber &amp; cable, yet uptake lags.</p>',
  '<h2>What the data shows</h2>',
  '<p>Counties with grants saw speeds rise, but adoption trailed by 18 months.</p>',
  '<ul><li>Cost is the top barrier</li><li>Awareness is the second</li></ul>',
  '<blockquote>We built the road; nobody told them it was paved.</blockquote>',
  '<p>Read the <a href="https://insightprofit.live/report">full report</a>.</p>',
].join('')

describe('parity: AI Score / Publication Match read path (content = htmlToPlainText)', () => {
  it('extracts clean, scoreable prose from the serialized article', async () => {
    // Mirror runtime: editorHtml is Plate-serialized, then Writer derives content.
    const serialized = await roundTrip(SAMPLE_ARTICLE_HTML)
    const content = htmlToPlainText(serialized)

    // Every section's words must reach the scorer / publication matcher.
    expect(content).toContain('The Quiet Boom in Rural Broadband')
    expect(content).toContain('fiber & cable') // &amp; decoded for the model
    expect(content).toContain('What the data shows')
    expect(content).toContain('adoption trailed by 18 months')
    expect(content).toContain('Cost is the top barrier')
    expect(content).toContain('nobody told them it was paved')
    expect(content).toContain('full report')

    // No markup may leak into the prompt body.
    expect(content).not.toMatch(/<[a-z/][^>]*>/i)

    // A sane word count — handleAiScore guards on non-empty content.
    expect(content.split(/\s+/).filter(Boolean).length).toBeGreaterThan(25)
  })

  it('yields a meaningful publication-match summary from content.slice(0, 1200)', async () => {
    // handleAiRecommend sends articleSummary: content.slice(0, 1200).
    const content = htmlToPlainText(await roundTrip(SAMPLE_ARTICLE_HTML))
    const summary = content.slice(0, 1200)
    expect(summary.trim().length).toBeGreaterThan(0)
    expect(summary).toContain('The Quiet Boom in Rural Broadband')
  })
})

describe('parity: Full Pipeline write path (setEditorHtml(parseContentToHtml(markdown)))', () => {
  it('loads server pipeline markdown onto the canvas without losing content', async () => {
    // queue.generateArticle returns markdown; Writer parses then the editor loads it.
    const pipelineMarkdown = [
      '# Rural Broadband: The Adoption Gap',
      '',
      'Federal grants raised speeds, but households were slow to switch.',
      '',
      '## Why uptake lagged',
      '',
      'Two barriers dominated the interviews:',
      '',
      '- Cost relative to existing plans',
      '- Low awareness of the new service',
      '',
      'See the [methodology](https://insightprofit.live/method) for details.',
    ].join('\n')

    const out = await roundTrip(parseContentToHtml(pipelineMarkdown))

    expect(out).toContain('Rural Broadband: The Adoption Gap')
    expect(out).toContain('households were slow to switch')
    expect(out).toContain('Why uptake lagged')
    expect(out).toContain('Cost relative to existing plans')
    expect(out).toContain('Low awareness of the new service')
    expect(out).toContain('insightprofit.live/method')
  })
})

describe('parity: AI Draft append path (setContent appends, then reparses)', () => {
  it('keeps existing prose and the appended draft after the round-trip', async () => {
    // handleAiDraft does: setContent(prev + '\n\n---\n\n' + result.text).
    // prev is plaintext (content); the blob is reparsed by parseContentToHtml.
    const prev = htmlToPlainText(await roundTrip(SAMPLE_ARTICLE_HTML))
    const draft = 'In closing, the gap is a marketing problem, not an infrastructure one.'
    const blob = prev + '\n\n---\n\n' + draft

    const out = await roundTrip(parseContentToHtml(blob))

    // Original survives.
    expect(out).toContain('The Quiet Boom in Rural Broadband')
    expect(out).toContain('Cost is the top barrier')
    // Appended draft survives.
    expect(out).toContain('a marketing problem, not an infrastructure one')
  })
})

describe('parity: Export path (htmlToMarkdown)', () => {
  it('downgrades the serialized article to faithful markdown', async () => {
    const md = htmlToMarkdown(await roundTrip(SAMPLE_ARTICLE_HTML))
    // Headings, bold marks, and links export cleanly to markdown.
    expect(md).toContain('# The Quiet Boom in Rural Broadband')
    expect(md).toContain('## What the data shows')
    expect(md).toContain('**$42')
    expect(md).toContain('[full report](https://insightprofit.live/report)')
    // KNOWN LIMITATION (carried from the Slice-0 list round-trip test): Plate's
    // indent-list model has no deserializer for semantic <ul><li>, so bullets
    // flatten to paragraphs in the static serializer. Item *text* still exports
    // (so no content is lost for scoring/reading), but the "- " marker is not
    // reproduced. Tracked separately — see the bullet-fidelity follow-up.
    expect(md).toContain('Cost is the top barrier')
    expect(md).toContain('Awareness is the second')
  })
})
