"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--paper-line)] bg-[var(--paper-raised)] p-8 shadow-sm">
        <h1 className="mb-1 text-center font-[family-name:var(--font-heading)] text-2xl text-[var(--ink)]">
          言の葉日記
        </h1>
        <p className="mb-8 text-center text-sm text-[var(--ink-soft)]">
          매일 한 줄, 일본어로 적는 나의 일기장
        </p>

        {sent ? (
          <p className="text-center text-sm leading-relaxed text-[var(--ink)]">
            <span aria-hidden="true">📮 </span>
            <strong>{email}</strong> 주소로 로그인 링크를 보냈어요.
            <br />
            메일함을 확인해 주세요.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-[var(--paper-line)] bg-white px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--shu-soft)]"
            />
            {error && <p className="text-sm text-[var(--shu)]">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[var(--shu)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "보내는 중…" : "이메일로 로그인 링크 받기"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
