import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const MAX_EMAIL_LENGTH = 254; // RFC 5321
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Keyed by a normalized form of the email itself, not a user id — nobody
// submitting this is signed in yet. Generous, just enough to stop a
// script from hammering it.
const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Called from the login screen's waitlist step once /api/signup-check has
 * said the signup cap is full. Public (no auth), writes through the admin
 * client — there's no session yet to scope an RLS policy to.
 */
export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "올바른 이메일을 입력해 주세요." }, { status: 400 });
  }

  const { allowed } = checkRateLimit(`waitlist:${email}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
  if (!allowed) {
    // Already-registered-or-rate-limited reads the same to the caller
    // either way (see below) — no need for a distinct error here either.
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("waitlist").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  // A duplicate email (already on the list) isn't a real error — same
  // reasoning as not distinguishing "new signup" from "existing account"
  // in error copy elsewhere: no reason to tell a visitor whether an
  // address was already registered.
  if (error) {
    console.error("Failed to save waitlist signup", error);
    return NextResponse.json({ error: "등록하지 못했어요. 다시 시도해 주세요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
