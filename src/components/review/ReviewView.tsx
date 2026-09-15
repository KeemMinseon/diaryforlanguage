"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EditEntry from "@/components/editor/EditEntry";
import UiIcon from "@/components/icons/UiIcon";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import { deleteEntry, fetchEntry, photoPublicUrl } from "@/lib/diary/client";
import { onDiaryStamped } from "@/lib/events/diaryStamped";
import { applyCorrections } from "@/lib/review/highlight";
import { formatDateStamp } from "@/lib/utils/date";
import type { DiaryEntry, DiaryParagraph, Reading, SessionStamp, Suggestion } from "@/types/diary";

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

  // Server-rendered page: nothing re-fetches this screen on its own once
  // the background review (see ChatEditor/EditEntry) finishes elsewhere —
  // without this, a learner just sitting here watching "검토 중이에요…"
  // would see it frozen forever even after the review actually landed.
  // `onDiaryStamped` covers the common case (this exact tab, still open,
  // hears the event the moment the background save finishes) and refreshes
  // right away. The interval is a fallback for whenever that's missed
  // (e.g. this screen wasn't mounted yet the instant the event fired) —
  // it checks the *lightweight* status via `fetchEntry` first and only
  // calls `router.refresh()` (which re-renders this whole page) once
  // that's actually changed, rather than blindly refreshing every single
  // tick — a blind `router.refresh()` every 4s repainted the page (stamps
  // included) that often even while genuinely still pending, which read
  // as the screen flickering for no reason. Both stop themselves as soon
  // as a refresh brings back a non-pending status.
  useEffect(() => {
    if (!isPending) return;
    const unsubscribe = onDiaryStamped((dateKey) => {
      if (dateKey === entry.entry_date) router.refresh();
    });
    const interval = setInterval(() => {
      void fetchEntry(entry.entry_date).then((fresh) => {
        if (fresh && fresh.status !== "pending") router.refresh();
      });
    }, 4000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isPending, entry.entry_date, router]);

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
            stampVariant: entry.stamp_variant,
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
    return photoPublicUrl(s.photoPath, s.createdAt);
  }

  // Paragraph history normalized to one shape regardless of whether this
  // entry has real per-paragraph data — a legacy flat entry becomes one
  // "paragraph" covering everything, same fallback ChatEditor/EditEntry
  // already use elsewhere.
  const paragraphs: DiaryParagraph[] = hasParagraphHistory
    ? entry.paragraphs
    : entry.content.trim()
      ? [
          {
            text: entry.content,
            comment: entry.overall_comment ?? "",
            suggestions: entry.suggestions,
            readings: entry.readings,
            translation: "",
            savedAt: entry.reviewed_at ?? entry.updated_at,
            session: 0,
          },
        ]
      : [];

  const wordChips: Reading[] = entry.readings.filter((r) => (r.meaning ?? "").trim());

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
      <header className="flex items-center">
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
      </header>

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
          // The real suggestions/readings/총평/제목 land a few seconds
          // later, in the background, well after this screen already
          // closed (see EditEntry's own header comment) — refresh again
          // to pick that up once it's actually ready, rather than only
          // ever showing whatever was still true the instant "수정 완료"
          // was clicked.
          onBackgroundSaveDone={() => router.refresh()}
        />
      ) : (
        <>
          {/* Every session's own stamp, in a plain wrapping row, then the
              date and title below — replaces the old side-by-side
              thumbnail + fanned pile. A single stamp is just a row of
              one; there's no tap-to-expand any more since nothing is
              ever stacked/hidden to begin with. Each stamp gets a fixed
              width (not an equal `flex-1` share of the row) so a lone
              stamp stays the same modest size as one in a five-stamp
              day, instead of stretching to fill the whole row on its
              own; a day with more stamps than fit on one line just
              wraps. */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {stamps.map((s) => (
                <div key={s.session} className="aspect-[499.78/671.48] w-24 shrink-0">
                  <DiaryStamp
                    stampKind={s.stampKind}
                    stampKey={s.stampKey as never}
                    stampVariant={s.stampVariant}
                    photoUrl={stampPhotoUrl(s)}
                    className="h-full w-full drop-shadow-sm"
                  />
                </div>
              ))}
            </div>
            <div>
              <p className="font-mono text-xs tracking-wide text-[var(--ink-soft)]">
                {formatDateStamp(entry.entry_date)}
              </p>
              {entry.title && (
                <h1 className="mt-1 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--ink)]">
                  {entry.title}
                </h1>
              )}
            </div>
          </div>

          {isPending && (
            <p className="inline-flex w-fit items-center gap-2 rounded-full bg-[var(--paper-line)]/50 px-3 py-1 text-xs text-[var(--ink-soft)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--ink-soft)]" />
              검토 중이에요…
            </p>
          )}
          {isFailed && (
            <p className="text-xs font-medium text-[var(--ink)]">
              첨삭 처리 중 문제가 있었어요. 다시 저장하면 재시도돼요.
            </p>
          )}

          {/* Hidden while still pending — the calendar's own TODAY card
              used to show this same content immediately regardless of
              status (nothing gated it there), while a "이어서 쓰기"
              sitting's just-written text specifically doesn't land in
              `paragraphs` until its own review comes back (see
              ChatEditor's pending save), so this screen could otherwise
              go on showing an *older* sitting's content while the
              newest one silently isn't there yet — same underlying gap,
              opposite symptom. Gating both on "not pending" (reviewed
              *or* failed, not just reviewed — a failed review still has
              real saved text worth seeing) makes them agree: nothing
              shows until this sitting's own review has actually landed,
              on either screen. */}
          {!isPending && paragraphs.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="font-mono text-xs tracking-wide text-[var(--ink-soft)]">일기 내용</p>
              <hr className="border-t border-[var(--paper-line)]" />
              <div className="flex flex-col gap-4">
                {paragraphs.map((p, pi) => (
                  <div key={pi} className="flex flex-col gap-1.5">
                    <p className="whitespace-pre-wrap font-[family-name:var(--font-diary)] text-base leading-loose text-[var(--ink)]">
                      {applyCorrections(p.text, p.suggestions)}
                    </p>
                    {p.translation && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--ink-soft)]">
                        {p.translation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isReviewed && entry.suggestions.length > 0 && (
            <section className="flex flex-col gap-3">
              <p className="font-mono text-xs tracking-wide text-[var(--ink-soft)]">
                고친 곳 {entry.suggestions.length}
              </p>
              <hr className="border-t border-[var(--paper-line)]" />
              <div className="flex flex-col gap-2">
                {entry.suggestions.map((s: Suggestion, i) => (
                  <p key={i} className="font-[family-name:var(--font-diary)] text-base text-[var(--ink)]">
                    <span className="text-[var(--ink-tertiary)] line-through decoration-1">
                      {s.original}
                    </span>{" "}
                    → {s.suggestion}
                  </p>
                ))}
              </div>
            </section>
          )}

          {isReviewed && wordChips.length > 0 && (
            <section className="flex flex-col gap-3">
              <p className="font-mono text-xs tracking-wide text-[var(--ink-soft)]">
                담은 단어 {wordChips.length}
              </p>
              <hr className="border-t border-[var(--paper-line)]" />
              <div className="flex flex-wrap gap-2">
                {wordChips.map((r, i) => (
                  <span
                    key={i}
                    className="rounded-xl border border-[var(--paper-line)] px-4 py-2 font-[family-name:var(--font-diary)] text-sm font-medium text-[var(--ink)]"
                  >
                    {r.text} <span className="text-[var(--ink-soft)]">{r.meaning}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {isReviewed && entry.overall_comment && (
            <section className="flex flex-col gap-3">
              <p className="font-mono text-xs tracking-wide text-[var(--ink-soft)]">오늘의 한마디</p>
              <hr className="border-t border-[var(--paper-line)]" />
              <p className="text-sm leading-relaxed text-[var(--ink)]">{entry.overall_comment}</p>
            </section>
          )}

          {confirmingDelete ? (
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
          ) : (
            <div className="flex items-center justify-end gap-3">
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
            </div>
          )}

          {(isReviewed || isPending || isFailed) && (
            <button
              type="button"
              disabled={continuePending}
              onClick={() =>
                startContinueTransition(() => {
                  router.push(`/entry/${entry.entry_date}?continue=1`);
                })
              }
              className="w-full rounded-xl border border-[var(--paper-line)] py-4 text-center text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--paper-line)]/30 disabled:opacity-60"
            >
              {continuePending ? "불러오는 중…" : isFailed ? "다시 시도" : "이어 쓰기"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
