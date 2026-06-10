import { useLiveQuery } from "dexie-react-hooks";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { runAI, type AIAction } from "../ai";
import { db, deletePageTree, updatePage } from "../db";
import { RichEditor, schema } from "../editor/Editor";
import { Menu, Modal } from "../ui";

const EMOJIS = ["📄", "📰", "✍️", "📚", "🧠", "🔬", "💰", "📊", "🗞️", "🎯", "🏛️", "🔥", "🌊", "⚡", "🧭", "📌", "🗂️", "💡", "🪶", "🏆"];

const AI_ACTIONS: Array<{ id: AIAction; label: string }> = [
  { id: "humanize", label: "Humanize" },
  { id: "tighten", label: "Tighten" },
  { id: "expand", label: "Expand" },
  { id: "headlines", label: "Headlines" },
  { id: "continue", label: "Continue draft" },
];

export function PageScreen({ pageId, dark, onDeleted }: { pageId: string; dark: boolean; onDeleted: () => void }) {
  const page = useLiveQuery(() => db.pages.get(pageId), [pageId]);
  const [iconAnchor, setIconAnchor] = useState<HTMLElement | null>(null);
  const [aiBusy, setAiBusy] = useState<AIAction | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  // BlockNote editor instance, captured from RichEditor
  const editorRef = useRef<any>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (!page) return null;

  const saveDoc = (doc: unknown[]) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => updatePage(page.id, { doc }), 400);
  };

  const runAction = async (action: AIAction) => {
    const editor = editorRef.current;
    if (!editor) return;
    let text: string = editor.getSelectedText?.() ?? "";
    if (!text.trim()) {
      // fall back to the whole document as plain text
      text = (editor.document as Array<{ content?: Array<{ text?: string }> }>)
        .map((b) => (Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : ""))
        .join("\n")
        .trim();
    }
    if (!text) {
      setAiError("Nothing to work with — select a passage or write something first.");
      return;
    }
    setAiBusy(action);
    setAiError(null);
    try {
      const out = await runAI(action, text);
      setAiResult(out);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(null);
    }
  };

  const insertResult = () => {
    const editor = editorRef.current;
    if (!editor || !aiResult) return;
    const paragraphs = aiResult.split(/\n+/).map((line) => ({
      type: "paragraph" as const,
      content: line,
    }));
    const last = editor.document[editor.document.length - 1];
    editor.insertBlocks(paragraphs, last, "after");
    setAiResult(null);
  };

  return (
    <div className="content-scroll">
      <div className="page-canvas">
        <button className="page-icon-btn" onClick={(e) => setIconAnchor(e.currentTarget)}>
          {page.icon}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            className="page-title-input"
            placeholder="Untitled"
            value={page.title}
            onChange={(e) => updatePage(page.id, { title: e.target.value })}
          />
          <button
            className="btn ghost sm"
            title="Delete page"
            onClick={async () => {
              if (confirm(`Delete “${page.title || "Untitled"}” and its subpages?`)) {
                await deletePageTree(page.id);
                onDeleted();
              }
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div className="ai-bar">
          <Sparkles size={14} style={{ color: "var(--accent)", marginLeft: 4 }} />
          {AI_ACTIONS.map((a) => (
            <button key={a.id} className="ai-chip" disabled={aiBusy !== null} onClick={() => runAction(a.id)}>
              {aiBusy === a.id && <Loader2 size={12} className="spin" />}
              {a.label}
            </button>
          ))}
          <span style={{ fontSize: 11.5, color: "var(--text-faint)", marginLeft: "auto", paddingRight: 4 }}>
            works on selection · whole page if nothing selected
          </span>
        </div>
        {aiError && (
          <div style={{ color: "#c0392b", fontSize: 12.5, margin: "0 0 10px" }}>{aiError}</div>
        )}

        <RichEditor
          key={page.id}
          initialDoc={page.doc}
          onChange={saveDoc}
          dark={dark}
          editorRefCb={(ed) => (editorRef.current = ed)}
        />
      </div>

      {iconAnchor && (
        <Menu anchor={iconAnchor} onClose={() => setIconAnchor(null)} width={232}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 2, padding: 4 }}>
            {EMOJIS.map((e) => (
              <button
                key={e}
                className="btn ghost"
                style={{ fontSize: 18, padding: 4 }}
                onClick={() => {
                  updatePage(page.id, { icon: e });
                  setIconAnchor(null);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </Menu>
      )}

      {aiResult && (
        <Modal title="AI result" onClose={() => setAiResult(null)} wide>
          <div
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-serif)",
              fontSize: 15,
              lineHeight: 1.65,
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px 18px",
              maxHeight: "50vh",
              overflowY: "auto",
              background: "var(--bg-raised)",
            }}
          >
            {aiResult}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn primary" onClick={insertResult}>Insert into page</button>
            <button className="btn" onClick={() => navigator.clipboard.writeText(aiResult)}>Copy</button>
            <button className="btn ghost" onClick={() => setAiResult(null)}>Discard</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
