import type { WordSourceEntry } from "@/lib/diary/client";
import type { Reading, WordProgress } from "@/types/diary";

/** One (original → suggestion) pair collapsed across every entry it
 * appeared in — the 단어장 list shows one card per word, not one per
 * occurrence, so a phrase corrected on three different days still only
 * takes up one row. */
export interface WordItem {
  original: string;
  suggestion: string;
  note: string;
  readings: Reading[];
  /** Most recent entry_date this word appeared in. */
  lastSeen: string;
  /** How many separate entries this exact (original, suggestion) pair showed up in. */
  occurrences: number;
  memorized: boolean;
}

/** Same (original, suggestion) pair can otherwise collide with an
 * unrelated word that happens to share only one of the two fields. */
export function wordKey(original: string, suggestion: string): string {
  return `${original}␟${suggestion}`;
}

/** `entries` must already be sorted most-recent-first (see
 * fetchAllEntriesForWords) — the first occurrence of a key encountered
 * here becomes that word's `lastSeen`/`readings` source. */
export function collectWords(
  entries: WordSourceEntry[],
  progress: WordProgress[]
): WordItem[] {
  const memorizedByKey = new Map(progress.map((p) => [wordKey(p.original, p.suggestion), p.memorized]));
  const byKey = new Map<string, WordItem>();

  for (const entry of entries) {
    for (const s of entry.suggestions) {
      const key = wordKey(s.original, s.suggestion);
      const existing = byKey.get(key);
      if (existing) {
        existing.occurrences += 1;
        continue;
      }
      byKey.set(key, {
        original: s.original,
        suggestion: s.suggestion,
        note: s.note,
        readings: entry.readings,
        lastSeen: entry.entry_date,
        occurrences: 1,
        memorized: memorizedByKey.get(key) ?? false,
      });
    }
  }

  return Array.from(byKey.values());
}
