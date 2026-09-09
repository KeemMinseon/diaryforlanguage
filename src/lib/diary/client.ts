"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  DiaryEntry,
  DiaryParagraph,
  ReadingKind,
  Reading,
  SessionStamp,
  Suggestion,
  WordProgress,
} from "@/types/diary";

const PHOTO_BUCKET = "diary-photos";

export async function fetchMonthEntries(
  userId: string,
  monthStartKey: string,
  monthEndKey: string
): Promise<DiaryEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("entry_date", monthStartKey)
    .lte("entry_date", monthEndKey);
  if (error) throw error;
  return (data ?? []) as DiaryEntry[];
}

/** Just enough of every entry to build the 단어장 word list — every day,
 * not scoped to one month, so a word only needs `readings`/`entry_date`
 * rather than the full row. Sourced from `readings`, not `suggestions`:
 * a reading is always exactly one kanji compound or katakana word, where
 * a suggestion can occasionally be a whole corrected sentence. */
export type WordSourceEntry = Pick<DiaryEntry, "entry_date" | "readings">;

export async function fetchAllEntriesForWords(userId: string): Promise<WordSourceEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select("entry_date, readings")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WordSourceEntry[];
}

/** Just enough of every entry to build the 우표 모아보기 collection — the
 * per-session `stamps` array plus the legacy top-level columns it falls
 * back to for an entry saved before that array existed (see
 * collectStamps's `resolveStamps`). */
export type StampSourceEntry = Pick<
  DiaryEntry,
  "entry_date" | "stamps" | "stamp_kind" | "stamp_key" | "photo_path"
>;

export async function fetchAllEntriesForStamps(userId: string): Promise<StampSourceEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select("entry_date, stamps, stamp_kind, stamp_key, photo_path")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StampSourceEntry[];
}

export async function fetchWordProgress(userId: string): Promise<WordProgress[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("word_progress").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as WordProgress[];
}

/** Upserted by (user, text, reading) — the same word marked memorized on
 * one day carries that state everywhere else it appears. */
export async function setWordMemorized(
  userId: string,
  text: string,
  reading: string,
  kind: ReadingKind,
  memorized: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("word_progress")
    .upsert(
      { user_id: userId, text, reading, kind, memorized },
      { onConflict: "user_id,text,reading" }
    );
  if (error) throw error;
}

export async function fetchEntry(userId: string, dateKey: string): Promise<DiaryEntry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("entry_date", dateKey)
    .maybeSingle();
  if (error) throw error;
  return (data as DiaryEntry) ?? null;
}

export function photoPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const supabase = createClient();
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadStampPhoto(
  userId: string,
  dateKey: string,
  blob: Blob
): Promise<string> {
  const supabase = createClient();
  const path = `${userId}/${dateKey}.jpg`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

interface SaveEntryInput {
  userId: string;
  dateKey: string;
  content: string;
  stampKind: "photo" | "keyword";
  stampKey: string | null;
  photoPath: string | null;
  /**
   * The paragraph-by-paragraph writing flow reviews as it goes, so a saved
   * entry is already fully reviewed by the time it's written — status
   * defaults to "reviewed" with the comment/suggestions gathered along
   * the way.
   */
  status?: "pending" | "reviewed" | "failed";
  overallComment?: string | null;
  suggestions?: Suggestion[];
  readings?: Reading[];
  paragraphs?: DiaryParagraph[];
  /** One per writing session — see `SessionStamp`. */
  stamps?: SessionStamp[];
  reviewedAt?: string | null;
}

export async function saveEntry(input: SaveEntryInput): Promise<DiaryEntry> {
  const supabase = createClient();
  const status = input.status ?? "reviewed";
  const { data, error } = await supabase
    .from("diary_entries")
    .upsert(
      {
        user_id: input.userId,
        entry_date: input.dateKey,
        content: input.content,
        stamp_kind: input.stampKind,
        stamp_key: input.stampKey,
        photo_path: input.photoPath,
        status,
        overall_comment: input.overallComment ?? null,
        suggestions: input.suggestions ?? [],
        readings: input.readings ?? [],
        paragraphs: input.paragraphs ?? [],
        stamps: input.stamps ?? [],
        reviewed_at: status === "reviewed" ? (input.reviewedAt ?? new Date().toISOString()) : null,
      },
      { onConflict: "user_id,entry_date" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as DiaryEntry;
}

/** Deletes an entry and its attached photo (if any). RLS keeps this to the owner's own row. */
export async function deleteEntry(entryId: string, photoPath: string | null): Promise<void> {
  const supabase = createClient();
  if (photoPath) {
    // Best-effort — a failed storage cleanup shouldn't block deleting the entry itself.
    const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove([photoPath]);
    if (storageError) console.error("Failed to remove diary photo", storageError);
  }
  const { error } = await supabase.from("diary_entries").delete().eq("id", entryId);
  if (error) throw error;
}
