"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import UiIcon from "@/components/icons/UiIcon";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import { useToast } from "@/components/toast/ToastProvider";
import { fetchAllEntriesForStamps, photoPublicUrl } from "@/lib/diary/client";
import { collectStamps, type PhotoStampItem, type StampCollection } from "@/lib/stamps/collectStamps";
import { STAMP_LABELS } from "@/lib/stamps/stampLabels";

/** Every keyword/photo stamp this learner has ever been given, across
 * every entry — a ranking board of the most-picked keyword stamps, and a
 * gallery of every photo stamp attached along the way. Both read straight
 * from `stamps` (falling back to the legacy top-level columns for an
 * older entry — see collectStamps), so a day with several "이어서 쓰기"
 * sittings contributes one of each to the count, not just its front one. */
export default function StampCollectionView({ userId }: { userId: string }) {
  const push = useToast();
  const [collection, setCollection] = useState<StampCollection | null>(null);
  const [openPhoto, setOpenPhoto] = useState<PhotoStampItem | null>(null);

  const load = useCallback(async () => {
    try {
      const entries = await fetchAllEntriesForStamps(userId);
      setCollection(collectStamps(entries));
    } catch (err) {
      console.error(err);
      push("우표 모음을 불러오지 못했어요.");
    }
  }, [userId, push]);

  useEffect(() => {
    // Same fetch-on-mount pattern as WordListView/MonthCalendar's `load`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!openPhoto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPhoto(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPhoto]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
            ←
          </UiIcon>
          캘린더
        </Link>
        <h1 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--ink)]">
          우표 모음
        </h1>
        <span className="w-[52px]" aria-hidden="true" />
      </header>

      {collection === null && <p className="text-sm text-[var(--ink-soft)]">불러오는 중…</p>}

      {collection !== null && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-[var(--ink)]">가장 많이 받은 우표</h2>
            {collection.keywordCounts.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">
                아직 받은 우표가 없어요. 일기를 쓰면 여기에 쌓여요.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
                {collection.keywordCounts.map(({ stampKey, count }) => (
                  <div key={stampKey} className="flex flex-col items-center gap-1.5">
                    <DiaryStamp
                      stampKind="keyword"
                      stampKey={stampKey}
                      className="w-full drop-shadow-sm"
                    />
                    <span className="text-xs font-medium text-[var(--ink)]">
                      {STAMP_LABELS[stampKey]}
                    </span>
                    <span className="text-[11px] text-[var(--ink-soft)]">{count}번</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-[var(--ink)]">사진 우표</h2>
            {collection.photoStamps.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">
                아직 사진으로 찍은 우표가 없어요.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {collection.photoStamps.map((p) => (
                  <button
                    key={`${p.entryDate}-${p.session}`}
                    type="button"
                    onClick={() => setOpenPhoto(p)}
                    aria-label="사진 우표 크게 보기"
                    className="cursor-pointer appearance-none border-0 bg-transparent p-0"
                  >
                    <DiaryStamp
                      stampKind="photo"
                      stampKey={null}
                      photoUrl={photoPublicUrl(p.photoPath)}
                      className="w-full drop-shadow-sm"
                    />
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Lightbox: just a bigger version of the same stamp in place, no
          navigation to that day's entry — this screen is about the
          stamps themselves, not a shortcut back into any one entry. */}
      {openPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-10"
          onClick={() => setOpenPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setOpenPhoto(null)}
            aria-label="닫기"
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <UiIcon name="close-line" className="h-4 w-4" alt="">
              ✕
            </UiIcon>
          </button>
          <div className="w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <DiaryStamp
              stampKind="photo"
              stampKey={null}
              photoUrl={photoPublicUrl(openPhoto.photoPath)}
              className="w-full drop-shadow-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
