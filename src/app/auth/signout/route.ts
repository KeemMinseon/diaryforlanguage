import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 (not the default 307) — a 307/308 preserves the original request's
  // method on the redirect target, so the browser would retry this exact
  // POST against /login, a plain page route with no POST handler (405).
  // 303 always turns the follow-up into a GET, which is what a
  // post-then-redirect flow like this one actually wants.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
