import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import React, { useMemo, useRef, useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { deleteRow, setRowValue, updateRow } from "../db";
import { createOffer, matchPublications, researchBrief, scoreIdea, tournamentDraft, verifyFacts } from "../intel";
import type { Database, Row } from "../types";
import { Modal } from "../ui";
import { Cell } from "./cells";
import { rowTitle } from "./query";

const AGENT_ACTIONS = [
  { id: "score", label: "Score idea", run: scoreIdea },
  { id: "brief", label: "Research brief", run: researchBrief },
  { id: "match", label: "Match publications", run: matchPublications },
  { id: "draft", label: "Tournament draft", run: tournamentDraft },
  { id: "facts", label: "Verify facts", run: verifyFacts },
  { id: "offer", label: "Create offer", run: createOffer },
] as const;

function AgentBar({ database, row, onDone }: { database: Database; row: Row; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <div className="ai-bar" style={{ margin: "0 0 6px" }}>
        <Sparkles size={14} style={{ color: "var(--accent)", marginLeft: 4 }} />
        {AGENT_ACTIONS.map((a) => (
          <button
            key={a.id}
            className="ai-chip"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(a.id);
              setError(null);
              try {
                await a.run(database, row);
                onDone();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(null);
              }
            }}
          >
            {busy === a.id && <Loader2 size={12} className="spin" />}
            {a.label}
          </button>
        ))}
        <button
          className="ai-chip"
          disabled={busy !== null}
          title="Send the latest Pitch offer from your connected Gmail and log it for the learning loop"
          onClick={async () => {
            setBusy("email");
            setError(null);
            try {
              await emailPitch(database, row);
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === "email" && <Loader2 size={12} className="spin" />}
          Email pitch…
        </button>
        <span style={{ fontSize: 11.5, color: "var(--text-faint)", marginLeft: "auto", paddingRight: 4 }}>
          results land in fields + notes · cost tracked in AI Ledger
        </span>
      </div>
      {error && <div style={{ color: "#c0392b", fontSize: 12.5, marginBottom: 8 }}>{error}</div>}
    </div>
  );
}

/** Lightweight notes editor for a row (default schema, persists into row.doc). */
function RowNotes({ row, dark }: { row: Row; dark: boolean }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editor = useCreateBlockNote({
    initialContent:
      Array.isArray(row.doc) && row.doc.length > 0 ? (row.doc as never) : undefined,
  });
  return (
    <BlockNoteView
      editor={editor}
      theme={dark ? "dark" : "light"}
      onChange={() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => updateRow(row.id, { doc: editor.document as unknown[] }), 400);
      }}
    />
  );
}

export function RowModal({
  database,
  row,
  dark,
  onClose,
}: {
  database: Database;
  row: Row;
  dark: boolean;
  onClose: () => void;
}) {
  // Keep a stable initial doc so the editor doesn't remount on live updates;
  // notesVersion remounts it deliberately after an agent action appends content.
  const initialRow = useMemo(() => row, [row.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [notesVersion, setNotesVersion] = useState(0);

  const remove = async () => {
    if (!confirm("Delete this row?")) return;
    await deleteRow(row.id);
    onClose();
  };

  return (
    <Modal wide onClose={onClose} title={<span style={{ fontFamily: "var(--font-serif)", fontSize: 20 }}>{database.icon} {rowTitle(database, row)}</span>}>
      <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 24, alignItems: "start" }}>
        <AgentBar database={database} row={row} onDone={() => setNotesVersion((v) => v + 1)} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {database.fields.map((f) => (
            <div key={f.id}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-faint)", padding: "8px 0 2px" }}>
                {f.name}
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-raised)" }}>
                <Cell field={f} value={row.values[f.id]} onChange={(v) => setRowValue(row.id, f.id, v)} />
              </div>
            </div>
          ))}
          <button className="btn ghost sm" style={{ marginTop: 14, color: "#c0392b", alignSelf: "flex-start" }} onClick={remove}>
            <Trash2 size={13} /> Delete row
          </button>
        </div>
        <div style={{ minHeight: 320, borderLeft: "1px solid var(--border)", paddingLeft: 8 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-faint)", padding: "8px 0 6px" }}>
            NOTES & DRAFT
          </div>
          <RowNotes key={`${initialRow.id}:${notesVersion}`} row={notesVersion === 0 ? initialRow : row} dark={dark} />
        </div>
      </div>
    </Modal>
  );
}

/** Pull the latest "Pitch offer" section from the row notes, send via the
 *  connected Gmail account, and log it into the pitches table (the outcome
 *  data that feeds back into idea scoring and publication matching). */
async function emailPitch(database: Database, row: Row) {
  const { db } = await import("../db");
  const fresh = (await db.rows.get(row.id))!;
  const title = String(fresh.values[database.fields[0].id] ?? "article");
  const blocks = Array.isArray(fresh.doc) ? (fresh.doc as Array<{ type?: string; content?: Array<{ text?: string }> }>) : [];
  const text = (b: { content?: Array<{ text?: string }> }) => (Array.isArray(b.content) ? b.content.map((c) => c.text ?? "").join("") : "");

  // Find the last "Pitch offer" heading and take everything after it
  let start = -1;
  blocks.forEach((b, i) => {
    if (b.type === "heading" && /pitch offer/i.test(text(b))) start = i;
  });
  if (start === -1) throw new Error("No pitch offer found in notes — run “Create offer” first.");
  let body = "";
  for (let i = start + 1; i < blocks.length; i++) {
    if (blocks[i].type === "heading" && /^(Idea score|Research brief|Publication matches|Claim verification|Tournament draft)/i.test(text(blocks[i]))) break;
    body += text(blocks[i]) + "\n";
  }
  const subjectMatch = body.match(/Subject line.*?\n(.+)/i);
  const subject = (subjectMatch?.[1] ?? `Pitch: ${title}`).trim().slice(0, 200);

  const pubField = database.fields.find((f) => f.name.toLowerCase().includes("publication") && f.type === "text");
  const publicationName = String((pubField && fresh.values[pubField.id]) || prompt("Publication name?") || "").trim();
  if (!publicationName) throw new Error("Publication name required.");
  const editorEmail = (prompt(`Editor email at ${publicationName}?`) || "").trim();
  if (!/.+@.+\..+/.test(editorEmail)) throw new Error("A valid editor email is required.");
  if (!confirm(`Send this pitch to ${editorEmail} (${publicationName}) from your connected Gmail?\n\nSubject: ${subject}`)) return;

  const { wsTrpc } = await import("../trpcClient");
  await wsTrpc.google.sendEmail.mutate({ to: editorEmail, subject, body: body.trim() });
  await wsTrpc.workspace.recordPitch.mutate({
    publicationName,
    editorEmail,
    subject,
    body: body.trim(),
    articleTitle: title,
    sent: true,
  });
  const { updateRow } = await import("../db");
  const doc = [...blocks, { type: "paragraph", content: [{ type: "text", text: `✉️ Pitch sent to ${editorEmail} (${publicationName}) on ${new Date().toLocaleDateString("en-US")} — logged for the learning loop.`, styles: {} }] }];
  await updateRow(row.id, { doc });
}
