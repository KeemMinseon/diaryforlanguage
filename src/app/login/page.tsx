"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--paper-raised)] p-8">
        <h1 className="mb-1 text-center font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--ink)]">
          우표일기
        </h1>
        <p className="mb-8 text-center text-sm text-[var(--ink-soft)]">
          매일 한 줄, 일본어로 적는 나의 일기장
        </p>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-[var(--paper-line)] bg-[var(--paper-raised)] px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]"
            />
            {error && <p className="text-sm font-medium text-[var(--ink)]">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[var(--cta)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
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
              maxLength={6}
              required
              placeholder="인증 코드"
              value={code}
              // `inputMode="numeric"` only hints which mobile keyboard to
              // show — it doesn't filter what actually lands in the field,
              // so pasting (or an autofill suggestion inserting) anything
              // non-digit, or longer than the 6-digit code Supabase's OTP
              // actually is, just kept growing the field with nothing to
              // stop it. Stripped to digits and capped at 6 here instead of
              // just `maxLength` alone, which caps length but not content.
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="rounded-lg border border-[var(--paper-line)] bg-[var(--paper-raised)] px-4 py-2.5 text-center text-lg tracking-[0.3em] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
            />
            {error && <p className="text-sm font-medium text-[var(--ink)]">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.length === 0}
              className="rounded-lg bg-[var(--cta)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
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
