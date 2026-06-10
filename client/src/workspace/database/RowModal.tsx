import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import React, { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { deleteRow, setRowValue, updateRow } from "../db";
import {
  buildOutline, createOffer, getOutlineSuggestions, matchPublications, researchBrief,
  scoreIdea, tournamentDraft, verifyFacts, writeFullArticle,
} from "../intel";
import type { Database, Row } from "../types";
import { Modal } from "../ui";
import { Cell } from "./cells";
import { rowTitle } from "./query";

const STAGES = ["Idea", "Research", "Outline", "Draft", "Edit", "Submit"] as const;

function currentStage(database: Database, row: Row): string {
  const sf = database.fields.find((f) => f.name.toLowerCase() === "status" && f.type === "select");
  const name = sf ? sf.options?.find((o) => o.id === row.values[sf.id])?.name ?? "" : "";
  const hit = STAGES.find((s) => name.toLowerCase().includes(s.toLowerCase()));
  return hit ?? "Idea";
}

// ── The article assembly line: drives Status stage-by-stage ─────────────────
function WorkflowBar({ database, row, onDone }: { database: Database; row: Row; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ area: string; suggestion: string }> | null>(null);
  const [accepted, setAccepted] = useState<Record<number, boolean>>({});
  const stage = currentStage(database, row);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const step = async (st: string) => {
    if (st === "Idea") await scoreIdea(database, row);
    else if (st === "Research") await researchBrief(database, row);
    else if (st === "Outline") await buildOutline(database, row);
  };

  // Single step (stops at Outline for approval) or auto-chain Idea→Research→Outline.
  const runStage = (auto = false) =>
    run(auto ? "auto" : "stage", async () => {
      if (!auto) {
        await step(stage);
        if (stage === "Outline") setSuggestions(await getOutlineSuggestions(database, row));
        return;
      }
      const startIdx = STAGES.indexOf(stage as never);
      for (const target of ["Idea", "Research", "Outline"]) {
        if (startIdx <= STAGES.indexOf(target as never)) await step(target);
      }
      setSuggestions(await getOutlineSuggestions(database, row));
    });

  const writeDraft = (withSuggestions: boolean) =>
    run("draft", async () => {
      const picks = withSuggestions && suggestions ? suggestions.filter((_, i) => accepted[i]).map((x) => x.suggestion) : [];
      await writeFullArticle(database, row, picks);
      setSuggestions(null);
    });

  return (
    <div style={{ gridColumn: "1 / -1", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-raised)", padding: "10px 12px", marginBottom: 8 }}>
      {/* stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {STAGES.map((s, i) => {
          const active = s === stage;
          const done = STAGES.indexOf(stage as never) > i;
          return (
            <React.Fragment key={s}>
              <span style={{
                fontSize: 11.5, fontWeight: active ? 700 : 500, padding: "2px 8px", borderRadius: 99,
                background: active ? "var(--accent-soft)" : done ? "var(--bg-active)" : "transparent",
                color: active ? "var(--accent)" : done ? "var(--text)" : "var(--text-faint)",
              }}>{done && <Check size={10} style={{ verticalAlign: -1, marginRight: 2 }} />}{s}</span>
              {i < STAGES.length - 1 && <ArrowRight size={11} style={{ color: "var(--text-faint)" }} />}
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn primary sm" disabled={busy !== null} onClick={() => runStage(false)}>
          {busy === "stage" ? <Loader2 size={13} className="spin" /> : <ArrowRight size={13} />}
          Run {stage} stage
        </button>
        <button className="btn sm" disabled={busy !== null} onClick={() => runStage(true)} title="Score → Research → Outline, then pause for your approval">
          {busy === "auto" ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} />}
          Auto-run to outline
        </button>
        {stage === "Draft" && (
          <button className="btn sm" disabled={busy !== null} onClick={() => writeDraft(false)}>
            {busy === "draft" ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} />}
            Write full draft
          </button>
        )}
        <span style={{ fontSize: 11.5, color: "var(--text-faint)", marginLeft: "auto" }}>
          agent does the heavy lifting · you edit the draft
        </span>
      </div>
      {error && <div style={{ color: "#c0392b", fontSize: 12.5, marginTop: 8 }}>{error}</div>}

      {/* interactive outline approval */}
      {suggestions && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>Outline ready — sharpen it before drafting?</div>
          <div style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 8 }}>Check the upgrades to fold in, then write the full draft — or proceed as-is.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
            {suggestions.map((s, i) => (
              <label key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, cursor: "pointer" }}>
                <input type="checkbox" className="checkbox-dot" checked={!!accepted[i]} onChange={(e) => setAccepted({ ...accepted, [i]: e.target.checked })} style={{ marginTop: 2 }} />
                <span><b style={{ textTransform: "uppercase", fontSize: 10.5, color: "var(--accent)", marginRight: 6 }}>{s.area}</b>{s.suggestion}</span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn primary sm" disabled={busy !== null} onClick={() => writeDraft(true)}>
              {busy === "draft" ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} />}
              Write full draft with picks
            </button>
            <button className="btn sm" disabled={busy !== null} onClick={() => writeDraft(false)}>Proceed as-is</button>
            <button className="btn ghost sm" onClick={() => setSuggestions(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

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
        <WorkflowBar database={database} row={row} onDone={() => setNotesVersion((v) => v + 1)} />
        <AgentBar database={database} row={row} onDone={() => setNotesVersion((v) => v + 1)} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {database.fields.map((f) => (
            <div key={f.id}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-faint)", padding: "8px 0 2px" }}>
                {f.name}
              </div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-raised)" }}>
                <Cell field={f} value={row.values[f.id]} onChange={(v) => setRowValue(row.id, f.id, v)} row={row} database={database} />
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
