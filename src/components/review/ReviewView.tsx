"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EditEntry from "@/components/editor/EditEntry";
import UiIcon from "@/components/icons/UiIcon";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import HankoStamp from "@/components/stamps/HankoStamp";
import FuriganaText from "@/components/review/FuriganaText";
import ReadingsHint from "@/components/review/ReadingsHint";
import { deleteEntry } from "@/lib/diary/client";
import { buildHighlightSegments } from "@/lib/review/highlight";
import { parseDateKey } from "@/lib/utils/date";
import type { DiaryEntry } from "@/types/diary";

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Just the time when saved the same local day as the entry itself; full
 * date + time when a paragraph was added on a later day ("이어서 쓰기"
 * on a different day than the entry's own date), so that's not ambiguous. */
function formatSavedAt(iso: string, entryDateKey: string): string {
  const saved = new Date(iso);
  if (localDateKey(saved) === entryDateKey) {
    return saved.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  }
  return saved.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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
  // "이어서 쓰기" stays on this exact route (/entry/[date]), just adding
  // ?continue=1 — Next's loading.tsx boundary only fires for an actual
  // route-segment change, not a search-param-only navigation, so this
  // page would otherwise just sit here doing nothing while ChatEditor's
  // data loads behind it. useTransition's isPending is the standard way
  // to still get a pending state for that click specifically.
  const [continuePending, startContinueTransition] = useTransition();

  // An entry saved before per-paragraph history existed has none — fall
  // back to the old single flat block instead of showing nothing.
  const hasParagraphHistory = entry.paragraphs.length > 0;
  const isReviewed = entry.status === "reviewed";
  const isPending = entry.status === "pending";
  const isFailed = entry.status === "failed";

  const dateLabel = parseDateKey(entry.entry_date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  function renderHighlighted(text: string, keyPrefix: string) {
    return buildHighlightSegments(text, entry.suggestions).map((seg, i) =>
      seg.suggestionIndex === null ? (
        <span key={`${keyPrefix}-${i}`}>{seg.text}</span>
      ) : (
        <button
          key={`${keyPrefix}-${i}`}
          type="button"
          onClick={() =>
            setActiveIndex((cur) => (cur === seg.suggestionIndex ? null : seg.suggestionIndex))
          }
          className={`rounded px-0.5 underline decoration-[var(--ink)] decoration-2 underline-offset-4 transition ${
            activeIndex === seg.suggestionIndex ? "bg-black/10" : "bg-black/5"
          }`}
        >
          {seg.text}
        </button>
      )
    );
  }

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
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
            ←
          </UiIcon>
          캘린더
        </button>
        <p className="whitespace-nowrap text-center font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--ink-soft)]">
          {dateLabel}
        </p>
        <div className="flex items-center justify-end gap-3">
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
        <div className="flex items-center justify-between rounded-xl bg-[var(--paper-raised)] px-4 py-3">
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
          <div className="flex flex-col items-center gap-8">
            <div className="relative w-[7.7rem] shrink-0">
              <DiaryStamp
                stampKind={entry.stamp_kind}
                stampKey={entry.stamp_key as never}
                photoUrl={photoUrl}
                className="w-full drop-shadow-md"
              />
              {isReviewed && (
                <HankoStamp className="stamp-pop absolute -bottom-[10%] -right-[14%] w-[50%]" />
              )}
            </div>

            <div className="w-full rounded-2xl bg-[var(--paper-raised)] p-5">
              {isPending && (
                <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--paper-line)]/50 px-3 py-1 text-xs text-[var(--ink-soft)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--ink-soft)]" />
                  검토 중이에요…
                </p>
              )}
              {isFailed && (
                <p className="mb-4 text-xs font-medium text-[var(--ink)]">
                  첨삭 처리 중 문제가 있었어요. 다시 저장하면 재시도돼요.
                </p>
              )}

              {hasParagraphHistory ? (
                <div className="flex flex-col gap-4">
                  {entry.paragraphs.map((p, pi) => (
                    <div key={pi} className="flex flex-col gap-1">
                      <p className="text-xs text-[var(--ink-soft)]">
                        {formatSavedAt(p.savedAt, entry.entry_date)}
                      </p>
                      <p className="whitespace-pre-wrap font-[family-name:var(--font-diary)] text-lg leading-loose text-[var(--ink)]">
                        {renderHighlighted(p.text, `p${pi}`)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="whitespace-pre-wrap font-[family-name:var(--font-diary)] text-lg leading-loose text-[var(--ink)]">
                  {renderHighlighted(entry.content, "flat")}
                </p>
              )}
            </div>
          </div>

          {(isReviewed || isPending || isFailed) && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={continuePending}
                onClick={() =>
                  startContinueTransition(() => {
                    router.push(`/entry/${entry.entry_date}?continue=1`);
                  })
                }
                className="text-xs text-[var(--ink-soft)] underline underline-offset-2 hover:text-[var(--ink)] disabled:opacity-60"
              >
                {continuePending ? "불러오는 중…" : isFailed ? "다시 시도" : "이어서 쓰기"}
              </button>
            </div>
          )}

          {isReviewed && (
            <>
              {entry.suggestions.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--ink)]">
                    단어 · 표현 제안
                  </h2>
                  {entry.suggestions.map((s, i) => (
                    <div
                      key={i}
                      onClick={() => setActiveIndex(i)}
                      className={`flex cursor-pointer flex-col gap-1 rounded-xl p-4 transition ${
                        activeIndex === i
                          ? "border border-[var(--ink)] bg-black/5"
                          : "border border-transparent bg-[var(--paper-raised)]"
                      }`}
                    >
                      {/* Original → suggestion → guide note, stacked in that
                          reading order — color alone (soft original, full-ink
                          suggestion) already reads as "before → after", so no
                          strikethrough/arrow needed on top of that (same as
                          the calendar's month word list). */}
                      <span className="text-[13px] text-[var(--ink-soft)]">
                        <FuriganaText text={s.original} readings={entry.readings} />
                      </span>
                      <span className="font-[family-name:var(--font-diary)] text-base font-medium text-[var(--ink)]">
                        <FuriganaText text={s.suggestion} readings={entry.readings} />
                      </span>
                      {s.note && <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{s.note}</p>}
                    </div>
                  ))}
                </section>
              )}

              {entry.readings.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--ink)]">
                    읽기 안내
                  </h2>
                  <div className="rounded-2xl bg-[var(--paper-raised)] p-5">
                    <ReadingsHint readings={entry.readings} />
                  </div>
                </section>
              )}

              <section className="flex flex-col gap-2">
                <h2 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--ink)]">
                  총평
                </h2>
                <div className="rounded-2xl bg-[var(--paper-raised)] p-5">
                  <p className="text-sm leading-relaxed text-[var(--ink)]">{entry.overall_comment}</p>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
