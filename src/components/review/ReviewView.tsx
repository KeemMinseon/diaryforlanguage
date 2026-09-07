"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EditEntry from "@/components/editor/EditEntry";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import HankoStamp from "@/components/stamps/HankoStamp";
import FuriganaText from "@/components/review/FuriganaText";
import { deleteEntry } from "@/lib/diary/client";
import { buildHighlightSegments } from "@/lib/review/highlight";
import { parseDateKey } from "@/lib/utils/date";
import type { DiaryEntry } from "@/types/diary";

export default function ReviewView({
  userId,
  entry,
  photoUrl,
}: {
  userId: string;
  entry: DiaryEntry;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const segments = buildHighlightSegments(entry.content, entry.suggestions);
  const isReviewed = entry.status === "reviewed";
  const isPending = entry.status === "pending";
  const isFailed = entry.status === "failed";

  const dateLabel = parseDateKey(entry.entry_date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteEntry(entry.id, entry.photo_path);
      router.push(`/?month=${entry.entry_date.slice(0, 7)}`);
    } catch (err) {
      console.error(err);
      setDeleteError("삭제에 실패했어요. 다시 시도해 주세요.");
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          ← 캘린더
        </button>
        <div className="flex items-center gap-3">
          <p className="font-[family-name:var(--font-heading)] text-sm text-[var(--ink-soft)]">
            {dateLabel}
          </p>
          {!editing && !confirmingDelete && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-[var(--ink-soft)] underline underline-offset-2 hover:text-[var(--ink)]"
              >
                수정
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-[var(--ink-soft)] underline underline-offset-2 hover:text-[var(--ink)]"
              >
                삭제
              </button>
            </>
          )}
        </div>
      </header>

      {confirmingDelete && (
        <div className="flex items-center justify-between rounded-xl border border-[var(--paper-line)] bg-[var(--paper-raised)] px-4 py-3">
          <p className="text-sm text-[var(--ink)]">
            이 날짜의 일기를 정말 삭제할까요? 되돌릴 수 없어요.
            {deleteError && <span className="ml-2 font-medium">{deleteError}</span>}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="rounded-full border border-[var(--paper-line)] px-4 py-1.5 text-xs text-[var(--ink-soft)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="rounded-full bg-[var(--ink)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {deleting ? "삭제 중…" : "삭제"}
            </button>
          </div>
        </div>
      )}

      {editing ? (
        <EditEntry
          userId={userId}
          entry={entry}
          existingPhotoUrl={photoUrl}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative w-28 shrink-0 self-start">
              <DiaryStamp
                stampKind={entry.stamp_kind}
                stampKey={entry.stamp_key as never}
                photoUrl={photoUrl}
                className="w-full drop-shadow-md"
              />
              {isReviewed && (
                <HankoStamp className="stamp-pop absolute -bottom-[10%] -right-[14%] w-[56%]" />
              )}
            </div>

            <div className="flex-1 rounded-2xl border border-[var(--paper-line)] bg-[var(--paper-raised)] p-5">
              {isPending && (
                <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--paper-line)]/50 px-3 py-1 text-xs text-[var(--ink-soft)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--ink-soft)]" />
                  添削 검토 중이에요…
                </p>
              )}
              {isFailed && (
                <p className="mb-4 text-xs font-medium text-[var(--ink)]">
                  첨삭 처리 중 문제가 있었어요. 다시 저장하면 재시도돼요.
                </p>
              )}

              <p className="whitespace-pre-wrap font-[family-name:var(--font-diary)] text-lg leading-loose text-[var(--ink)]">
                {segments.map((seg, i) =>
                  seg.suggestionIndex === null ? (
                    <span key={i}>
                      <FuriganaText text={seg.text} readings={entry.readings} />
                    </span>
                  ) : (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setActiveIndex((cur) => (cur === seg.suggestionIndex ? null : seg.suggestionIndex))
                      }
                      className={`rounded px-0.5 underline decoration-[var(--ink)] decoration-2 underline-offset-4 transition ${
                        activeIndex === seg.suggestionIndex ? "bg-black/10" : "bg-black/5"
                      }`}
                    >
                      <FuriganaText text={seg.text} readings={entry.readings} />
                    </button>
                  )
                )}
              </p>
            </div>
          </div>

          {isReviewed && (
            <>
              <section className="rounded-2xl border border-[var(--paper-line)] bg-[var(--paper-raised)] p-5">
                <h2 className="mb-2 font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--ink)]">
                  총평
                </h2>
                <p className="text-sm leading-relaxed text-[var(--ink)]">{entry.overall_comment}</p>
              </section>

              {entry.suggestions.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--ink)]">
                    단어 · 표현 제안
                  </h2>
                  {entry.suggestions.map((s, i) => (
                    <div
                      key={i}
                      onClick={() => setActiveIndex(i)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        activeIndex === i
                          ? "border-[var(--ink)] bg-black/5"
                          : "border-[var(--paper-line)] bg-[var(--paper-raised)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-[var(--ink-soft)] line-through decoration-[var(--ink-soft)]">
                          <FuriganaText text={s.original} readings={entry.readings} />
                        </span>
                        <span aria-hidden="true">→</span>
                        <span className="font-[family-name:var(--font-diary)] font-medium text-[var(--ink)]">
                          <FuriganaText text={s.suggestion} readings={entry.readings} />
                        </span>
                      </div>
                      {s.note && <p className="mt-1.5 text-xs text-[var(--ink-soft)]">{s.note}</p>}
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
