import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PHOTO_BUCKET = "diary-photos";

/**
 * Permanently deletes the signed-in user's account and everything tied to
 * it. `diary_entries`/`word_progress` cascade via their `on delete cascade`
 * FK to `auth.users` (see schema.sql) once the auth user itself is gone —
 * only the diary photos in Storage don't (Storage objects aren't tied by a
 * DB foreign key), so those are removed explicitly first. Requires the
 * admin client (service role) for both the Storage listing across the
 * user's own folder and the actual `auth.admin.deleteUser` call — neither
 * is something a user's own RLS-scoped session can do.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: files, error: listError } = await admin.storage.from(PHOTO_BUCKET).list(user.id);
  if (listError) {
    console.error("Failed to list account photos for deletion", listError);
    return NextResponse.json({ error: "탈퇴 처리에 실패했어요." }, { status: 500 });
  }
  if (files && files.length > 0) {
    const paths = files.map((f) => `${user.id}/${f.name}`);
    const { error: removeError } = await admin.storage.from(PHOTO_BUCKET).remove(paths);
    // Best-effort, same as deleteEntry's own single-photo cleanup — a
    // leftover orphaned file shouldn't block the account itself from
    // being deleted.
    if (removeError) console.error("Failed to remove account photos", removeError);
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error("Failed to delete auth user", deleteUserError);
    return NextResponse.json({ error: "탈퇴 처리에 실패했어요." }, { status: 500 });
  }

  // The user row (and its session) is already gone server-side — this just
  // clears the now-stale session cookie from the browser.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
