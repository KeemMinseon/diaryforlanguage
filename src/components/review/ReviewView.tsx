"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EditEntry from "@/components/editor/EditEntry";
import UiIcon from "@/components/icons/UiIcon";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import FuriganaText from "@/components/review/FuriganaText";
import ReadingsHint from "@/components/review/ReadingsHint";
import { deleteEntry, photoPublicUrl } from "@/lib/diary/client";
import { buildHighlightSegments } from "@/lib/review/highlight";
import { formatSavedAt, parseDateKey } from "@/lib/utils/date";
import type { DiaryEntry, SessionStamp } from "@/types/diary";

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
  // Fanned out by default whenever there's more than one — a pile that
  // needs a tap before you even notice there's more than one stamp under
  // it turned out to hide the very thing this feature was for. Starting
  // open still leaves the tap (below) to collapse it back into a pile,
  // for whenever that reads better (many stamps, say). See the header
  // comment on `stamps` below for what each one is.
  const [fanned, setFanned] = useState(entry.stamps.length > 1);
  // One highlighted word per suggestion index, wherever it actually landed
  // (a specific paragraph, when paragraph history exists) — picking a
  // suggestion card below jumps the content above to that exact word
  // instead of leaving the learner to hunt for it in a long entry.
  const highlightRefs = useRef<Record<number, HTMLButtonElement | null>>({});
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

  // One per writing session (see `SessionStamp`) — an entry saved before
  // that existed has an empty array, so synthesize the one implicit stamp
  // it does have from the top-level stamp_kind/stamp_key/photo_path
  // instead of showing an empty stack.
  const stamps: SessionStamp[] =
    entry.stamps.length > 0
      ? entry.stamps
      : [
          {
            session: 0,
            stampKind: entry.stamp_kind,
            stampKey: entry.stamp_key,
            photoPath: entry.photo_path,
            createdAt: entry.reviewed_at ?? entry.updated_at,
          },
        ];

  // The current top-level photo_path is already resolved server-side (see
  // EntryPage) — reused here rather than re-deriving it client-side, but
  // any *other* session's own photo still needs its own lookup.
  function stampPhotoUrl(s: SessionStamp): string | null {
    if (s.stampKind !== "photo" || !s.photoPath) return null;
    if (s.photoPath === entry.photo_path) return photoUrl;
    return photoPublicUrl(s.photoPath);
  }

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
          ref={(el) => {
            highlightRefs.current[seg.suggestionIndex as number] = el;
          }}
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

  // Scrolls the diary content up to the matching highlighted word whenever
  // a suggestion becomes active — from a suggestion card click (this is the
  // point of it) or from clicking the highlighted word itself (a harmless
  // re-center, since it's already in view then).
  useEffect(() => {
    if (activeIndex === null) return;
    highlightRefs.current[activeIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

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
      <header className="flex items-center justify-between gap-2">
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

      {/* Its own line below the header rather than squeezed into the
          header's middle column — reads as the screen's actual title
          now, in full ink rather than the softer tone it had sharing a
          row with the nav controls. */}
      <p className="whitespace-nowrap text-center font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--ink)]">
        {dateLabel}
      </p>

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
              className="rounded-full bg-[var(--cta)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60"
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
          // The real suggestions/readings/총평 land a few seconds later,
          // in the background, well after this screen already closed
          // (see EditEntry's own header comment) — refresh again to pick
          // that up once it's actually ready, rather than only ever
          // showing whatever was still true the instant "수정 완료" was
          // clicked.
          onBackgroundSaveDone={() => router.refresh()}
        />
      ) : (
        <>
          <div className="flex flex-col items-center gap-8">
            {/* The "우표 N개 · 눌러서 펼치기/접기" caption below the stack
                is deliberately not shown on this screen — it read as
                clutter here (the calendar view still shows an equivalent
                hint). The stamp stack itself stays; only that label is
                gone. */}
            <div className="flex flex-col items-center gap-2">
              {/* Explicit aspect ratio (matching the stamp mask itself,
                  see stampMask.ts) rather than letting a single stamp's own
                  intrinsic height set it — every stamp in the stack is
                  `absolute` to lay them on top of each other, and absolutely
                  positioned children can't contribute to a parent's height
                  the way normal flow content would. */}
              {(() => {
                const stampLayers = stamps.map((s, i) => {
                  // Collapsed: a slight cascading pile behind the front
                  // stamp — 0/0 for it, so a single stamp still lands
                  // exactly where it always has. The front one is always
                  // i = 0 (the day's first session), matching the calendar
                  // view (DayCell/StampedDay always show stamps[0]) rather
                  // than whichever was written last. Fanned: spread evenly
                  // around the center, 부채꼴 (fan) style.
                  const mid = (stamps.length - 1) / 2;
                  const rotate = fanned ? (i - mid) * 16 : -i * 3;
                  const translateX = fanned ? (i - mid) * 58 : -i * 2;
                  return (
                    <div
                      key={s.session}
                      className="absolute inset-0 transition-transform duration-300 ease-out"
                      style={{
                        transform: `translateX(${translateX}%) rotate(${rotate}deg)`,
                        zIndex: stamps.length - 1 - i,
                      }}
                    >
                      <DiaryStamp
                        stampKind={s.stampKind}
                        stampKey={s.stampKey as never}
                        photoUrl={stampPhotoUrl(s)}
                        className="absolute inset-0 h-full w-full drop-shadow-md"
                      />
                      {/* The 添削 hanko (red ink-seal) is deliberately not
                          drawn on this screen — it read oddly here. The
                          calendar view still stamps it. */}
                    </div>
                  );
                });
                const stackClassName = "relative w-[7.7rem] shrink-0 aspect-[499.78/671.48]";
                // A real <button> only when there's actually a stack to
                // toggle — a lone stamp (the common case) stays a plain,
                // non-interactive div, same as before this feature existed.
                return stamps.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setFanned((f) => !f)}
                    aria-label={fanned ? "우표 접기" : "우표 펼치기"}
                    className={`${stackClassName} cursor-pointer appearance-none border-0 bg-transparent p-0`}
                  >
                    {stampLayers}
                  </button>
                ) : (
                  <div className={stackClassName}>{stampLayers}</div>
                );
              })()}
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
                      <p className="whitespace-pre-wrap font-[family-name:var(--font-diary)] text-base leading-loose text-[var(--ink)]">
                        {renderHighlighted(p.text, `p${pi}`)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="whitespace-pre-wrap font-[family-name:var(--font-diary)] text-base leading-loose text-[var(--ink)]">
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
