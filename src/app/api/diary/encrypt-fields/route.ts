import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptEntryFields, type EncryptableEntryFields } from "@/lib/crypto/entryFields";

export const runtime = "nodejs";

/**
 * Encrypts the sensitive fields of one or more diary entries — called by
 * the browser right before it writes them to Supabase (see saveEntry in
 * lib/diary/client.ts). A pure stateless transform, no DB access of its
 * own; still gated behind login so it can't be used as a free encryption
 * oracle by anyone who isn't a signed-in user of this app.
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
    const items = body.items.map(encryptEntryFields);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Encrypt failed", err);
    return NextResponse.json({ error: "암호화에 실패했어요." }, { status: 500 });
  }
}
