export type EntryStatus = "pending" | "reviewed" | "failed";

export type StampKind = "photo" | "keyword";

export interface Suggestion {
  /** The original phrase/word as written in the diary (target language). */
  original: string;
  /** The suggested correction. */
  suggestion: string;
  /** Short explanation, written in the learner's native language. */
  note: string;
}

export type ReadingKind = "kanji" | "katakana";

export interface Reading {
  /** The kanji compound or katakana word as it appears in the diary text. */
  text: string;
  /** Hiragana reading (kanji) or romanized reading (katakana). */
  reading: string;
  kind: ReadingKind;
}

/** One paragraph as sent for review, with the feedback it got and when it
 * was saved — lets a day's entry be reopened and added to later while
 * still showing how it grew across separate sittings. */
export interface DiaryParagraph {
  text: string;
  comment: string;
  suggestions: Suggestion[];
  readings: Reading[];
  savedAt: string; // ISO timestamp
}

export interface DiaryEntry {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  content: string;
  stamp_kind: StampKind;
  stamp_key: string | null; // keyword stamp id, when stamp_kind === "keyword"
  photo_path: string | null; // storage object path, when stamp_kind === "photo"
  status: EntryStatus;
  overall_comment: string | null;
  suggestions: Suggestion[];
  /** Furigana (kanji) / romaji (katakana) readings collected while writing. */
  readings: Reading[];
  /** Empty for an entry saved before this existed — the review screen
   * falls back to showing `content` as one untimed block in that case. */
  paragraphs: DiaryParagraph[];
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DiaryEntryMap = Record<string, DiaryEntry>; // keyed by entry_date

/** Whether the learner has marked one specific (original, suggestion)
 * word/expression pair as memorized — shared across every entry it
 * appears in, not tracked per-occurrence. See 단어장 (WordListView). */
export interface WordProgress {
  id: string;
  user_id: string;
  original: string;
  suggestion: string;
  memorized: boolean;
  updated_at: string;
}
