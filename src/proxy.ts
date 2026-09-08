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
    "/((?!_next/static|_next/image|favicon.ico|api/review-paragraph|api/review-finalize|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)",
  ],
};
