import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptEntryFields } from "@/lib/crypto/entryFields";
import type { DiaryEntry } from "@/types/diary";

export const runtime = "nodejs";

/**
 * Fetches and decrypts one diary entry by date in a single round trip —
 * see /api/diary/save's doc comment for why this replaced two separate
 * browser-side calls. See lib/diary/client.ts's `fetchEntry`, the only
 * caller (currently itself unused elsewhere, kept for parity/future use).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateKey = searchParams.get("date");
  if (!dateKey) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("entry_date", dateKey)
    .maybeSingle();
  if (error) {
    console.error("Fetch entry failed", error);
    return NextResponse.json({ error: "불러오지 못했어요." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ entry: null });
  }

  try {
    const row = data as DiaryEntry;
    const decrypted = decryptEntryFields({
      content: row.content,
      overall_comment: row.overall_comment,
      suggestions: row.suggestions,
      paragraphs: row.paragraphs,
    });
    return NextResponse.json({ entry: { ...row, ...decrypted } });
  } catch (err) {
    console.error("Decrypt entry failed", err);
    return NextResponse.json({ error: "복호화에 실패했어요." }, { status: 500 });
  }
}
