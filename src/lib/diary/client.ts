"use client";

import { createClient } from "@/lib/supabase/client";
import type { DiaryEntry } from "@/types/diary";

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
}

export async function saveEntry(input: SaveEntryInput): Promise<DiaryEntry> {
  const supabase = createClient();
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
        status: "pending",
        overall_comment: null,
        suggestions: [],
        reviewed_at: null,
      },
      { onConflict: "user_id,entry_date" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as DiaryEntry;
}

/** Fire-and-forget: kicks off the background Claude review for an entry. */
export function triggerReview(entryId: string) {
  fetch("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryId }),
  }).catch((err) => console.error("Failed to trigger review", err));
}
