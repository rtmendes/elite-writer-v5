/**
 * Article Queue — pure helpers
 *
 * Logic-bearing, regression-prone pieces of the queue page kept out of the
 * React component so they can be unit-tested without a DOM: cover-image
 * resolution, CSV / Google-Sheets serialization, and the deterministic
 * fallback visual used when an article has no generated cover yet.
 */

/** A generated-image row as returned by `data.articles.covers`. */
export type CoverRow = { articleId: number | null; imageUrl: string | null };

/** A row shape for CSV / Sheets export. */
export type QueueExportRow = {
  title: string;
  status: string;
  score: number | null;
  publication: string | null;
  words: number;
  createdAt: string;
};

/** Sentinel the backend stores when an image is a (non-retrievable) data URI. */
const BASE64_PLACEHOLDER = '(base64)';

/**
 * Build a `articleId → imageUrl` map, keeping the most recent usable cover.
 * Rows are expected newest-first (the query orders by `createdAt desc`), so the
 * first usable URL seen for an article wins. Null ids, empty URLs, and the
 * "(base64)" placeholder (which isn't a fetchable URL) are skipped.
 */
export function buildCoverMap(rows: CoverRow[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of rows) {
    if (row.articleId == null) continue;
    if (map.has(row.articleId)) continue;
    const url = (row.imageUrl || '').trim();
    if (!url || url === BASE64_PLACEHOLDER) continue;
    map.set(row.articleId, url);
  }
  return map;
}

const EXPORT_HEADER = ['Title', 'Status', 'Score', 'Publication', 'Words', 'Created'] as const;

/** Turn queue rows into a header + data rows grid (shared by CSV and Sheets). */
export function articlesToRows(items: QueueExportRow[]): string[][] {
  const rows: string[][] = [[...EXPORT_HEADER]];
  for (const it of items) {
    rows.push([
      it.title ?? '',
      it.status ?? '',
      it.score == null ? '' : String(it.score),
      it.publication ?? '',
      String(it.words ?? 0),
      it.createdAt ? it.createdAt.slice(0, 10) : '',
    ]);
  }
  return rows;
}

/** RFC 4180 CSV escaping: quote a field iff it contains comma, quote, or newline. */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serialize a rows grid (from {@link articlesToRows}) to a CSV string. */
export function rowsToCsv(rows: string[][]): string {
  return rows.map(row => row.map(csvField).join(',')).join('\n');
}

/** Stable 32-bit string hash (djb2-ish) for deterministic fallback visuals. */
function hashString(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministic placeholder cover: a hue + 1–2 letter initials derived from the
 * article title, so every card stays visually distinguishable even before an AI
 * cover is generated.
 */
export function coverVisual(seed: string): { hue: number; initials: string } {
  const clean = (seed || '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  let initials: string;
  if (words.length === 0) {
    initials = '?';
  } else if (words.length === 1) {
    initials = words[0].slice(0, 2).toUpperCase();
  } else {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  }
  return { hue: hashString(clean) % 360, initials };
}
