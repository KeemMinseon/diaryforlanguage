"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount } from "@/lib/account/deleteAccount";

/** Same bottom-sheet confirmation pattern as ReviewView's 일기 삭제 — this
 * is a heavier, irreversible action than a single day's entry, so it gets
 * the same room to explain the consequences instead of a one-line confirm. */
export default function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      router.push("/login");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "탈퇴 처리에 실패했어요.");
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full px-1 py-3 text-left text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
      >
        회원 탈퇴
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={() => !deleting && setConfirming(false)}
        >
          <div
            className="mx-auto flex w-full max-w-md flex-col gap-5 bg-[var(--paper-raised)] px-5 pt-3 pb-6 border border-[var(--paper-line)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-[var(--paper-line)]" />
            <div className="flex flex-col gap-2">
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--ink)]">
                정말 탈퇴하시겠어요?
              </h2>
              <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
                계정을 탈퇴하면 지금까지 작성한 일기와 사진, 수집한 우표, 단어 학습 기록이 계정과
                함께 영구적으로 삭제됩니다.
                <br />
                삭제된 계정과 데이터는 다시 복구할 수 없어요. 소중한 기록을 잃지 않도록 신중하게
                결정해 주세요.
              </p>
              {error && <p className="text-sm font-medium text-[var(--ink)]">{error}</p>}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex-1 border border-[var(--paper-line)] py-3 text-sm text-[var(--ink)] disabled:opacity-60"
              >
                돌아가기
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={deleting}
                // See ReviewView's identical delete button for why the
                // border is needed on top of --cta in dark mode.
                className="flex-1 border border-[var(--ink)] bg-[var(--cta)] py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {deleting ? "탈퇴하는 중…" : "탈퇴하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
