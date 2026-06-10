import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  filterSuggestionItems,
  insertOrUpdateBlock,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
  SuggestionMenuController,
  createReactBlockSpec,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart3, Lightbulb, Table2 } from "lucide-react";
import { useMemo } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { db } from "../db";
import type { Database } from "../types";
import { DatabaseScreen } from "../database/DatabaseScreen";

const CHART_COLORS = ["#9a7b4f", "#3a6ea5", "#2e8b6f", "#8a5a9c", "#b06a8f", "#5a7d3a", "#a35a4a", "#4a6b8a", "#8a7d4a"];

// ── Chart block (live infographic bound to a database) ─────────────────────
function ChartRenderer({
  dbId, chartType, labelFieldId, valueFieldId, title, editable,
  onChange,
}: {
  dbId: string; chartType: string; labelFieldId: string; valueFieldId: string; title: string;
  editable: boolean;
  onChange: (patch: Record<string, string>) => void;
}) {
  const databases = useLiveQuery(() => db.databases.toArray(), []) ?? [];
  const database = databases.find((d) => d.id === dbId);
  const rows = useLiveQuery(
    async () => (dbId ? await db.rows.where("dbId").equals(dbId).toArray() : []),
    [dbId],
  ) ?? [];

  const data = useMemo(() => {
    if (!database) return [];
    const labelField = database.fields.find((f) => f.id === labelFieldId);
    const valueField = database.fields.find((f) => f.id === valueFieldId);
    if (!labelField) return [];
    const groups = new Map<string, number>();
    for (const row of rows) {
      const raw = row.values[labelField.id];
      let label = "—";
      if (labelField.type === "select") {
        label = labelField.options?.find((o) => o.id === raw)?.name ?? "—";
      } else if (raw !== undefined && raw !== null && raw !== "") {
        label = String(raw);
      }
      const inc = valueField ? Number(row.values[valueField.id]) || 0 : 1;
      groups.set(label, (groups.get(label) ?? 0) + inc);
    }
    const out: Array<{ name: string; value: number }> = [];
    groups.forEach((value, name) => out.push({ name, value }));
    return out;
  }, [database, rows, labelFieldId, valueFieldId]);

  const numericFields = database?.fields.filter((f) => f.type === "number" || f.type === "currency" || f.type === "rating") ?? [];

  return (
    <div className="chart-block" contentEditable={false}>
      {editable && (
        <div className="chart-config">
          <select className="input" value={dbId} onChange={(e) => onChange({ dbId: e.target.value, labelFieldId: "", valueFieldId: "" })}>
            <option value="">Pick a database…</option>
            {databases.map((d) => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
          </select>
          {database && (
            <>
              <select className="input" value={chartType} onChange={(e) => onChange({ chartType: e.target.value })}>
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="area">Area</option>
                <option value="pie">Pie</option>
                <option value="scatter">Scatter</option>
                <option value="radar">Radar</option>
              </select>
              <select className="input" value={labelFieldId} onChange={(e) => onChange({ labelFieldId: e.target.value })}>
                <option value="">Group by…</option>
                {database.fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <select className="input" value={valueFieldId} onChange={(e) => onChange({ valueFieldId: e.target.value })}>
                <option value="">Count rows</option>
                {numericFields.map((f) => <option key={f.id} value={f.id}>Sum of {f.name}</option>)}
              </select>
              <input className="input" placeholder="Chart title" value={title} onChange={(e) => onChange({ title: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
            </>
          )}
        </div>
      )}
      {title && !editable && <div className="chart-block-title">{title}</div>}
      {editable && title && <div className="chart-block-title">{title}</div>}
      {!database ? (
        <div className="empty" style={{ padding: 24 }}>Select a database to visualize</div>
      ) : data.length === 0 ? (
        <div className="empty" style={{ padding: 24 }}>No data yet — pick a “Group by” field</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          {chartType === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip /> <Legend />
            </PieChart>
          ) : chartType === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.35} />
              <XAxis dataKey="name" fontSize={11} /> <YAxis fontSize={11} /> <Tooltip />
              <Line dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.35} />
              <XAxis dataKey="name" fontSize={11} /> <YAxis fontSize={11} /> <Tooltip />
              <Area dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.18} strokeWidth={2.5} />
            </AreaChart>
          ) : chartType === "scatter" ? (
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.35} />
              <XAxis dataKey="name" fontSize={11} /> <YAxis dataKey="value" fontSize={11} /> <ZAxis range={[80, 80]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={data} fill={CHART_COLORS[0]}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Scatter>
            </ScatterChart>
          ) : chartType === "radar" ? (
            <RadarChart data={data} outerRadius={95}>
              <PolarGrid strokeOpacity={0.4} />
              <PolarAngleAxis dataKey="name" fontSize={11} />
              <PolarRadiusAxis fontSize={10} />
              <Radar dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.35} />
              <Tooltip />
            </RadarChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.35} vertical={false} />
              <XAxis dataKey="name" fontSize={11} /> <YAxis fontSize={11} /> <Tooltip />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}

const ChartBlock = createReactBlockSpec(
  {
    type: "chart",
    propSchema: {
      dbId: { default: "" },
      chartType: { default: "bar" },
      labelFieldId: { default: "" },
      valueFieldId: { default: "" },
      title: { default: "" },
    },
    content: "none",
  },
  {
    render: ({ block, editor }) => (
      <ChartRenderer
        dbId={block.props.dbId}
        chartType={block.props.chartType}
        labelFieldId={block.props.labelFieldId}
        valueFieldId={block.props.valueFieldId}
        title={block.props.title}
        editable={editor.isEditable}
        onChange={(patch) =>
          editor.updateBlock(block, { props: { ...block.props, ...patch } })
        }
      />
    ),
  },
);

// ── Embedded database view block ───────────────────────────────────────────
function DbEmbed({ dbId, editable, onPick }: { dbId: string; editable: boolean; onPick: (id: string) => void }) {
  const databases = useLiveQuery(() => db.databases.toArray(), []) ?? [];
  const database = databases.find((d: Database) => d.id === dbId);

  if (!database) {
    return (
      <div className="dbembed-block" contentEditable={false}>
        <div className="dbembed-head"><Table2 size={15} /> Embed a database</div>
        <div style={{ padding: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {databases.map((d) => (
            <button key={d.id} className="btn sm" onClick={() => onPick(d.id)} disabled={!editable}>
              {d.icon} {d.name}
            </button>
          ))}
          {databases.length === 0 && <span className="empty" style={{ padding: 8 }}>No databases yet — create one in the sidebar.</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="dbembed-block" contentEditable={false}>
      <div className="dbembed-body">
        <DatabaseScreen dbId={dbId} compact />
      </div>
    </div>
  );
}

const DbViewBlock = createReactBlockSpec(
  { type: "dbview", propSchema: { dbId: { default: "" } }, content: "none" },
  {
    render: ({ block, editor }) => (
      <DbEmbed
        dbId={block.props.dbId}
        editable={editor.isEditable}
        onPick={(id) => editor.updateBlock(block, { props: { dbId: id } })}
      />
    ),
  },
);

// ── Callout block (editable inline text + emoji + color) ───────────────────
const CALLOUT_COLORS: Record<string, { bg: string; border: string }> = {
  gray: { bg: "var(--bg-active)", border: "var(--border-strong)" },
  blue: { bg: "var(--tag-blue-bg)", border: "var(--tag-blue-fg)" },
  green: { bg: "var(--tag-green-bg)", border: "var(--tag-green-fg)" },
  yellow: { bg: "var(--tag-yellow-bg)", border: "var(--tag-yellow-fg)" },
  red: { bg: "var(--tag-red-bg)", border: "var(--tag-red-fg)" },
  purple: { bg: "var(--tag-purple-bg)", border: "var(--tag-purple-fg)" },
};

const CalloutBlock = createReactBlockSpec(
  { type: "callout", propSchema: { emoji: { default: "💡" }, color: { default: "yellow" } }, content: "inline" },
  {
    render: ({ block, editor, contentRef }) => {
      const c = CALLOUT_COLORS[block.props.color] ?? CALLOUT_COLORS.yellow;
      const EMOJIS = ["💡", "⚠️", "✅", "🔥", "📌", "❗", "💰", "🎯"];
      return (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: c.bg, borderLeft: `3px solid ${c.border}`, borderRadius: 6, padding: "10px 12px", margin: "4px 0", width: "100%" }}>
          <button
            contentEditable={false}
            onClick={() => {
              if (!editor.isEditable) return;
              const i = EMOJIS.indexOf(block.props.emoji);
              editor.updateBlock(block, { props: { ...block.props, emoji: EMOJIS[(i + 1) % EMOJIS.length] } });
            }}
            style={{ border: "none", background: "none", cursor: editor.isEditable ? "pointer" : "default", fontSize: 18, lineHeight: 1.4, padding: 0 }}
            title="Click to change icon"
          >
            {block.props.emoji}
          </button>
          <div ref={contentRef} style={{ flex: 1 }} />
        </div>
      );
    },
  },
);

export const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, chart: ChartBlock, dbview: DbViewBlock, callout: CalloutBlock },
});

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Editor component ───────────────────────────────────────────────────────
export function RichEditor({
  initialDoc,
  onChange,
  dark,
  editorRefCb,
}: {
  initialDoc?: unknown[];
  onChange: (doc: unknown[]) => void;
  dark: boolean;
  // BlockNote editor instance — typed loosely to keep the custom schema simple
  editorRefCb?: (editor: any) => void;
}) {
  const editor = useCreateBlockNote({
    schema,
    initialContent:
      Array.isArray(initialDoc) && initialDoc.length > 0 ? (initialDoc as never) : undefined,
    uploadFile: fileToDataUrl,
  });

  editorRefCb?.(editor);

  return (
    <BlockNoteView
      editor={editor}
      theme={dark ? "dark" : "light"}
      onChange={() => onChange(editor.document as unknown[])}
      slashMenu={false}
    >
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems(
            [
              ...getDefaultReactSlashMenuItems(editor),
              {
                title: "Chart / Infographic",
                subtext: "Live chart from any database",
                aliases: ["chart", "graph", "infographic", "viz", "data"],
                group: "Data",
                icon: <BarChart3 size={18} />,
                onItemClick: () => insertOrUpdateBlock(editor, { type: "chart" }),
              },
              {
                title: "Database view",
                subtext: "Embed a live table/board",
                aliases: ["database", "table view", "embed", "airtable"],
                group: "Data",
                icon: <Table2 size={18} />,
                onItemClick: () => insertOrUpdateBlock(editor, { type: "dbview" }),
              },
              {
                title: "Callout",
                subtext: "Highlighted note with an icon",
                aliases: ["callout", "note", "tip", "warning", "highlight"],
                group: "Basic blocks",
                icon: <Lightbulb size={18} />,
                onItemClick: () => insertOrUpdateBlock(editor, { type: "callout" }),
              },
            ],
            query,
          )
        }
      />
    </BlockNoteView>
  );
}
