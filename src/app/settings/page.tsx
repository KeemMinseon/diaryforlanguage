import Link from "next/link";
import { redirect } from "next/navigation";
import UiIcon from "@/components/icons/UiIcon";
import ThemeToggle from "@/components/settings/ThemeToggle";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  // See HomePage — proxy.ts already ran the network-verified getUser()
  // for this request, so a local, no-round-trip getSession() is enough
  // here without doubling that auth check on every navigation.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const email = session.user.email ?? "";
  const initial = email.charAt(0).toUpperCase();

  // Same "count without fetching every row" query the stamps/words
  // screens' own big numbers are built from — just scoped to a plain
  // row count instead of collecting stamps/words out of the rows.
  const { count } = await supabase
    .from("diary_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <Link
        href="/"
        className="flex w-fit items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
          ←
        </UiIcon>
        캘린더
      </Link>

      <h1 className="font-[family-name:var(--font-heading)] text-4xl font-bold text-[var(--ink)]">설정</h1>

      <div className="flex items-center gap-4 bg-[var(--paper-raised)] px-5 py-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center bg-[var(--paper-line)] font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--ink-soft)]"
          aria-hidden="true"
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--ink)]">{email}</p>
          <p className="text-xs text-[var(--ink-soft)]">{count ?? 0}일 기록</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="px-1 text-xs font-medium text-[var(--ink-soft)]">일반</p>
        <section className="flex flex-col divide-y divide-[var(--paper-line)] overflow-hidden bg-[var(--paper-raised)]">
          {/* Both fixed for now — no picker yet, just the two rows they'll
              live in. Split apart since they're not the same thing: this
              app's own screens/copy (서비스 언어) versus the language the
              diary itself gets written and reviewed in (학습 언어) — the
              same UI could someday support learning Japanese with an
              English interface, say, so one "언어" setting standing in for
              both was papering over a real distinction. */}
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-[var(--ink)]">서비스 언어</span>
            <span className="text-sm text-[var(--ink-soft)]">한국어</span>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-[var(--ink)]">학습 언어</span>
            <span className="text-sm text-[var(--ink-soft)]">일본어</span>
          </div>
          <ThemeToggle />
        </section>
      </div>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="w-full bg-[var(--paper-raised)] px-5 py-4 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-black/[0.02]"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
