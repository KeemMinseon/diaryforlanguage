import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // manifest.webmanifest excluded alongside the icon extensions below —
    // without this, an unauthenticated fetch of it (which "홈 화면에 추가"
    // relies on, independent of whether the visitor is logged in) got
    // redirected to the /login page's HTML instead of the actual manifest.
    //
    // api/review-* and api/diary/* are excluded for a different reason:
    // each already does its own `auth.getUser()` check and replies with a
    // clean `{ error: "로그인이 필요합니다." }` JSON 401 — without this
    // exclusion, an expired/missing session hit this middleware first,
    // which 307-redirects to /login instead. `fetch()` follows redirects
    // by default, so the caller (client.ts) would get back the login
    // page's HTML with a 200 status and fail trying to `.json()` it —
    // a confusing parse error instead of the friendly message these
    // routes already have ready to send.
    "/((?!_next/static|_next/image|favicon.ico|api/review-paragraph|api/review-finalize|api/diary/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
