import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptEntryFields, type EncryptableEntryFields } from "@/lib/crypto/entryFields";

export const runtime = "nodejs";

/**
 * Decrypts the sensitive fields of one or more diary entries — called by
 * the browser right after fetching rows from Supabase (see
 * fetchMonthEntries/fetchEntry in lib/diary/client.ts). A legacy entry
 * saved before this feature existed just passes straight through (see
 * `decryptString`'s `isEncrypted` check) rather than failing.
 *
 * A Server Component reading an entry directly (entry/[date]/page.tsx)
 * doesn't need this route at all — it already runs server-side, so it
 * calls `decryptEntryFields` in-process instead of over HTTP.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { items?: EncryptableEntryFields[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const items = body.items.map(decryptEntryFields);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Decrypt failed", err);
    return NextResponse.json({ error: "복호화에 실패했어요." }, { status: 500 });
  }
}
