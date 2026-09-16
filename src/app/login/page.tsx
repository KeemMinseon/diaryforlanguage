"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Six boxes, five toned in and the last left null (rendered as an empty
 * bordered square) — see the splash grid in the JSX below. */
const STAMP_PREVIEW_TONES: (string | null)[] = [
  "bg-[var(--paper-line)]",
  "bg-[var(--ink-tertiary)]/40",
  "bg-[var(--paper-line)]",
  "bg-[var(--ink-tertiary)]/40",
  "bg-[var(--paper-line)]",
  null,
];

/**
 * Code-entry login only — not a "click the link" flow: a magic link only
 * completes if it's opened in the SAME browser the sign-in started in
 * (the PKCE code-exchange session lives there), so clicking it from a
 * mail app that opens a different browser (or a different browser
 * entirely) lands back on a plain login screen with nothing to show for
 * it. Typing the code back into this same tab has no such requirement.
 *
 * No `emailRedirectTo` is passed to `signInWithOtp` — this app never
 * deliberately hands out a working link to click, only the code. Whether
 * the email Supabase sends still *shows* a clickable link at all is
 * entirely down to the "Magic Link"/"Confirm signup" template configured
 * in the Supabase dashboard (outside this repo) — if that template still
 * renders `{{ .ConfirmationURL }}`, the email will still display a link,
 * it just won't finish a sign-in when clicked (no redirect target left
 * for it to land on) if the template rendered it now.
 */
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("code");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-evenly px-6 pt-6 pb-12">
      {/* Decorative preview of the calendar "sheet" this app fills in one
          stamp at a time (see MonthCalendar/DayCell) — purely a splash
          visual, not read from any real data, so the last box is always
          left empty to read as "today's still waiting to be written".
          Its own flex item (not grouped with the text below) so
          `justify-evenly` on <main> spreads grid / text / form into even
          gaps that fill the screen, instead of clumping together in the
          middle with all the leftover space dumped below the form — the
          layout this replaced. `mx-auto max-w-sm` on <main> itself (not
          `items-center` on each child) keeps this whole column centered
          on a wide screen while grid/text/form share one left edge inside
          it — centering each block on its own *different* width used to
          leave the grid looking indented relative to the text above it.
          `pb-12` outweighs `pt-6` on purpose: a device tall enough to
          leave `justify-evenly` lots of slack (a tablet, a folded-out
          phone) grew every gap including the top one, but the *bottom*
          gap is the one that actually needs to stay generous — so it
          gets its own floor instead of being just one more equal share of
          the leftover space. */}
      <div className="grid w-1/2 grid-cols-3 gap-1.5">
        {STAMP_PREVIEW_TONES.map((tone, i) =>
          tone ? (
            <div key={i} className={`aspect-[4/5] ${tone}`} />
          ) : (
            <div
              key={i}
              className="aspect-[4/5] border border-[var(--paper-line)] bg-[var(--paper-raised)]"
            />
          )
        )}
      </div>
      <div className="w-full max-w-sm">
        <h1 className="mb-3 font-[family-name:var(--font-heading)] text-3xl font-bold leading-tight text-[var(--ink)]">
          매일 쓰는 일기,
          <br />
          하나씩 채워지는 우표.
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          하루의 일기를 배우고 있는 언어로 써보세요.
          <br />
          자연스럽게 다듬고 저장하면
          <br />
          오늘의 이야기에 어울리는 우표가 채워져요.
        </p>
      </div>

      <div className="w-full max-w-sm">
        {step === "email" ? (
          <form onSubmit={handleSendCode} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-[var(--paper-line)] bg-[var(--paper-raised)] px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
            />
            {error && <p className="text-sm font-medium text-[var(--ink)]">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="bg-[var(--cta)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "보내는 중…" : "이메일로 인증 코드 받기"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="flex flex-col gap-3">
            <p className="text-center text-sm leading-relaxed text-[var(--ink)]">
              <span aria-hidden="true">📮 </span>
              <strong>{email}</strong> 주소로 인증 코드를 보냈어요.
              <br />
              메일에 있는 코드를 입력해 주세요.
              <br />
              <span className="text-[var(--ink-soft)]">메일이 안 보이면 스팸함도 확인해 주세요.</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              required
              placeholder="인증 코드"
              value={code}
              // `inputMode="numeric"` only hints which mobile keyboard to
              // show — it doesn't filter what actually lands in the field,
              // so pasting (or an autofill suggestion inserting) anything
              // non-digit, or longer than the 8-digit code Supabase's OTP
              // actually is, just kept growing the field with nothing to
              // stop it. Stripped to digits and capped at 8 here instead of
              // just `maxLength` alone, which caps length but not content.
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
              className="border border-[var(--paper-line)] bg-[var(--paper-raised)] px-4 py-2.5 text-center text-lg tracking-[0.3em] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
            />
            {error && <p className="text-sm font-medium text-[var(--ink)]">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length === 0}
              className="bg-[var(--cta)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "확인하는 중…" : "로그인"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="text-xs text-[var(--ink-soft)] underline underline-offset-2 hover:text-[var(--ink)]"
            >
              다른 이메일로 다시 받기
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
