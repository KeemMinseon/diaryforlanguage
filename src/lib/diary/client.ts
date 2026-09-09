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
// Type-only — erased at compile time, so this never drags the server-only
// crypto module (see entryFields.ts -> serverEncryption.ts, Node `crypto`)
// into this "use client" file's browser bundle. The actual encrypt/decrypt
// work happens behind the two API routes below, never in the browser.
import type { EncryptableEntryFields } from "@/lib/crypto/entryFields";

const PHOTO_BUCKET = "diary-photos";

/** `content`/`overall_comment`/`suggestions`/`paragraphs` are the fields
 * that get encrypted at rest (see entryFields.ts) — slice a fetched row
 * down to just those before sending it to /api/diary/decrypt-fields. */
function pickEncryptableFields(row: DiaryEntry): EncryptableEntryFields {
  return {
    content: row.content,
    overall_comment: row.overall_comment,
    suggestions: row.suggestions,
    paragraphs: row.paragraphs,
  };
}

function withFields(row: DiaryEntry, fields: EncryptableEntryFields): DiaryEntry {
  return { ...row, ...fields };
}

async function callCryptoApi(
  direction: "encrypt" | "decrypt",
  items: EncryptableEntryFields[]
): Promise<EncryptableEntryFields[]> {
  if (items.length === 0) return [];
  const res = await fetch(`/api/diary/${direction}-fields`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "처리에 실패했어요.");
  return data.items as EncryptableEntryFields[];
}

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
  const rows = (data ?? []) as DiaryEntry[];
  const decrypted = await callCryptoApi("decrypt", rows.map(pickEncryptableFields));
  return rows.map((row, i) => withFields(row, decrypted[i]));
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
  if (!data) return null;
  const row = data as DiaryEntry;
  const [decrypted] = await callCryptoApi("decrypt", [pickEncryptableFields(row)]);
  return withFields(row, decrypted);
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
  // Encrypted just before this write, never before — every save from
  // here on writes ciphertext for these four fields, regardless of
  // whether the row already existed with legacy plaintext (that's what
  // "새 일기부터만 적용" turns into once collapsed onto a single upsert
  // path: the day it's next touched, not the day it was first written).
  const plaintextFields: EncryptableEntryFields = {
    content: input.content,
    overall_comment: input.overallComment ?? null,
    suggestions: input.suggestions ?? [],
    paragraphs: input.paragraphs ?? [],
  };
  const [encrypted] = await callCryptoApi("encrypt", [plaintextFields]);
  const { data, error } = await supabase
    .from("diary_entries")
    .upsert(
      {
        user_id: input.userId,
        entry_date: input.dateKey,
        content: encrypted.content,
        stamp_kind: input.stampKind,
        stamp_key: input.stampKey,
        photo_path: input.photoPath,
        status,
        overall_comment: encrypted.overall_comment,
        suggestions: encrypted.suggestions,
        readings: input.readings ?? [],
        paragraphs: encrypted.paragraphs,
        stamps: input.stamps ?? [],
        reviewed_at: status === "reviewed" ? (input.reviewedAt ?? new Date().toISOString()) : null,
      },
      { onConflict: "user_id,entry_date" }
    )
    .select("*")
    .single();
  if (error) throw error;
  // The row Supabase just echoed back carries ciphertext for these four
  // fields (we just wrote it that way) — merge back the plaintext this
  // function already has in memory instead of an extra decrypt round trip.
  return withFields(data as DiaryEntry, plaintextFields);
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
