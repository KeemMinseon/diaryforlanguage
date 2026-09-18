import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Generous for genuine use (a handful of reports/suggestions in one
// sitting), still a hard ceiling against a script spamming the inbox this
// notifies.
const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const MAX_MESSAGE_LENGTH = 2000;

const NOTIFY_EMAIL = "minseonkeem@gmail.com";

/**
 * Best-effort — sent after the row is already safely stored, so a Resend
 * outage (or a missing RESEND_API_KEY in an env that hasn't set one up
 * yet) never loses the feedback itself, only the immediate nudge to check
 * for it. Raw HTTP, not the `resend` package — this is the only email this
 * app's own server ever sends, not worth a dependency for.
 */
async function notifyByEmail(email: string, message: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.FEEDBACK_FROM_EMAIL || "우표일기 <onboarding@resend.dev>",
        to: NOTIFY_EMAIL,
        subject: "우표일기에 새 의견이 도착했어요",
        text: `보낸 사람: ${email}\n\n${message}`,
      }),
    });
    if (!res.ok) console.error("Feedback email notify failed", res.status, await res.text());
  } catch (err) {
    console.error("Feedback email notify failed", err);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { allowed, retryAfterMs } = checkRateLimit(`feedback:${user.id}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
  if (!allowed) {
    return NextResponse.json(
      { error: "의견을 너무 많이 보냈어요. 내일 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "내용을 입력해 주세요." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "내용이 너무 길어요." }, { status: 400 });
  }

  const email = user.email ?? "";
  const { error } = await supabase.from("feedback").insert({ user_id: user.id, email, message });
  if (error) {
    console.error("Failed to save feedback", error);
    return NextResponse.json({ error: "의견을 보내지 못했어요." }, { status: 500 });
  }

  await notifyByEmail(email, message);

  return NextResponse.json({ ok: true });
}
