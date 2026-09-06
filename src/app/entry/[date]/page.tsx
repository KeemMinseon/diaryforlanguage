import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DiaryEditor from "@/components/editor/DiaryEditor";
import ReviewView from "@/components/review/ReviewView";
import type { DiaryEntry } from "@/types/diary";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function EntryPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!DATE_RE.test(date)) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: entry } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("entry_date", date)
    .maybeSingle();

  if (!entry) {
    return <DiaryEditor userId={user.id} dateKey={date} />;
  }

  const typedEntry = entry as DiaryEntry;
  let photoUrl: string | null = null;
  if (typedEntry.stamp_kind === "photo" && typedEntry.photo_path) {
    photoUrl = supabase.storage.from("diary-photos").getPublicUrl(typedEntry.photo_path).data
      .publicUrl;
  }

  return <ReviewView entry={typedEntry} photoUrl={photoUrl} />;
}
