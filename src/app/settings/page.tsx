import Link from "next/link";
import { redirect } from "next/navigation";
import UiIcon from "@/components/icons/UiIcon";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
            ←
          </UiIcon>
          캘린더
        </Link>
        <h1 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--ink)]">설정</h1>
        <span className="w-[52px]" aria-hidden="true" />
      </header>

      <section className="flex flex-col divide-y divide-[var(--paper-line)] overflow-hidden rounded-2xl border border-[var(--paper-line)] bg-[var(--paper-raised)]">
        {/* Fixed for now — no picker yet, just the row this'll live in. */}
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-[var(--ink)]">일기 언어</span>
          <span className="text-sm text-[var(--ink-soft)]">일본어</span>
        </div>
      </section>

      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="w-full rounded-2xl border border-[var(--paper-line)] bg-[var(--paper-raised)] px-5 py-4 text-left text-sm font-medium text-[var(--ink)] transition hover:bg-black/[0.02]"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
