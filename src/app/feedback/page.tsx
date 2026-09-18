"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UiIcon from "@/components/icons/UiIcon";
import { sendFeedback } from "@/lib/feedback/sendFeedback";

export default function FeedbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await sendFeedback(message.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "의견을 보내지 못했어요.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex w-fit items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
          ←
        </UiIcon>
        뒤로
      </button>

      <div className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--ink)]">
          의견 보내기
        </h1>
        <p className="text-sm text-[var(--ink-soft)]">
          불편한 점이나 있었으면 하는 기능, 무엇이든 편하게 알려주세요.
        </p>
      </div>

      {sent ? (
        <p className="text-sm leading-relaxed text-[var(--ink)]">
          의견 보내주셔서 감사해요. 꼼꼼히 읽어볼게요. 🙏
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            required
            rows={8}
            maxLength={2000}
            placeholder="예: 캘린더에서 이런 게 있으면 좋겠어요..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="resize-none border border-[var(--paper-line)] bg-[var(--paper-raised)] px-4 py-3 text-sm leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--ink)]"
          />
          {error && <p className="text-sm font-medium text-[var(--ink)]">{error}</p>}
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="bg-[var(--cta)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {sending ? "보내는 중…" : "보내기"}
          </button>
        </form>
      )}
    </div>
  );
}
