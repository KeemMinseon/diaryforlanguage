"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISSED_KEY = "feedback-nudge-dismissed";
const MIN_DAYS_SINCE_SIGNUP = 3;

/**
 * A one-time nudge to "의견 보내기" once someone's had a few days to
 * actually form an opinion of the app — not tied to how much they've
 * written, just how long they've had an account (`createdAt` is the
 * auth user's own `created_at`, already on hand server-side with no
 * extra query). Dismissing it (the × or following the link either one)
 * is remembered in localStorage so it never nags twice — a per-device
 * convenience, not something that needs to survive a fresh browser or
 * sync across devices.
 */
export default function FeedbackNudgeBanner({ createdAt }: { createdAt: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      // Private-mode/blocked storage — fall through and show it anyway;
      // worst case it can't remember being dismissed this session.
    }
    const daysSinceSignup = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
    // localStorage only exists client-side — this has to run in an effect,
    // not during render, so starting hidden and flipping visible here
    // (rather than the reverse) is what avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (daysSinceSignup >= MIN_DAYS_SINCE_SIGNUP) setVisible(true);
  }, [createdAt]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Nothing more to do — it just asks again next visit.
    }
  }

  if (!visible) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-[var(--card-highlight)] px-4 py-3 border border-[var(--paper-line)]">
      <p className="text-sm text-[var(--ink)]">
        며칠 써보셨는데 어떠셨어요?{" "}
        <Link href="/feedback" onClick={dismiss} className="font-medium underline underline-offset-2">
          의견 들려주기
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="닫기"
        className="shrink-0 text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        ✕
      </button>
    </div>
  );
}
