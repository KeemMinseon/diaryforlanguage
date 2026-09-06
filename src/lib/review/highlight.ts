import type { Suggestion } from "@/types/diary";

export interface ContentSegment {
  text: string;
  suggestionIndex: number | null;
}

/**
 * Splits diary content into plain-text and highlighted segments, one per
 * matched suggestion's first occurrence in the text. Overlapping or
 * missing matches are skipped defensively (suggestions are AI output).
 */
export function buildHighlightSegments(
  content: string,
  suggestions: Suggestion[]
): ContentSegment[] {
  type Match = { start: number; end: number; suggestionIndex: number };
  const matches: Match[] = [];

  suggestions.forEach((s, i) => {
    if (!s.original) return;
    const start = content.indexOf(s.original);
    if (start === -1) return;
    matches.push({ start, end: start + s.original.length, suggestionIndex: i });
  });

  matches.sort((a, b) => a.start - b.start);

  const nonOverlapping: Match[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue;
    nonOverlapping.push(m);
    cursor = m.end;
  }

  const segments: ContentSegment[] = [];
  let pos = 0;
  for (const m of nonOverlapping) {
    if (m.start > pos) {
      segments.push({ text: content.slice(pos, m.start), suggestionIndex: null });
    }
    segments.push({ text: content.slice(m.start, m.end), suggestionIndex: m.suggestionIndex });
    pos = m.end;
  }
  if (pos < content.length) {
    segments.push({ text: content.slice(pos), suggestionIndex: null });
  }
  return segments;
}
