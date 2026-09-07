import type { Reading } from "@/types/diary";

export interface ReadingSegment {
  text: string;
  reading: Reading | null;
}

/**
 * Splits `text` into plain and annotated runs, one per matched reading —
 * unlike suggestion highlighting (first occurrence only), this finds
 * *every* occurrence of each reading's word so a kanji/katakana term keeps
 * its furigana/romaji each time it shows up in the paragraph.
 */
export function buildReadingSegments(text: string, readings: Reading[]): ReadingSegment[] {
  type Match = { start: number; end: number; readingIndex: number };
  const candidates: Match[] = [];

  readings.forEach((r, i) => {
    if (!r.text) return;
    let idx = text.indexOf(r.text);
    while (idx !== -1) {
      candidates.push({ start: idx, end: idx + r.text.length, readingIndex: i });
      idx = text.indexOf(r.text, idx + 1);
    }
  });

  // Leftmost first; at the same start, prefer the longer match.
  candidates.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const chosen: Match[] = [];
  let cursor = 0;
  for (const c of candidates) {
    if (c.start < cursor) continue;
    chosen.push(c);
    cursor = c.end;
  }

  const segments: ReadingSegment[] = [];
  let pos = 0;
  for (const c of chosen) {
    if (c.start > pos) {
      segments.push({ text: text.slice(pos, c.start), reading: null });
    }
    segments.push({ text: text.slice(c.start, c.end), reading: readings[c.readingIndex] });
    pos = c.end;
  }
  if (pos < text.length) {
    segments.push({ text: text.slice(pos), reading: null });
  }
  return segments;
}
