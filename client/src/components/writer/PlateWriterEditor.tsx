'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSlateEditor, type Value } from 'platejs'
import { Plate, usePlateEditor } from 'platejs/react'
import { getEditorDOMFromHtmlString, serializeHtml } from 'platejs/static'

import { EditorContainer, Editor } from '@/components/ui/editor'
import { EditorStatic } from '@/components/ui/editor-static'
import { BaseEditorKit } from '@/components/editor/editor-base-kit'
import { InlineAIProvider, type InlineAIRewrite } from '@/components/writer/inline-ai-context'

// Curated, article-editing plugin kits (live React UI) ────────────────────────
import { BasicNodesKit } from '@/components/editor/plugins/basic-nodes-kit'
import { IndentKit } from '@/components/editor/plugins/indent-kit'
import { ListKit } from '@/components/editor/plugins/list-kit'
import { FontKit } from '@/components/editor/plugins/font-kit'
import { AlignKit } from '@/components/editor/plugins/align-kit'
import { LineHeightKit } from '@/components/editor/plugins/line-height-kit'
import { LinkKit } from '@/components/editor/plugins/link-kit'
import { TableKit } from '@/components/editor/plugins/table-kit'
import { CodeBlockKit } from '@/components/editor/plugins/code-block-kit'
import { MediaKit } from '@/components/editor/plugins/media-kit'
import { AutoformatKit } from '@/components/editor/plugins/autoformat-kit'
import { ExitBreakKit } from '@/components/editor/plugins/exit-break-kit'
import { DndKit } from '@/components/editor/plugins/dnd-kit'
import { SlashKit } from '@/components/editor/plugins/slash-kit'
import { FixedToolbarKit } from '@/components/editor/plugins/fixed-toolbar-kit'
import { FloatingToolbarKit } from '@/components/editor/plugins/floating-toolbar-kit'
import { BlockPlaceholderKit } from '@/components/editor/plugins/block-placeholder-kit'
import { MarkdownKit } from '@/components/editor/plugins/markdown-kit'

import { useTheme } from '@/contexts/ThemeContext'

// ── Types ────────────────────────────────────────────────────────────────────

export interface PlateWriterEditorProps {
  /** HTML string or markdown string (controlled value) */
  value: string
  /** Called (debounced) on every edit with new HTML content */
  onValueChange: (html: string) => void
  /** Placeholder when editor is empty */
  placeholder?: string
  /** Read-only mode */
  readOnly?: boolean
  /**
   * Inline AI rewrite handler. When provided, the floating toolbar's "Ask AI"
   * dropdown rewrites the current selection via this callback. When omitted,
   * the button hides itself.
   */
  onAIRewrite?: InlineAIRewrite
}

const EMPTY_VALUE: Value = [{ type: 'p', children: [{ text: '' }] }]

// ── HTML detection ───────────────────────────────────────────────────────────
// (framework-agnostic helpers — kept identical to the prior editor so that
//  Writer.tsx's scoring / save / insert pipeline behaves the same)

function detectIsHtml(content: string): boolean {
  const htmlTagPattern =
    /<(div|p|h[1-6]|ul|ol|li|table|tr|td|th|span|a|img|section|article|header|footer|main|nav|blockquote|pre|code|br|hr|strong|em|b|i|iframe|figure)\b[^>]*>/i
  if (htmlTagPattern.test(content)) {
    const tagCount = (content.match(/<[a-z][a-z0-9]*[\s>]/gi) || []).length
    if (tagCount >= 3) return true
  }
  return false
}

// ── Markdown → HTML converter ────────────────────────────────────────────────

function markdownToHtml(md: string): string {
  let html = md
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang || 'text'}">${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
  })
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>')
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/^\d+[.)]\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/^[-*_]{3,}$/gm, '<hr />')
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (/^<(h[1-6]|pre|blockquote|li|hr|ul|ol|table|img|iframe|figure)/.test(trimmed)) return trimmed
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`
    })
    .join('\n')
  return html
}

// ── List fidelity: annotate <li> for Plate's indent-list model ───────────────
// Plate's @platejs/list uses the *indent-list* approach: list items are
// paragraph nodes carrying `indent` + `listStyleType` props, not semantic
// <ul>/<li>. Its HTML deserializer only infers listStyleType from the <li>'s
// OWN `style`/`data-*` attributes — a plain semantic <ul><li>alpha</li></ul>
// (what the AI pipeline and markdownToHtml emit) carries none, so each item
// silently collapses to a bare paragraph and the bullet marker is lost.
//
// This stamps each <li> with the attributes the deserializer reads:
//   data-list-style-type  decimal if the nearest list ancestor is <ol>, else disc
//   data-indent           nesting depth (≥1)
// Idempotent (re-stamping yields the same value) and a no-op when there are no
// <li> at all, so non-list HTML round-trips byte-identically.
function annotateListsForPlate(html: string): string {
  if (!/<li\b/i.test(html)) return html
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('li').forEach((li) => {
      let depth = 0
      let ordered = false
      let seenList = false
      for (let n: Element | null = li.parentElement; n; n = n.parentElement) {
        const tag = n.tagName.toLowerCase()
        if (tag === 'ul' || tag === 'ol') {
          depth++
          if (!seenList) {
            ordered = tag === 'ol'
            seenList = true
          }
        }
      }
      li.setAttribute('data-indent', String(Math.max(depth, 1)))
      li.setAttribute('data-list-style-type', ordered ? 'decimal' : 'disc')
    })
    return doc.body.innerHTML
  } catch {
    return html // DOMParser unavailable (non-browser) — leave content as-is
  }
}

export function prepareContentForEditor(content: string): string {
  if (!content || content.trim() === '') return '<p></p>'
  return annotateListsForPlate(detectIsHtml(content) ? content : markdownToHtml(content))
}

// ── Extract plain text (consumed by Writer.tsx for word count / scoring) ──────

export function htmlToPlainText(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  let md = html
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)')
  md = md.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n\n')
  // Plate's static serializer renders *unordered* (disc) list items as
  // <div role="listitem" style="display:list-item"> with no <li> wrapper, while
  // *ordered* items keep a real <ol><li>. Convert the former to bullets first,
  // then the generic <li> rule below handles the latter.
  md = md.replace(/<div[^>]*role="listitem"[^>]*>([\s\S]*?)<\/div>/gi, '- $1\n')
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
  md = md.replace(/<hr[^>]*\/?>/gi, '---\n\n')
  md = md.replace(/<br[^>]*\/?>/gi, '\n')
  md = md.replace(/<\/p>/gi, '\n\n')
  md = md.replace(/<[^>]*>/g, '')
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  md = md.replace(/\n{3,}/g, '\n\n').trim()
  return md + '\n'
}

// ── Parse any stored content into HTML for the editor ────────────────────────
// Handles legacy Plate-JSON (v21 array) and markdown, falling back to HTML.

export function parseContentToHtml(content: string | null | undefined): string {
  if (!content) return '<p></p>'

  const t = content.trim()
  if (t.startsWith('[') && t.includes('"children"')) {
    try {
      const parsed = JSON.parse(t)
      if (Array.isArray(parsed)) {
        const lines: string[] = []
        const walk = (node: any) => {
          if (!node) return
          const type = node.type
          const children = Array.isArray(node.children) ? node.children : []
          const text = children.map((c: any) => (typeof c.text === 'string' ? c.text : '')).join('')
          if (type === 'h1') { lines.push(`<h1>${text}</h1>`); return }
          if (type === 'h2') { lines.push(`<h2>${text}</h2>`); return }
          if (type === 'h3') { lines.push(`<h3>${text}</h3>`); return }
          if (type === 'blockquote') { lines.push(`<blockquote>${text}</blockquote>`); return }
          if (text.trim()) lines.push(`<p>${text}</p>`)
          for (const c of children) {
            if (c && typeof c === 'object' && !('text' in c)) walk(c)
          }
        }
        parsed.forEach(walk)
        return lines.join('\n') || '<p></p>'
      }
    } catch { /* fall through */ }
  }

  return prepareContentForEditor(content)
}

// ── Main Editor Component ────────────────────────────────────────────────────

export function PlateWriterEditor({
  value,
  onValueChange,
  placeholder = 'Start writing your article... Type / for slash commands.',
  readOnly = false,
  onAIRewrite,
}: PlateWriterEditorProps) {
  const { theme } = useTheme()
  const [showSource, setShowSource] = useState(false)
  const [sourceHtml, setSourceHtml] = useState('')

  // Keep latest onValueChange without re-subscribing the editor.
  const onChangeRef = useRef(onValueChange)
  onChangeRef.current = onValueChange

  // Echo-loop guards: the HTML we last emitted, and the last external value we loaded.
  const lastEmittedHtmlRef = useRef<string>('')
  const lastExternalValueRef = useRef<string>(value)
  const loadedRef = useRef(false)
  const serializeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const editor = usePlateEditor({
    plugins: [
      ...BasicNodesKit,
      ...IndentKit,
      ...ListKit,
      ...FontKit,
      ...AlignKit,
      ...LineHeightKit,
      ...LinkKit,
      ...TableKit,
      ...CodeBlockKit,
      ...MediaKit,
      ...MarkdownKit,
      ...AutoformatKit,
      ...ExitBreakKit,
      ...DndKit,
      ...SlashKit,
      ...FixedToolbarKit,
      ...FloatingToolbarKit,
      ...BlockPlaceholderKit,
    ],
  })

  // HTML → Slate nodes → replace whole document (canonical v53 import path).
  const loadHtmlIntoEditor = useCallback(
    (html: string) => {
      try {
        // deserialize accepts a raw HTML string and builds the DOM itself.
        // (getEditorDOMFromHtmlString only finds Plate's own [data-slate-editor]
        // wrapper, so it returns null on plain article HTML — do not use it here.)
        const nodes = editor.api.html.deserialize({
          element: prepareContentForEditor(html),
        })
        editor.tf.setValue(nodes && nodes.length ? (nodes as Value) : EMPTY_VALUE)
      } catch (e) {
        console.error('PlateWriterEditor: failed to load HTML', e)
      }
    },
    [editor]
  )

  // Serialize current document → HTML (async, via a throwaway static editor +
  // the static render components, matching this app's export pipeline).
  const serializeToHtml = useCallback(async (): Promise<string> => {
    const staticEditor = createSlateEditor({
      plugins: BaseEditorKit,
      value: editor.children,
    })
    return serializeHtml(staticEditor, { editorComponent: EditorStatic })
  }, [editor])

  // Debounced change → emit HTML to parent.
  const scheduleEmit = useCallback(() => {
    if (serializeTimer.current) clearTimeout(serializeTimer.current)
    serializeTimer.current = setTimeout(async () => {
      try {
        const html = await serializeToHtml()
        lastEmittedHtmlRef.current = html
        onChangeRef.current(html)
        if (showSource) setSourceHtml(html)
      } catch (e) {
        /* transient serialization error during rapid edits — ignore */
      }
    }, 400)
  }, [serializeToHtml, showSource])

  // Initial load (once).
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadHtmlIntoEditor(value)
    lastExternalValueRef.current = value
  }, [value, loadHtmlIntoEditor])

  // External value updates (AI draft, template insert, research append, hydration).
  useEffect(() => {
    if (!loadedRef.current) return
    if (value === lastEmittedHtmlRef.current) return // our own echo — skip
    if (value === lastExternalValueRef.current) return
    lastExternalValueRef.current = value
    loadHtmlIntoEditor(value)
  }, [value, loadHtmlIntoEditor])

  // Cleanup pending serialize on unmount.
  useEffect(() => () => {
    if (serializeTimer.current) clearTimeout(serializeTimer.current)
  }, [])

  const handleToggleSource = useCallback(async () => {
    if (!showSource) {
      try {
        setSourceHtml(await serializeToHtml())
      } catch { /* ignore */ }
    }
    setShowSource((s) => !s)
  }, [showSource, serializeToHtml])

  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newHtml = e.target.value
      setSourceHtml(newHtml)
      loadHtmlIntoEditor(newHtml)
      lastEmittedHtmlRef.current = newHtml
      lastExternalValueRef.current = newHtml
      onChangeRef.current(newHtml)
    },
    [loadHtmlIntoEditor]
  )

  return (
    <div className="writer-editor-wrapper h-full flex flex-col overflow-hidden" data-color-scheme={theme}>
      {/* Hint toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/50 shrink-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>💡</span>
          <span>
            Type <kbd className="px-1 py-0.5 rounded bg-muted text-foreground/70 font-mono text-[10px]">/</kbd> for
            slash commands · Drag blocks via <span className="text-foreground/70 font-bold">⠿</span> handle · Drop files to upload · <kbd className="px-1 py-0.5 rounded bg-muted text-foreground/70 font-mono text-[10px]">Tab</kbd> to nest
          </span>
        </div>
        <button
          type="button"
          onClick={handleToggleSource}
          title="View/Edit HTML Source"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
            showSource
              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          {showSource ? 'Rich Editor' : 'HTML Source'}
        </button>
      </div>

      {showSource ? (
        <div className="relative flex-1 overflow-auto">
          <div className="absolute top-2 right-3 text-[10px] font-mono text-muted-foreground uppercase tracking-wider select-none z-10">
            HTML Source
          </div>
          <textarea
            value={sourceHtml}
            onChange={handleSourceChange}
            className="w-full h-full min-h-[500px] px-6 py-5 pt-8 bg-background text-foreground font-mono text-sm leading-6 resize-none focus:outline-none"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="writer-plate-container flex-1 overflow-hidden min-h-0">
          <InlineAIProvider rewrite={onAIRewrite}>
            <Plate editor={editor} onValueChange={scheduleEmit} readOnly={readOnly}>
              <EditorContainer>
                <Editor variant="default" placeholder={placeholder} readOnly={readOnly} />
              </EditorContainer>
            </Plate>
          </InlineAIProvider>
        </div>
      )}
    </div>
  )
}
