import { db, uid, makeView } from "./db";
import type { Database, Field, Page, Row, SelectOption } from "./types";

const opt = (name: string, color: string): SelectOption => ({ id: uid(), name, color });

let seedPromise: Promise<void> | null = null;

/** Seeds the workspace with the Article Pipeline template on first run. */
export function seedIfEmpty(): Promise<void> {
  // Single-flight guard: StrictMode double-mount must not seed twice
  if (!seedPromise) seedPromise = doSeed();
  return seedPromise;
}

async function doSeed() {
  const seeded = await db.kv.get("seeded");
  if (seeded) return;
  // If cloud sync already pulled content from another device, never re-seed
  if ((await db.pages.count()) > 0 || (await db.databases.count()) > 0) {
    await db.kv.put({ key: "seeded", value: true });
    return;
  }

  const now = Date.now();

  // ── Article Pipeline database ────────────────────────────────────────────
  const fTitle: Field = { id: uid(), name: "Headline", type: "text", width: 320 };
  const statusOptions = [
    opt("💡 Idea", "gray"),
    opt("🔎 Research", "purple"),
    opt("🧱 Outline", "teal"),
    opt("✍️ Draft", "blue"),
    opt("✂️ Edit", "yellow"),
    opt("📨 Submitted", "orange"),
    opt("✅ Published", "green"),
  ];
  const fStatus: Field = { id: uid(), name: "Status", type: "select", options: statusOptions, width: 150 };
  const fPublication: Field = { id: uid(), name: "Publication", type: "text", width: 170 };
  const fFee: Field = { id: uid(), name: "Fee", type: "currency", width: 110 };
  const fDeadline: Field = { id: uid(), name: "Deadline", type: "date", width: 130 };
  const nicheOptions = [
    opt("Finance", "green"),
    opt("Tech", "blue"),
    opt("Health", "red"),
    opt("Climate", "teal"),
    opt("Business", "orange"),
    opt("Culture", "purple"),
  ];
  const fNiche: Field = { id: uid(), name: "Niche", type: "multiselect", options: nicheOptions, width: 180 };
  const fPriority: Field = { id: uid(), name: "Priority", type: "rating", width: 120 };
  const fThumb: Field = { id: uid(), name: "Thumbnail", type: "image", width: 130 };
  const fPegged: Field = { id: uid(), name: "News Peg", type: "text", width: 220 };
  const fHumanized: Field = { id: uid(), name: "Humanized", type: "checkbox", width: 110 };

  const pipeline: Database = {
    id: uid(),
    name: "Article Pipeline",
    icon: "📰",
    description: "Every article from idea to paycheck. Group the board by Status, sort by Deadline.",
    fields: [fTitle, fStatus, fPublication, fFee, fDeadline, fNiche, fPriority, fThumb, fPegged, fHumanized],
    views: [
      { ...makeView("table", "All Articles"), sorts: [{ fieldId: fDeadline.id, dir: "asc" }] },
      { ...makeView("kanban", "Pipeline Board"), groupBy: fStatus.id },
      { ...makeView("gallery", "Gallery"), thumbnailField: fThumb.id },
      { ...makeView("list", "List") },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const sampleRows: Array<Record<string, unknown>> = [
    {
      [fTitle.id]: "Why the Fed's quiet pivot is reshaping regional banks",
      [fStatus.id]: statusOptions[3].id,
      [fPublication.id]: "Bloomberg Opinion",
      [fFee.id]: 10000,
      [fDeadline.id]: new Date(now + 5 * 864e5).toISOString().slice(0, 10),
      [fNiche.id]: [nicheOptions[0].id, nicheOptions[4].id],
      [fPriority.id]: 5,
      [fPegged.id]: "FOMC minutes released Tuesday",
      [fHumanized.id]: false,
    },
    {
      [fTitle.id]: "The data center water wars nobody is covering",
      [fStatus.id]: statusOptions[1].id,
      [fPublication.id]: "The Atlantic",
      [fFee.id]: 8500,
      [fDeadline.id]: new Date(now + 12 * 864e5).toISOString().slice(0, 10),
      [fNiche.id]: [nicheOptions[1].id, nicheOptions[3].id],
      [fPriority.id]: 4,
      [fPegged.id]: "Q2 hyperscaler capex reports",
      [fHumanized.id]: false,
    },
    {
      [fTitle.id]: "GLP-1s and the quiet collapse of snack-food forecasting",
      [fStatus.id]: statusOptions[6].id,
      [fPublication.id]: "WSJ",
      [fFee.id]: 12000,
      [fDeadline.id]: new Date(now - 9 * 864e5).toISOString().slice(0, 10),
      [fNiche.id]: [nicheOptions[2].id, nicheOptions[4].id],
      [fPriority.id]: 5,
      [fPegged.id]: "Earnings season",
      [fHumanized.id]: true,
    },
  ];

  // ── Research Vault database ──────────────────────────────────────────────
  const rTitle: Field = { id: uid(), name: "Source", type: "text", width: 300 };
  const rType: Field = {
    id: uid(),
    name: "Type",
    type: "select",
    width: 140,
    options: [opt("Report", "blue"), opt("Dataset", "green"), opt("Interview", "purple"), opt("Article", "gray"), opt("Expert", "orange")],
  };
  const rUrl: Field = { id: uid(), name: "Link", type: "url", width: 220 };
  const rKey: Field = { id: uid(), name: "Key Stat / Quote", type: "longtext", width: 320 };
  const rCred: Field = { id: uid(), name: "Credibility", type: "rating", width: 120 };

  const research: Database = {
    id: uid(),
    name: "Research Vault",
    icon: "🔬",
    description: "Sources, datasets, quotes and experts — filterable by article niche.",
    fields: [rTitle, rType, rUrl, rKey, rCred],
    views: [makeView("table", "All Sources"), makeView("list", "Reading List")],
    createdAt: now,
    updatedAt: now,
  };

  // ── Welcome page ─────────────────────────────────────────────────────────
  const welcome: Page = {
    id: uid(),
    parentId: null,
    title: "Start Here — Your Media Engine",
    icon: "🏛️",
    sortOrder: now,
    createdAt: now,
    updatedAt: now,
    doc: [
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Welcome to Elite Writer Workspace", styles: {} }] },
      { type: "paragraph", content: [{ type: "text", text: "This is your Notion-style workspace fused with Airtable-style databases — no logins, no row limits, everything stored on this machine.", styles: {} }] },
      { type: "heading", props: { level: 3 }, content: [{ type: "text", text: "How to work", styles: {} }] },
      { type: "bulletListItem", content: [{ type: "text", text: "Type / anywhere on a page for blocks: headings, tables, images, charts, embedded databases.", styles: {} }] },
      { type: "bulletListItem", content: [{ type: "text", text: "Open Article Pipeline in the sidebar — switch between Table, Board, Gallery and List views. Click any row to open it as a full page with notes.", styles: {} }] },
      { type: "bulletListItem", content: [{ type: "text", text: "Select text and use the AI bar to humanize, tighten, or expand a passage (add your Anthropic key in Settings).", styles: {} }] },
      { type: "bulletListItem", content: [{ type: "text", text: "Use /chart to drop a live infographic powered by any database.", styles: {} }] },
      { type: "paragraph", content: [] },
      { type: "chart", props: { dbId: pipeline.id, chartType: "bar", labelFieldId: fStatus.id, valueFieldId: fFee.id, title: "Pipeline value by stage ($)" } },
      { type: "paragraph", content: [] },
      { type: "dbview", props: { dbId: pipeline.id } },
    ],
  };

  await db.transaction("rw", db.pages, db.databases, db.rows, db.kv, async () => {
    // Re-check inside the transaction so concurrent callers can't double-seed
    if (await db.kv.get("seeded")) return;
    await db.databases.bulkAdd([pipeline, research]);
    let order = now;
    const rows: Row[] = sampleRows.map((values) => ({
      id: uid(),
      dbId: pipeline.id,
      values,
      sortOrder: order++,
      createdAt: now,
      updatedAt: now,
    }));
    await db.rows.bulkAdd(rows);
    await db.pages.add(welcome);
    await db.kv.put({ key: "seeded", value: true });
  });
  const { enqueueEverything } = await import("./sync");
  await enqueueEverything();
}
