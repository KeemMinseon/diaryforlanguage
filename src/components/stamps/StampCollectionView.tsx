"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import UiIcon from "@/components/icons/UiIcon";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import { useToast } from "@/components/toast/ToastProvider";
import { fetchAllEntriesForStamps, photoPublicUrl } from "@/lib/diary/client";
import { collectStamps, type StampCollection, type TimelineStampItem } from "@/lib/stamps/collectStamps";
import type { StampId } from "@/lib/stamps/keywordMap";
import { STAMP_LABELS } from "@/lib/stamps/stampLabels";
import { setStatusBarDimmed } from "@/lib/theme/statusBar";

type Tab = "all" | "photo" | "keyword";

/** What the lightbox is currently showing — a specific session's own
 * photo, or just a keyword's representative art (no particular day, so
 * no date to show alongside it). */
type OpenStamp = { kind: "photo"; item: TimelineStampItem } | { kind: "keyword"; stampKey: StampId };

/** Must match lightbox-*-out's own animation-duration in globals.css —
 * closing waits this long before actually unmounting, so the exit
 * animation gets to finish playing instead of the content just vanishing
 * mid-transition. */
const LIGHTBOX_CLOSE_MS = 160;

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
 * count, not just its front one. Three tabs: "사진우표" is a day-by-day
 * timeline (one box per photo, newest month first, dated); "수집우표"
 * groups keyword stamps by category (음식/날씨/동물 etc. — see
 * KEYWORD_CATEGORIES); "전체" is both at once — that same photo timeline
 * on top, then a flat, dateless gallery of every distinct keyword
 * collected below it (one of each kind, not one per occurrence — a
 * keyword's own stamp art never changes, so repeating it added nothing a
 * photo's timeline's repetition of an always-different picture does). */
export default function StampCollectionView({ userId }: { userId: string }) {
  const push = useToast();
  const [collection, setCollection] = useState<StampCollection | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [openStamp, setOpenStamp] = useState<OpenStamp | null>(null);
  const [closing, setClosing] = useState(false);

  // The OS status bar sits above the webview entirely — the lightbox's own
  // `fixed inset-0` backdrop can never dim it, so it's tinted separately
  // here (see statusBar.ts) in step with the same open/close timing.
  function openLightbox(stamp: OpenStamp) {
    setOpenStamp(stamp);
    setStatusBarDimmed(true);
  }

  function closeLightbox() {
    if (closing) return;
    setClosing(true);
    setStatusBarDimmed(false);
    setTimeout(() => {
      setOpenStamp(null);
      setClosing(false);
    }, LIGHTBOX_CLOSE_MS);
  }

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
    if (!openStamp) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeLightbox reads `closing` fresh via its own closure each call; re-subscribing on every `closing` toggle would just churn the listener for no behavioral difference.
  }, [openStamp]);

  function renderTimeline(items: TimelineStampItem[], emptyText: string) {
    if (items.length === 0) {
      return <p className="text-sm text-[var(--ink-soft)]">{emptyText}</p>;
    }
    return (
      <div className="flex flex-col gap-8">
        {groupByMonth(items).map((group) => (
          <div key={group.key} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
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
                      // A photo stamp's own scalloped frame (see StampFrame)
                      // fills its box edge to edge with no built-in margin,
                      // unlike the prepared keyword artwork (see
                      // KeywordIcon), which already has some breathing room
                      // baked into the image itself — at the same box size
                      // the photo one reads as noticeably bigger. Scaled
                      // down to 85% and centered in the same box (so the
                      // grid cell itself, and the date label under it,
                      // stay the same size as a keyword stamp's) instead
                      // of shrinking the box.
                      <button
                        type="button"
                        onClick={() => openLightbox({ kind: "photo", item })}
                        aria-label="사진 우표 크게 보기"
                        className="aspect-[499.78/671.48] flex cursor-pointer appearance-none items-center justify-center border-0 bg-transparent p-0"
                      >
                        <div className="h-[85%] w-[85%]">{stampEl}</div>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          item.stampKey && openLightbox({ kind: "keyword", stampKey: item.stampKey })
                        }
                        aria-label="우표 크게 보기"
                        className="aspect-[499.78/671.48] cursor-pointer appearance-none border-0 bg-transparent p-0"
                      >
                        {stampEl}
                      </button>
                    )}
                    <span className="text-xs text-[var(--ink-soft)]">
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
            <div className="text-right text-sm text-[var(--ink-soft)]">
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

          {tab === "all" && (
            <>
              {collection.photoStamps.length === 0 && collection.distinctKeywordStamps.length === 0 ? (
                <p className="text-sm text-[var(--ink-soft)]">
                  아직 받은 우표가 없어요. 일기를 쓰면 여기에 쌓여요.
                </p>
              ) : (
                <>
                  {collection.photoStamps.length > 0 && renderTimeline(collection.photoStamps, "")}
                  {/* Flat, dateless gallery — unlike a photo (always a
                      different picture), the same keyword's stamp art is
                      identical every time it's picked, so listing one row
                      per occurrence (the same icon repeated) added nothing
                      a single copy doesn't already show. One of each kind
                      instead, most-recently-collected-first. */}
                  {collection.distinctKeywordStamps.length > 0 && (
                    <div className="grid grid-cols-4 gap-3">
                      {collection.distinctKeywordStamps.map((stampKey) => (
                        <button
                          key={stampKey}
                          type="button"
                          onClick={() => openLightbox({ kind: "keyword", stampKey })}
                          aria-label="우표 크게 보기"
                          className="aspect-[499.78/671.48] cursor-pointer appearance-none border-0 bg-transparent p-0"
                        >
                          <DiaryStamp
                            stampKind="keyword"
                            stampKey={stampKey}
                            className="h-full w-full drop-shadow-sm"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
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
                          <button
                            type="button"
                            onClick={() => openLightbox({ kind: "keyword", stampKey })}
                            aria-label="우표 크게 보기"
                            className="aspect-[499.78/671.48] w-full cursor-pointer appearance-none border-0 bg-transparent p-0"
                          >
                            <DiaryStamp
                              stampKind="keyword"
                              stampKey={stampKey}
                              className="h-full w-full drop-shadow-sm"
                            />
                          </button>
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
          stamps themselves, not a shortcut back into any one entry. Both
          the backdrop and the stamp itself get a real enter *and* exit
          animation (see globals.css) — `closing` switches to the "-out"
          class immediately, and closeLightbox delays the actual unmount
          (LIGHTBOX_CLOSE_MS) until that animation's had time to play,
          instead of the whole thing just vanishing mid-transition. */}
      {openStamp && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-10 ${
            closing ? "lightbox-backdrop-out" : "lightbox-backdrop-in"
          }`}
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="닫기"
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <UiIcon name="close-line" className="h-4 w-4" alt="">
              ✕
            </UiIcon>
          </button>
          <div
            className={`w-full max-w-xs aspect-[499.78/671.48] ${closing ? "lightbox-stamp-out" : "lightbox-stamp-in"}`}
            onClick={(e) => e.stopPropagation()}
          >
            {openStamp.kind === "photo" ? (
              <DiaryStamp
                stampKind="photo"
                stampKey={null}
                photoUrl={photoPublicUrl(openStamp.item.photoPath!, openStamp.item.createdAt)}
                className="w-full drop-shadow-xl"
              />
            ) : (
              <DiaryStamp
                stampKind="keyword"
                stampKey={openStamp.stampKey}
                className="w-full drop-shadow-xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
