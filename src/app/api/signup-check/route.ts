import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// A soft cap while the service is small — not a hard technical limit, just
// how many concurrent accounts the developer wants to support paying
// Anthropic's per-call bill for right now (see the affordability numbers
// worked out earlier). Bump via the SIGNUP_CAP env var as capacity grows,
// no code change needed. A freed slot (회원 탈퇴) counts again immediately,
// since public.user_signups mirrors auth.users via cascade delete.
const SIGNUP_CAP = Number(process.env.SIGNUP_CAP) || 10;

/**
 * Called from the login screen right before it would otherwise show the
 * "동의하고 가입" step for a brand-new email — never for a returning
 * login, which never reaches this check at all. Public (no auth): the
 * whole point is to gate an account that doesn't exist yet.
 */
export async function GET() {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("user_signups")
    .select("user_id", { count: "exact", head: true });

  if (error) {
    console.error("signup-check count failed", error);
    // Fail open — a transient DB hiccup blocking a genuine new signup is
    // worse than rarely letting one slip in a hair over the cap.
    return NextResponse.json({ waitlisted: false });
  }

  return NextResponse.json({ waitlisted: (count ?? 0) >= SIGNUP_CAP });
}
