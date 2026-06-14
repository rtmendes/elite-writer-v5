// @vitest-environment node
//
// Pure-logic tests for the Article Queue rebuild. No React, no DB — these
// exercise the regression-prone serialization/derivation helpers the queue
// page leans on: building the per-article cover map, turning queue rows into
// CSV / Google-Sheets rows, and the deterministic fallback visual used when an
// article has no generated cover image yet.

import { describe, it, expect } from 'vitest';
import {
  buildCoverMap,
  articlesToRows,
  rowsToCsv,
  coverVisual,
  type QueueExportRow,
} from './queue-tools';

describe('buildCoverMap', () => {
  it('keeps the most recent image per article (rows arrive newest-first)', () => {
    const map = buildCoverMap([
      { articleId: 1, imageUrl: 'https://cdn/new-1.png' },
      { articleId: 2, imageUrl: 'https://cdn/two.png' },
      { articleId: 1, imageUrl: 'https://cdn/old-1.png' },
    ]);
    expect(map.get(1)).toBe('https://cdn/new-1.png');
    expect(map.get(2)).toBe('https://cdn/two.png');
    expect(map.size).toBe(2);
  });

  it('skips null articleIds and non-retrievable base64 placeholders', () => {
    const map = buildCoverMap([
      { articleId: null, imageUrl: 'https://cdn/orphan.png' },
      { articleId: 3, imageUrl: '(base64)' },
      { articleId: 3, imageUrl: '' },
      { articleId: 3, imageUrl: 'https://cdn/real-3.png' },
    ]);
    expect(map.has(3)).toBe(true);
    expect(map.get(3)).toBe('https://cdn/real-3.png');
    expect(map.size).toBe(1);
  });
});

describe('articlesToRows / rowsToCsv', () => {
  const items: QueueExportRow[] = [
    { title: 'Hello, World', status: 'queued', score: 8, publication: 'Forbes', words: 1200, createdAt: '2026-06-14T00:00:00.000Z' },
    { title: 'Quote "test"', status: 'review', score: null, publication: null, words: 0, createdAt: '2026-06-13T00:00:00.000Z' },
  ];

  it('emits a header row followed by one row per article', () => {
    const rows = articlesToRows(items);
    expect(rows[0]).toEqual(['Title', 'Status', 'Score', 'Publication', 'Words', 'Created']);
    expect(rows).toHaveLength(3);
    expect(rows[1][0]).toBe('Hello, World');
    expect(rows[1][2]).toBe('8');
    expect(rows[2][2]).toBe(''); // null score renders blank
    expect(rows[2][3]).toBe(''); // null publication renders blank
  });

  it('escapes commas, quotes, and newlines for CSV safety', () => {
    const csv = rowsToCsv(articlesToRows(items));
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Title,Status,Score,Publication,Words,Created');
    // Comma in the title forces quoting
    expect(lines[1].startsWith('"Hello, World",queued,8,Forbes,1200,')).toBe(true);
    // Embedded double-quote is doubled per RFC 4180
    expect(lines[2].startsWith('"Quote ""test""",review,')).toBe(true);
  });
});

describe('coverVisual', () => {
  it('is deterministic for the same seed', () => {
    expect(coverVisual('AI and the future of work')).toEqual(coverVisual('AI and the future of work'));
  });

  it('derives uppercase initials from the first two words', () => {
    expect(coverVisual('Hello World').initials).toBe('HW');
    expect(coverVisual('single').initials).toBe('SI');
    expect(coverVisual('').initials).toBe('?');
  });

  it('produces a hue within the 0–359 range', () => {
    const { hue } = coverVisual('anything goes here');
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThanOrEqual(359);
  });
});
