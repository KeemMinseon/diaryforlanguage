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
  /** Short Korean gloss (e.g. "만나다"), shown in 단어장. Optional because
   * an entry saved before this existed has readings with no `meaning` key
   * in its stored JSON at all. */
  meaning?: string;
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
  /** Which sitting this paragraph was written in — 0 for the entry's first
   * visit, incremented by one each time "이어서 쓰기" reopens it. Missing
   * (treat as 0) on a paragraph saved before this existed. See
   * `SessionStamp` — one of these gets its own stamp per session. */
  session?: number;
}

/** One session's own stamp — a day with several "이어서 쓰기" sittings
 * gets one of these per sitting instead of a single stamp for the whole
 * day, each picked from (or a photo attached during) just that sitting's
 * own new writing. `session` matches the same field on `DiaryParagraph`.
 * The calendar shows only the latest (last in this array) plus a hint
 * layer when there's more than one; the entry detail screen shows the
 * full stack, fanned out on tap. */
export interface SessionStamp {
  session: number;
  stampKind: StampKind;
  stampKey: string | null;
  photoPath: string | null;
  createdAt: string; // ISO timestamp
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
  /** One per writing session (see `SessionStamp`) — empty for an entry
   * saved before this existed, or one that's never been reopened via
   * "이어서 쓰기" since. The review screen falls back to synthesizing a
   * single one from `stamp_kind`/`stamp_key`/`photo_path` in that case. */
  stamps: SessionStamp[];
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DiaryEntryMap = Record<string, DiaryEntry>; // keyed by entry_date

/** Whether the learner has marked one specific reading (a kanji compound
 * or katakana word, same shape as `Reading`) as memorized — shared across
 * every entry it appears in, not tracked per-occurrence. See 단어장
 * (WordListView). Sourced from `readings` rather than `suggestions`: a
 * reading is always exactly one word/term, where a suggestion can
 * occasionally be a whole corrected sentence. */
export interface WordProgress {
  id: string;
  user_id: string;
  text: string;
  reading: string;
  kind: ReadingKind;
  memorized: boolean;
  /** Cumulative correct matches in 단어 테스트 (WordQuiz) — see
   * schema.sql's comment on this column. */
  quiz_correct_count: number;
  updated_at: string;
}
