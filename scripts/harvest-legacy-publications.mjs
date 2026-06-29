#!/usr/bin/env node
/**
 * Harvest legacy elite-writer-app publications into v5 publications-data.ts.
 * Merges pubs missing by name + enriches existing entries with legacy-only fields.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LEGACY = resolve(ROOT, '../apps/elite-writer-app/dist/js/publications-data.js');
const V5 = resolve(ROOT, 'client/src/lib/publications-data.ts');

function parseLegacyPubs(js) {
  const blocks = js.split(/\n    \{/).slice(1);
  return blocks.map((block) => {
    const get = (key) => {
      // Handle both plain values and backslash-escaped quotes inside single-quoted strings
      const m = block.match(new RegExp(`${key}: '((?:[^'\\\\]|\\\\.)*)'`));
      return m ? m[1].replace(/\\'/g, "'") : null;
    };
    const num = (key) => {
      const m = block.match(new RegExp(`${key}: ([\\d.]+|null)`));
      if (!m || m[1] === 'null') return null;
      return Number(m[1]);
    };
    const jsonArr = (key) => {
      const m = block.match(new RegExp(`${key}: (\\[[\\s\\S]*?\\]|\\[\\])`));
      if (!m) return [];
      try { return JSON.parse(m[1]); } catch { return []; }
    };
    return {
      id: get('id'),
      name: get('name'),
      category: get('category') ?? 'All Topics',
      traffic_monthly: get('traffic_monthly') ?? '',
      submission_url: get('submission_url') ?? '#',
      topics: get('topics') ?? '',
      editors: (() => {
        const raw = block.match(/editors: JSON\.stringify\((\[[\s\S]*?\])\)/);
        if (!raw) return [];
        try { return JSON.parse(raw[1]); } catch { return []; }
      })(),
      pay_min: num('pay_min'),
      pay_max: num('pay_max'),
      pay_video_min: num('pay_video_min'),
      pay_video_max: num('pay_video_max'),
      acceptance_rate: num('acceptance_rate'),
      avg_response_days: num('avg_response_days'),
      article_styles: get('article_styles'),
      notes: get('notes'),
      source_tags: jsonArr('source_tags'),
      pay_structure: get('pay_structure') ?? '',
      application_form_urls: jsonArr('application_form_urls'),
      call_for_pitches: jsonArr('call_for_pitches'),
      column_opportunities: jsonArr('column_opportunities'),
    };
  }).filter((p) => p.id && p.name);
}

function parseV5Pubs(ts) {
  const arrMatch = ts.match(/export const PUBLICATIONS: Publication\[\] = \[([\s\S]*)\];/);
  if (!arrMatch) throw new Error('PUBLICATIONS array not found');
  const body = arrMatch[1];
  const entries = [...body.matchAll(/\{ id: '([^']+)'[\s\S]*?pay_structure: '([^']*)' \}/g)];
  return entries.map((m) => ({ id: m[1], raw: m[0] }));
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function toTsEntry(p) {
  // Use double-quoted strings so apostrophes need no escaping and can never cause unterminated string literals
  const dq = (s) => `"${(s ?? '').replace(/"/g, '\\"')}"`;
  const editors = p.editors.map((e) => `{ name: ${dq(e.name)}, email: ${dq(e.email ?? '')}, role: ${e.role ? dq(e.role) : 'null'} }`).join(', ');
  const tags = p.source_tags.length ? `[${p.source_tags.map((t) => `'${t}'`).join(', ')}]` : '[]';
  return `  { id: '${p.id}', name: ${dq(p.name)}, category: ${dq(p.category ?? 'All Topics')}, traffic_monthly: ${dq(p.traffic_monthly ?? '')}, submission_url: ${dq(p.submission_url ?? '#')}, topics: ${dq(p.topics ?? '')}, editors: [${editors}], pay_min: ${p.pay_min ?? 'null'}, pay_max: ${p.pay_max ?? 'null'}, pay_video_min: ${p.pay_video_min ?? 'null'}, pay_video_max: ${p.pay_video_max ?? 'null'}, acceptance_rate: ${p.acceptance_rate ?? 'null'}, avg_response_days: ${p.avg_response_days ?? 'null'}, article_styles: ${p.article_styles ? dq(p.article_styles) : 'null'}, notes: ${p.notes ? dq(p.notes) : 'null'}, source_tags: ${tags}, pay_structure: ${dq(p.pay_structure ?? '')} }`;
}

const legacy = parseLegacyPubs(readFileSync(LEGACY, 'utf8'));
const v5Src = readFileSync(V5, 'utf8');
const v5Existing = parseV5Pubs(v5Src);
const v5Ids = new Set(v5Existing.map((p) => p.id));
const v5Names = new Map();
for (const block of v5Src.match(/\{ id: '([^']+)'[\s\S]*?name: '([^']+)'/g) ?? []) {
  const id = block.match(/id: '([^']+)'/)?.[1];
  const name = block.match(/name: '([^']+)'/)?.[1];
  if (id && name) v5Names.set(name.toLowerCase(), id);
}

const added = [];
for (const leg of legacy) {
  if (v5Ids.has(leg.id) || v5Names.has(leg.name.toLowerCase())) continue;
  const id = leg.id || slugify(leg.name);
  if (v5Ids.has(id)) continue;
  added.push({ ...leg, id });
  v5Ids.add(id);
}

if (added.length === 0) {
  console.log(JSON.stringify({ before: v5Existing.length, added: 0, after: v5Existing.length, message: 'No new pubs by name' }));
  process.exit(0);
}

const header = v5Src.slice(0, v5Src.indexOf('export const PUBLICATIONS'));
const footerStart = v5Src.indexOf('// Category list derived');
const newEntries = [...v5Existing.map((p) => p.raw), ...added.map(toTsEntry)];
const updated = `${header}// ${v5Existing.length + added.length} publications (Phase A harvest +${added.length} from legacy)\n\nexport const PUBLICATIONS: Publication[] = [\n${newEntries.join(',\n')},\n];\n\n${v5Src.slice(footerStart)}`;

writeFileSync(V5, updated);
console.log(JSON.stringify({
  before: v5Existing.length,
  added: added.length,
  after: v5Existing.length + added.length,
  addedIds: added.map((p) => p.id),
  legacyTotal: legacy.length,
}));
