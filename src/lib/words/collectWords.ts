import type { WordSourceEntry } from "@/lib/diary/client";
import type { ReadingKind, WordProgress } from "@/types/diary";

/** One reading (a kanji compound or katakana word) collapsed across every
 * entry it appeared in — the 단어장 list shows one card per word, not one
 * per occurrence, so a word read on three different days still only
 * takes up one row. Built from `readings` rather than `suggestions`: a
 * reading is always exactly one word/term, where a suggestion can
 * occasionally be a whole corrected sentence — not what a vocabulary list
 * should be full of. */
export interface WordItem {
  text: string;
  reading: string;
  kind: ReadingKind;
  /** Short Korean gloss — empty for a word saved before this existed
   * (its stored reading has no `meaning` at all). */
  meaning: string;
  /** Most recent entry_date this word appeared in. */
  lastSeen: string;
  /** How many separate entries this exact (text, reading) pair showed up in. */
  occurrences: number;
  memorized: boolean;
  /** Cumulative correct matches in 단어 테스트 (WordQuiz) — see WordQuiz's
   * memorize-threshold logic in WordListView. 0 for a word never quizzed,
   * or saved before this column existed. */
  quizCorrectCount: number;
}

/** Same (text, reading) pair can otherwise collide with an unrelated word
 * that happens to share only one of the two fields. */
export function wordKey(text: string, reading: string): string {
  return `${text}␟${reading}`;
}

/** `entries` must already be sorted most-recent-first (see
 * fetchAllEntriesForWords) — the first occurrence of a key encountered
 * here becomes that word's `lastSeen` source. */
export function collectWords(
  entries: WordSourceEntry[],
  progress: WordProgress[]
): WordItem[] {
  const progressByKey = new Map(progress.map((p) => [wordKey(p.text, p.reading), p]));
  const byKey = new Map<string, WordItem>();

  for (const entry of entries) {
    for (const r of entry.readings) {
      if (!r.text || !r.reading) continue;
      const key = wordKey(r.text, r.reading);
      const existing = byKey.get(key);
      if (existing) {
        existing.occurrences += 1;
        continue;
      }
      const existingProgress = progressByKey.get(key);
      byKey.set(key, {
        text: r.text,
        reading: r.reading,
        kind: r.kind,
        meaning: r.meaning ?? "",
        lastSeen: entry.entry_date,
        occurrences: 1,
        memorized: existingProgress?.memorized ?? false,
        quizCorrectCount: existingProgress?.quiz_correct_count ?? 0,
      });
    }
  }

  return Array.from(byKey.values());
}
