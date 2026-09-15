"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import UiIcon from "@/components/icons/UiIcon";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import { useToast } from "@/components/toast/ToastProvider";
import { fetchAllEntriesForStamps, photoPublicUrl } from "@/lib/diary/client";
import { collectStamps, type StampCollection, type TimelineStampItem } from "@/lib/stamps/collectStamps";
import { STAMP_LABELS } from "@/lib/stamps/stampLabels";

type Tab = "all" | "photo" | "keyword";

const TAB_LABELS: Record<Tab, string> = { all: "전체", photo: "사진우표", keyword: "수집우표" };

interface MonthGroup {
  key: string;
  year: number;
  month: number;
  items: TimelineStampItem[];
}

/** `items` is already most-recent-first (see collectStamps), so grouping
 * consecutive same-year-month runs is enough — no separate sort needed. */
function groupByMonth(items: TimelineStampItem[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const item of items) {
    const [year, month] = item.entryDate.split("-").map(Number);
    const key = `${year}-${month}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, year, month, items: [item] });
    }
  }
  return groups;
}

/** "09.13" from an "YYYY-MM-DD" entry date. */
function shortDate(entryDate: string): string {
  return entryDate.slice(5).replace("-", ".");
}

/** Every keyword/photo stamp this learner has ever been given, across
 * every entry — read straight from `stamps` (falling back to the legacy
 * top-level columns for an older entry — see collectStamps), so a day
 * with several "이어서 쓰기" sittings contributes one of each to the
 * count, not just its front one. Three tabs: "전체"/"사진우표" are the
 * same day-by-day timeline (one box per stamp, newest month first),
 * "수집우표" instead groups keyword stamps by category (음식/날씨/동물
 * etc. — see KEYWORD_CATEGORIES) since a flat list of every kind wasn't
 * browsable once there were more than a handful. */
export default function StampCollectionView({ userId }: { userId: string }) {
  const push = useToast();
  const [collection, setCollection] = useState<StampCollection | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [openPhoto, setOpenPhoto] = useState<TimelineStampItem | null>(null);

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

  function renderTimeline(items: TimelineStampItem[], emptyText: string) {
    if (items.length === 0) {
      return <p className="text-sm text-[var(--ink-soft)]">{emptyText}</p>;
    }
    return (
      <div className="flex flex-col gap-8">
        {groupByMonth(items).map((group) => (
          <div key={group.key} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-base font-bold text-[var(--ink)]">
                {group.year} · {String(group.month).padStart(2, "0")}
              </span>
              <span className="text-sm text-[var(--ink-soft)]">{group.items.length}장</span>
            </div>
            <hr className="border-t border-[var(--ink)]" />
            <div className="grid grid-cols-4 gap-3">
              {group.items.map((item) => {
                const stampEl = (
                  <DiaryStamp
                    stampKind={item.stampKind}
                    stampKey={item.stampKey as never}
                    stampVariant={item.stampVariant}
                    photoUrl={
                      item.stampKind === "photo" && item.photoPath
                        ? photoPublicUrl(item.photoPath, item.createdAt)
                        : null
                    }
                    className="h-full w-full drop-shadow-sm"
                  />
                );
                return (
                  <div key={`${item.entryDate}-${item.session}`} className="flex flex-col gap-1.5">
                    {item.stampKind === "photo" ? (
                      <button
                        type="button"
                        onClick={() => setOpenPhoto(item)}
                        aria-label="사진 우표 크게 보기"
                        className="aspect-[499.78/671.48] cursor-pointer appearance-none border-0 bg-transparent p-0"
                      >
                        {stampEl}
                      </button>
                    ) : (
                      <div className="aspect-[499.78/671.48]">{stampEl}</div>
                    )}
                    <span className="font-mono text-xs text-[var(--ink-soft)]">
                      {shortDate(item.entryDate)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <Link
        href="/"
        className="flex w-fit items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
          ←
        </UiIcon>
        캘린더
      </Link>

      {collection === null && <p className="text-sm text-[var(--ink-soft)]">불러오는 중…</p>}

      {collection !== null && (
        <>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-[family-name:var(--font-heading)] text-5xl font-bold text-[var(--ink)]">
                {collection.totalCount}
              </p>
              <p className="text-sm text-[var(--ink-soft)]">모은 우표</p>
            </div>
            <div className="text-right font-mono text-sm text-[var(--ink-soft)]">
              <p>
                사진우표 <span className="font-medium text-[var(--ink)]">{collection.photoCount}</span>
              </p>
              <p>
                수집우표 <span className="font-medium text-[var(--ink)]">{collection.keywordCount}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  tab === t
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "border border-[var(--paper-line)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          {tab === "all" &&
            renderTimeline(collection.allStamps, "아직 받은 우표가 없어요. 일기를 쓰면 여기에 쌓여요.")}
          {tab === "photo" &&
            renderTimeline(collection.photoStamps, "아직 사진으로 찍은 우표가 없어요.")}
          {tab === "keyword" &&
            (collection.keywordCategories.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">
                아직 받은 우표가 없어요. 일기를 쓰면 여기에 쌓여요.
              </p>
            ) : (
              <div className="flex flex-col gap-8">
                {collection.keywordCategories.map((group) => (
                  <section key={group.label} className="flex flex-col gap-3">
                    <h2 className="text-sm font-medium text-[var(--ink)]">{group.label}</h2>
                    <hr className="border-t border-[var(--paper-line)]" />
                    <div className="grid grid-cols-4 gap-3">
                      {group.items.map(({ stampKey }) => (
                        <div key={stampKey} className="flex flex-col items-center gap-1.5">
                          <div className="aspect-[499.78/671.48] w-full">
                            <DiaryStamp
                              stampKind="keyword"
                              stampKey={stampKey}
                              className="h-full w-full drop-shadow-sm"
                            />
                          </div>
                          <span className="text-xs font-medium text-[var(--ink)]">
                            {STAMP_LABELS[stampKey]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ))}
        </>
      )}

      {/* Lightbox: just a bigger version of the same stamp in place, no
          navigation to that day's entry — this screen is about the
          stamps themselves, not a shortcut back into any one entry. */}
      {openPhoto && openPhoto.photoPath && (
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
              photoUrl={photoPublicUrl(openPhoto.photoPath, openPhoto.createdAt)}
              className="w-full drop-shadow-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
