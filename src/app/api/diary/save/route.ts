import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptEntryFields, type EncryptableEntryFields } from "@/lib/crypto/entryFields";
import type { DiaryEntry, DiaryParagraph, Reading, SessionStamp, Suggestion } from "@/types/diary";

export const runtime = "nodejs";

interface SaveEntryBody {
  dateKey: string;
  content: string;
  stampKind: "photo" | "keyword";
  stampKey: string | null;
  photoPath: string | null;
  status?: "pending" | "reviewed" | "failed";
  overallComment?: string | null;
  suggestions?: Suggestion[];
  readings?: Reading[];
  paragraphs?: DiaryParagraph[];
  stamps?: SessionStamp[];
  reviewedAt?: string | null;
}

/**
 * Encrypts and upserts one diary entry in a single round trip — this used
 * to be two separate calls from the browser (POST /api/diary/encrypt-fields,
 * then a direct Supabase upsert), which was measurably slower for no real
 * benefit once both steps had to happen server-side anyway. See
 * lib/diary/client.ts's `saveEntry`, the only caller.
 *
 * Row ownership comes from the authenticated session (`user.id`), not a
 * client-supplied user id — this was already effectively true under RLS,
 * but doing it here removes even that indirection.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  // getSession() reads the session from cookies with no network round trip
  // — see the same fix (and its full reasoning) in /api/review-paragraph.
  // This route is called on every single save, so a real per-call network
  // hit to re-verify the token here was genuinely adding up.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: SaveEntryBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.dateKey || typeof body.content !== "string" || !body.stampKind) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const status = body.status ?? "reviewed";
  // Encrypted just before this write, never before — every save from here
  // on writes ciphertext for these four fields, regardless of whether the
  // row already existed with legacy plaintext (an entry saved before this
  // feature existed just stays plaintext until it's next touched — see
  // README's "암호화" section).
  const plaintextFields: EncryptableEntryFields = {
    content: body.content,
    overall_comment: body.overallComment ?? null,
    suggestions: body.suggestions ?? [],
    paragraphs: body.paragraphs ?? [],
  };

  try {
    const encrypted = encryptEntryFields(plaintextFields);
    const { data, error } = await supabase
      .from("diary_entries")
      .upsert(
        {
          user_id: user.id,
          entry_date: body.dateKey,
          content: encrypted.content,
          stamp_kind: body.stampKind,
          stamp_key: body.stampKey,
          photo_path: body.photoPath,
          status,
          overall_comment: encrypted.overall_comment,
          suggestions: encrypted.suggestions,
          readings: body.readings ?? [],
          paragraphs: encrypted.paragraphs,
          stamps: body.stamps ?? [],
          reviewed_at: status === "reviewed" ? (body.reviewedAt ?? new Date().toISOString()) : null,
        },
        { onConflict: "user_id,entry_date" }
      )
      .select("*")
      .single();
    if (error) throw error;
    // The row Supabase just echoed back carries ciphertext for these four
    // fields (we just wrote it that way) — merge back the plaintext
    // already in hand instead of a pointless decrypt right after encrypting.
    const entry: DiaryEntry = { ...(data as DiaryEntry), ...plaintextFields };
    return NextResponse.json({ entry });
  } catch (err) {
    console.error("Save entry failed", err);
    return NextResponse.json({ error: "저장에 실패했어요." }, { status: 500 });
  }
}
