import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptEntryFields } from "@/lib/crypto/entryFields";
import type { DiaryEntry } from "@/types/diary";

export const runtime = "nodejs";

/**
 * Fetches and decrypts every entry in a date range (a calendar month) in a
 * single round trip — see /api/diary/save's doc comment for why this
 * replaced two separate browser-side calls. See lib/diary/client.ts's
 * `fetchMonthEntries`, called by MonthCalendar on every month view.
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
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("user_id", user.id)
    .gte("entry_date", start)
    .lte("entry_date", end);
  if (error) {
    console.error("Fetch month entries failed", error);
    return NextResponse.json({ error: "불러오지 못했어요." }, { status: 500 });
  }

  try {
    const rows = (data ?? []) as DiaryEntry[];
    const entries = rows.map((row) => ({
      ...row,
      ...decryptEntryFields({
        content: row.content,
        overall_comment: row.overall_comment,
        suggestions: row.suggestions,
        paragraphs: row.paragraphs,
      }),
    }));
    return NextResponse.json({ entries });
  } catch (err) {
    console.error("Decrypt month entries failed", err);
    return NextResponse.json({ error: "복호화에 실패했어요." }, { status: 500 });
  }
}
