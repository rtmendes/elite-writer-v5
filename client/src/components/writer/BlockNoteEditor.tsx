'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BlockNoteEditor,
  PartialBlock,
  filterSuggestionItems,
  insertOrUpdateBlock,
} from '@blocknote/core'
import {
  useCreateBlockNote,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { MantineProvider, createTheme } from '@mantine/core'
import '@mantine/core/styles.css'

// ── Types ────────────────────────────────────────────────────────────────────

export interface WriterBlockNoteEditorProps {
  /** HTML string or markdown string */
  value: string
  /** Called on every edit with new HTML content */
  onValueChange: (html: string) => void
  /** Placeholder when editor is empty */
  placeholder?: string
  /** Read-only mode */
  readOnly?: boolean
}

// ── HTML detection ───────────────────────────────────────────────────────────

function detectIsHtml(content: string): boolean {
  const htmlTagPattern =
    /<(div|p|h[1-6]|ul|ol|li|table|tr|td|th|span|a|img|section|article|header|footer|main|nav|blockquote|pre|code|br|hr|strong|em|b|i)\b[^>]*>/i
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
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/^\d+[.)]\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/^[-*_]{3,}$/gm, '<hr />')
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim()
      if (!trimmed) return ''
      if (/^<(h[1-6]|pre|blockquote|li|hr|ul|ol|table|img)/.test(trimmed)) return trimmed
      return `<p>${trimmed.replace(/\n/g, '<br />')}</p>`
    })
    .join('\n')
  return html
}

function prepareContentForEditor(content: string): string {
  if (!content || content.trim() === '') return '<p></p>'
  if (detectIsHtml(content)) return content
  return markdownToHtml(content)
}

// ── Extract plain text ───────────────────────────────────────────────────────

export function htmlToPlainText(html: string): string {
  if (!html) return ''
  // Strip HTML tags for plain text
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
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
  md = md.replace(/<hr[^>]*\/?>/gi, '---\n\n')
  md = md.replace(/<br[^>]*\/?>/gi, '\n')
  md = md.replace(/<\/p>/gi, '\n\n')
  md = md.replace(/<[^>]*>/g, '')
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  md = md.replace(/\n{3,}/g, '\n\n').trim()
  return md + '\n'
}

// ── Check if content is BlockNote blocks JSON ────────────────────────────────

export function isBlockNoteJSON(content: string): boolean {
  if (!content) return false
  const t = content.trim()
  return t.startsWith('[') && (t.includes('"type"') || t.includes('"content"'))
}

// ── Parse any stored content into HTML for the editor ────────────────────────

export function parseContentToHtml(content: string | null | undefined): string {
  if (!content) return '<p></p>'

  // If it's Plate JSON (legacy), extract text and convert
  const t = content.trim()
  if (t.startsWith('[') && t.includes('"children"')) {
    try {
      const parsed = JSON.parse(t)
      if (Array.isArray(parsed)) {
        // Legacy Plate JSON — extract text
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

// ── Mantine theme (matches V5 dark UI) ───────────────────────────────────────

const mantineTheme = createTheme({
  primaryColor: 'yellow',
})

// ── Main Editor Component ────────────────────────────────────────────────────

export function WriterBlockNoteEditor({
  value,
  onValueChange,
  placeholder = 'Start writing your article... Type / for slash commands.',
  readOnly = false,
}: WriterBlockNoteEditorProps) {
  const [showSource, setShowSource] = useState(false)
  const [sourceHtml, setSourceHtml] = useState('')
  const onChangeRef = useRef(onValueChange)
  onChangeRef.current = onValueChange
  const initialLoadedRef = useRef(false)

  const htmlContent = useMemo(() => prepareContentForEditor(value), [value])

  // Create the full-featured BlockNote editor
  const editor = useCreateBlockNote({
    domAttributes: {
      editor: {
        class: 'writer-blocknote-editor',
        'data-color-scheme': 'dark',
      },
    },
  })

  // Load initial HTML content
  useEffect(() => {
    if (!editor || !htmlContent || initialLoadedRef.current) return
    initialLoadedRef.current = true
    ;(async () => {
      try {
        const blocks = await editor.tryParseHTMLToBlocks(htmlContent)
        editor.replaceBlocks(editor.document, blocks)
      } catch (e) {
        console.error('Failed to parse HTML into blocks:', e)
      }
    })()
  }, [editor, htmlContent])

  // Sync changes back
  useEffect(() => {
    if (!editor) return
    const handleChange = async () => {
      try {
        const html = await editor.blocksToHTMLLossy(editor.document)
        onChangeRef.current(html)
        if (showSource) setSourceHtml(html)
      } catch (e) { /* transient */ }
    }
    editor.onChange(handleChange)
  }, [editor, showSource])

  const handleToggleSource = useCallback(async () => {
    if (!editor) return
    if (!showSource) {
      setSourceHtml(await editor.blocksToHTMLLossy(editor.document))
    }
    setShowSource((s) => !s)
  }, [editor, showSource])

  const handleSourceChange = useCallback(
    async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newHtml = e.target.value
      setSourceHtml(newHtml)
      if (editor) {
        try {
          const blocks = await editor.tryParseHTMLToBlocks(newHtml)
          editor.replaceBlocks(editor.document, blocks)
        } catch { /* ignore invalid HTML */ }
        onChangeRef.current(newHtml)
      }
    },
    [editor]
  )

  // Accept external content updates (AI draft, template insert)
  const lastExternalValueRef = useRef(value)
  useEffect(() => {
    if (!editor || !initialLoadedRef.current) return
    if (value !== lastExternalValueRef.current) {
      lastExternalValueRef.current = value
      ;(async () => {
        try {
          const html = prepareContentForEditor(value)
          const blocks = await editor.tryParseHTMLToBlocks(html)
          editor.replaceBlocks(editor.document, blocks)
        } catch (e) {
          console.error('Failed to update editor from external value:', e)
        }
      })()
    }
  }, [editor, value])

  if (!editor) {
    return (
      <div className="rounded-xl border border-border bg-background p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading editor…</span>
        </div>
      </div>
    )
  }

  return (
    <MantineProvider theme={mantineTheme} forceColorScheme="dark">
      <div className="writer-editor-wrapper h-full flex flex-col overflow-hidden">
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
          <div className="writer-blocknote-container flex-1 overflow-y-auto">
            <BlockNoteView
              editor={editor}
              theme="dark"
              sideMenu={true}
              slashMenu={true}
              formattingToolbar={true}
              filePanel={true}
              tableHandles={true}
              emojiPicker={true}
            />
          </div>
        )}
      </div>
    </MantineProvider>
  )
}
