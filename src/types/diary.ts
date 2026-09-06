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
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DiaryEntryMap = Record<string, DiaryEntry>; // keyed by entry_date
