import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatEditor from "@/components/editor/ChatEditor";
import ReviewView from "@/components/review/ReviewView";
import { decryptEntryFields } from "@/lib/crypto/entryFields";
import type { DiaryEntry } from "@/types/diary";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ continue?: string }>;
}) {
  const { date } = await params;
  if (!DATE_RE.test(date)) redirect("/");

  const supabase = await createClient();
  // See HomePage — proxy.ts already ran the network-verified getUser()
  // for this request, so a local, no-round-trip getSession() is enough
  // here without doubling that auth check on every navigation.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const userId = session.user.id;

  const { data: entry } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("entry_date", date)
    .maybeSingle();

  if (!entry) {
    return <ChatEditor userId={userId} dateKey={date} />;
  }

  const rawEntry = entry as DiaryEntry;
  // This page already runs server-side, so decrypting happens in-process
  // here rather than over HTTP (unlike the browser's own fetchEntry/
  // fetchMonthEntries in lib/diary/client.ts, which call the
  // /api/diary/decrypt-fields route instead — see README's "암호화"
  // section for what's encrypted and why).
  const typedEntry: DiaryEntry = {
    ...rawEntry,
    ...decryptEntryFields({
      content: rawEntry.content,
      overall_comment: rawEntry.overall_comment,
      suggestions: rawEntry.suggestions,
      paragraphs: rawEntry.paragraphs,
    }),
  };
  let photoUrl: string | null = null;
  if (typedEntry.stamp_kind === "photo" && typedEntry.photo_path) {
    photoUrl = supabase.storage.from("diary-photos").getPublicUrl(typedEntry.photo_path).data
      .publicUrl;
  }

  // "이어서 쓰기" from the review screen: reopen the chat editor pre-filled
  // with what's already saved, rather than the read-only review.
  const { continue: shouldContinue } = await searchParams;
  if (shouldContinue) {
    return <ChatEditor userId={userId} dateKey={date} initialEntry={typedEntry} />;
  }

  return <ReviewView userId={userId} entry={typedEntry} photoUrl={photoUrl} />;
}
