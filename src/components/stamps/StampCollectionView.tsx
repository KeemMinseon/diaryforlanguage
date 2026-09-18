"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import UiIcon from "@/components/icons/UiIcon";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import { useToast } from "@/components/toast/ToastProvider";
import { fetchAllEntriesForStamps, photoPublicUrl } from "@/lib/diary/client";
import { onDiaryStamped } from "@/lib/events/diaryStamped";
import { collectStamps, type StampCollection, type TimelineStampItem } from "@/lib/stamps/collectStamps";
import type { StampId } from "@/lib/stamps/keywordMap";
import { STAMP_LABELS } from "@/lib/stamps/stampLabels";
import { formatDateStamp } from "@/lib/utils/date";

type Tab = "all" | "photo" | "keyword";

/** Same box ratio used everywhere else a stamp is shown (calendar cells,
 * entry-detail header, this screen's own grids). */
const STAMP_ASPECT = 499.78 / 671.48;

/** What the focused stamp is currently showing — a specific session's own
 * photo, or just a keyword's representative art (no particular day, so no
 * date to show alongside it). */
type FocusTarget = { kind: "photo"; item: TimelineStampItem } | { kind: "keyword"; stampKey: StampId };

/** How small the pushed-out stamps shrink to, and how much they fade —
 * both just enough to read as "stepped back", not gone. */
const PUSH_SCALE = 0.65;
const PUSH_OPACITY = 0.35;

/** Vertical space between the enlarged stamp and its caption below —
 * used both when sizing the hero (so the two, together, still fit a
 * short screen) and when positioning the caption itself. */
const HERO_CAPTION_GAP = 6;
/** Rough height of the caption block (title line + subtitle line + the
 * small gap between them) — reserved when sizing the hero so a small
 * screen's caption never gets pushed off past the bottom edge. */
const HERO_CAPTION_HEIGHT = 60;
/** Left free above/below the hero+caption block as a whole, even on the
 * shortest screen this has to fit. */
const HERO_VERTICAL_MARGIN = 24;

/** Must match the hero's own transition-duration below — closeLightbox
 * delays actually dropping `focus` until the shrink-back animation (and
 * the other stamps' own return-to-place animation, which shares this same
 * duration) has had time to finish playing. */
const FLIP_DURATION_MS = 320;

type Phase = "enter" | "open" | "closing";

interface FlipGeometry {
  /** The hero's fixed, unchanging on-screen box — always centered,
   * already at its full grown-up size. */
  hero: { left: number; top: number; width: number; height: number };
  /** The transform that, applied to the hero box above, makes it exactly
   * overlap the clicked stamp's own on-screen position/size — the "First"
   * half of FLIP. Removing this transform (down to identity) is the
   * entire grow-and-move-to-center animation; re-applying it on close is
   * the entire shrink-back-into-place animation. */
  flipTransform: string;
}

interface Focus extends FlipGeometry {
  key: string;
  target: FocusTarget;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** One stamp's own identifying key across every place it can be clicked
 * from — stable no matter which section/tab rendered it, since only one
 * tab is ever mounted at a time. */
function photoKey(item: TimelineStampItem): string {
  return `photo:${item.entryDate}:${item.session}`;
}
function keywordKey(stampKey: StampId): string {
  return `keyword:${stampKey}`;
}
/** Both `photoKey`/`keywordKey` above produce a string that's unique on
 * its own terms, but `allStamps` can now mix the two kinds within the
 * same day — a keyword item's `session` is just a placeholder (always 0,
 * see collectStamps), so keying it as if it were a photo could collide
 * with an actual photo taken that same day at session 0. */
function timelineItemKey(item: TimelineStampItem): string {
  return item.stampKind === "photo" ? photoKey(item) : keywordKey(item.stampKey as StampId);
}

const TAB_LABELS: Record<Tab, string> = { all: "전체", photo: "사진우표", keyword: "수집우표" };

interface MonthGroup {
  key: string;
  year: number;
  month: number;
  items: TimelineStampItem[];
}

/** `items` is already most-recent-first (see collectStamps' `photoStamps`
 * and `allStamps`), so grouping consecutive same-year-month runs is
 * enough — no separate sort needed. Just one flat, date-ordered list per
 * month (photo and keyword items interleaved by date) — no day-level
 * sub-grouping or per-item date label; the month header is the only date
 * shown, position in the list is what carries the actual date. */
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
  const [focus, setFocus] = useState<Focus | null>(null);
  const [phase, setPhase] = useState<Phase>("enter");
  // Read by every stamp button during render (see stampButtonStyle), so
  // this has to be real state, not a ref — computed once per open, in the
  // same openLightbox call that sets `focus`.
  const [pushOffsets, setPushOffsets] = useState(new Map<string, [number, number]>());

  // Selected stamp grows in place and moves to center; every other visible
  // one shrinks and scatters outward — a spotlight effect instead of a
  // generic modal, and (since nothing ever covers the full screen) with
  // no OS status bar to keep in sync either.
  //
  // Finding every *other* currently-visible stamp (to push them outward)
  // is a plain DOM query (data-stamp-key, set on every stamp button below)
  // rather than a React ref registry — this only ever runs inside a click
  // handler, but a per-item ref used for this same measurement read inside
  // an onClick sitting right next to that same ref's own `ref` prop trips
  // react-hooks/refs's static check regardless; sidestepping refs
  // entirely for this one read avoids that false positive.
  function openLightbox(key: string, target: FocusTarget, sourceEl: HTMLElement) {
    const source = sourceEl.getBoundingClientRect();
    // window.innerWidth/innerHeight can be stale right after a scroll on
    // a mobile browser — the address bar collapsing/expanding changes how
    // much is actually visible, and innerHeight doesn't always catch up
    // in sync, so centering against it could land the hero well off from
    // the real current center (confirmed: it opened pinned near the top
    // after scrolling down a long list). The Visual Viewport API tracks
    // the real visible area live; offsetLeft/offsetTop cover the (normal,
    // no-zoom) case where they're still just 0.
    const vv = window.visualViewport;
    const vw = vv?.width ?? window.innerWidth;
    const vh = vv?.height ?? window.innerHeight;
    const voffsetLeft = vv?.offsetLeft ?? 0;
    const voffsetTop = vv?.offsetTop ?? 0;

    // Capped by width (as before) *and* by whatever height is actually
    // left once the caption block and some breathing room are accounted
    // for — on a short screen the width cap alone could size a hero
    // (plus its caption underneath) taller than the viewport itself.
    const maxHeightForHero = vh - HERO_VERTICAL_MARGIN * 2 - HERO_CAPTION_GAP - HERO_CAPTION_HEIGHT;
    const heroWidth = Math.min(280, vw * 0.64, Math.max(0, maxHeightForHero) * STAMP_ASPECT);
    const heroHeight = heroWidth / STAMP_ASPECT;
    const heroLeft = voffsetLeft + (vw - heroWidth) / 2;
    // Centers the hero+caption block as a whole, not just the hero on
    // its own — otherwise the pair reads as sitting low, the caption
    // pushing the *visual* center of the group below the screen's own.
    const totalHeight = heroHeight + HERO_CAPTION_GAP + HERO_CAPTION_HEIGHT;
    const heroTop = voffsetTop + (vh - totalHeight) / 2;

    const dx = source.left + source.width / 2 - (heroLeft + heroWidth / 2);
    const dy = source.top + source.height / 2 - (heroTop + heroHeight / 2);
    const scale = source.width / heroWidth;

    // Each stamp used to be pushed independently along its own direction
    // from center — but two stamps that happen to need a similar push
    // (e.g. same column, different rows) could end up landing on top of
    // *each other*, not just peeking out from behind the hero. A single
    // shared scale factor — the same "zoom out from center" ratio applied
    // to every stamp's own (already-different) position — can't do that:
    // it's one affine transform from a common origin, so it only ever
    // preserves relative positions, never crosses two stamps' paths.
    //
    // That guarantee only holds as long as *every* stamp gets the exact
    // same scale — clamping each one individually down to its own
    // section's bounds (an earlier version of this) breaks it: a stamp
    // sitting right at its section's edge gets clamped hard while its
    // neighbor barely moves at all, and those two different amounts of
    // movement can land them right on top of each other (made obvious by
    // both being faded to the same low opacity). So instead: find the
    // single scale every stamp can use at once — the largest any one of
    // them needs to clear the hero, capped down to the smallest any one
    // of them can afford before spilling past its own section — and
    // apply that one number to all of them, no per-stamp exceptions.
    const heroHalfW = heroWidth / 2;
    const heroHalfH = heroHeight / 2;
    const CLEAR_MARGIN = 16;
    const SECTION_MARGIN = 4;
    const BASE_SCALE = 1.35;
    const MAX_SCALE = 6;
    // Same center every other stamp's own push direction is measured
    // from — must match the hero's own centering above.
    const centerX = voffsetLeft + vw / 2;
    const centerY = voffsetTop + vh / 2;

    interface Candidate {
      key: string;
      cx: number;
      cy: number;
    }
    const candidates: Candidate[] = [];
    let heroScale = BASE_SCALE;
    let sectionMaxScale = Infinity;

    document.querySelectorAll<HTMLElement>("[data-stamp-key]").forEach((otherEl) => {
      const otherKey = otherEl.dataset.stampKey!;
      if (otherKey === key) return;
      const r = otherEl.getBoundingClientRect();
      const cx = r.left + r.width / 2 - centerX;
      const cy = r.top + r.height / 2 - centerY;
      const halfW = r.width / 2;
      const halfH = r.height / 2;
      candidates.push({ key: otherKey, cx, cy });

      const mx = cx !== 0 ? (heroHalfW + halfW + CLEAR_MARGIN) / Math.abs(cx) : Infinity;
      const my = cy !== 0 ? (heroHalfH + halfH + CLEAR_MARGIN) / Math.abs(cy) : Infinity;
      heroScale = Math.max(heroScale, Math.min(mx, my, MAX_SCALE));

      const section = otherEl.closest<HTMLElement>("[data-stamp-section]");
      if (!section) return;
      const s = section.getBoundingClientRect();
      const scaledHalfW = halfW * PUSH_SCALE;
      const scaledHalfH = halfH * PUSH_SCALE;
      const maxScaleX =
        cx > 0
          ? (s.right - SECTION_MARGIN - scaledHalfW - centerX) / cx
          : cx < 0
            ? (s.left + SECTION_MARGIN + scaledHalfW - centerX) / cx
            : Infinity;
      const maxScaleY =
        cy > 0
          ? (s.bottom - SECTION_MARGIN - scaledHalfH - centerY) / cy
          : cy < 0
            ? (s.top + SECTION_MARGIN + scaledHalfH - centerY) / cy
            : Infinity;
      sectionMaxScale = Math.min(sectionMaxScale, Math.max(1, maxScaleX), Math.max(1, maxScaleY));
    });

    const pushScale = Math.min(heroScale, sectionMaxScale);
    const offsets = new Map<string, [number, number]>();
    for (const c of candidates) {
      offsets.set(c.key, [(pushScale - 1) * c.cx, (pushScale - 1) * c.cy]);
    }
    setPushOffsets(offsets);

    setFocus({
      key,
      target,
      hero: { left: heroLeft, top: heroTop, width: heroWidth, height: heroHeight },
      flipTransform: `translate(${dx}px, ${dy}px) scale(${scale})`,
    });
    // Reduced motion: skip straight to "open" — there's no separate frame
    // where the hero visibly sits over the source stamp first.
    setPhase(prefersReducedMotion() ? "open" : "enter");
  }

  // The timer id for closeLightbox's safety-net timeout — only ever read
  // inside that function and finishClosing, never during render, so a
  // plain ref (not state) is fine here.
  const closeTimeoutRef = useRef<number | null>(null);
  // The stamp that just got its `focus` cleared — for exactly one frame,
  // so stampButtonStyle can reveal it with no transition (see there). Not
  // read during render *by anything else*, so it doesn't need to be part
  // of the FLIP/push math above, but it does drive this component's own
  // render (must be state, not a ref).
  const [justClosedKey, setJustClosedKey] = useState<string | null>(null);

  function finishClosing() {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setJustClosedKey(focus?.key ?? null);
    setFocus(null);
    setPhase("enter");
  }

  // Clears `justClosedKey` a frame after it's set — one paint with no
  // transition is all the reveal needs; leaving it set any longer would
  // mean this same stamp loses its own push/pop transition the *next*
  // time something else gets focused.
  useEffect(() => {
    if (!justClosedKey) return;
    const id = requestAnimationFrame(() => setJustClosedKey(null));
    return () => cancelAnimationFrame(id);
  }, [justClosedKey]);

  function closeLightbox() {
    if (!focus || phase === "closing") return;
    setPhase("closing");
    if (prefersReducedMotion()) {
      finishClosing();
      return;
    }
    // Safety net only — the real trigger is the hero's own onTransitionEnd
    // below. A fixed timer here drifts from the CSS transition's actual
    // completion (setTimeout has no idea how long the browser really took
    // to finish animating), which showed up as a blank flash right at the
    // end: the hero could disappear a beat before it had visually finished
    // shrinking back, or the original stamp could stay hidden a beat after
    // it had. This only covers the rare case transitionend never fires.
    closeTimeoutRef.current = window.setTimeout(finishClosing, FLIP_DURATION_MS + 150);
  }

  // "enter" paints the hero already sitting exactly over the clicked
  // stamp (flipTransform, no transition); flipping to "open" a couple of
  // frames later removes that transform *with* a transition — the actual
  // grow-and-move-to-center animation. Skipping straight to "open" would
  // paint the hero at its final position on the very first frame, with
  // nothing to visibly animate from.
  useEffect(() => {
    if (!focus || phase !== "enter") return;
    let innerId = 0;
    const outerId = requestAnimationFrame(() => {
      innerId = requestAnimationFrame(() => setPhase("open"));
    });
    return () => {
      cancelAnimationFrame(outerId);
      cancelAnimationFrame(innerId);
    };
  }, [focus, phase]);

  useEffect(() => {
    if (!focus) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Re-subscribing on every `phase` change (not just `focus`) is what
    // keeps closeLightbox's own `phase === "closing"` guard reading the
    // *current* phase — a listener attached once at "enter" and left alone
    // would keep closing over that stale value forever, so a second
    // Escape press mid-close would never see it's already closing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, phase]);

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

  // Without this, a stamp earned elsewhere (write an entry, or add to one
  // via "이어서 쓰기") only shows up here after a genuinely fresh mount —
  // Next's client-side router cache can restore this screen's previous
  // render (this exact component instance, still holding its old
  // `collection` state) on a back/forward navigation without re-running
  // the mount effect above, which read as "I just collected a stamp but
  // it's not in 우표 모음" even though it saved correctly. `notifyDiaryStamped`
  // is a plain `window` event (see its own doc comment) — it reaches this
  // listener regardless of whether this component happens to be the
  // visible route right now, same as MonthCalendar's own subscription. No
  // date-range filter here (unlike MonthCalendar's, scoped to one visible
  // month) since this screen aggregates every date at once.
  useEffect(() => {
    return onDiaryStamped(() => {
      load();
    });
  }, [load]);

  /** Inline style for one stamp button *in the grid* (not the hero) — hidden
   * once it's the focused one (the hero is showing an enlarged copy in its
   * place), pushed outward if something else is focused, or untouched. */
  function stampButtonStyle(key: string): React.CSSProperties {
    const duration = prefersReducedMotion() ? 0 : FLIP_DURATION_MS;
    if (focus?.key === key) {
      // No transition here on purpose: the hero exactly overlaps this
      // button the instant it mounts, so this one has to disappear in
      // that same instant too (and only reappear the instant `focus`
      // clears, once the hero's own shrink-back has actually finished) —
      // a fade either way would show both at once, reading as two
      // separate objects instead of one continuous stamp.
      return { opacity: 0 };
    }
    if (justClosedKey === key) {
      // The one frame right after `focus` clears: the hero has already
      // vanished outright (no fade of its own), so this has to reappear
      // in that same instant too — the transition below, if applied on
      // this exact frame, would fade opacity 0→1 over `duration` while
      // nothing else does, which read as the page's own background
      // bleeding through a half-transparent stamp for a moment.
      return { opacity: 1 };
    }
    const active = focus !== null && phase !== "closing";
    const offset = active ? pushOffsets.get(key) : undefined;
    return {
      transform: offset ? `translate(${offset[0]}px, ${offset[1]}px) scale(${PUSH_SCALE})` : undefined,
      opacity: offset ? PUSH_OPACITY : 1,
      transition: `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1), opacity ${duration}ms ease`,
    };
  }

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
            <div data-stamp-section className="grid grid-cols-4 gap-3">
              {group.items.map((item) => {
                const key = timelineItemKey(item);
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
                return item.stampKind === "photo" ? (
                  // A photo stamp's own scalloped frame (see StampFrame)
                  // fills its box edge to edge with no built-in margin,
                  // unlike the prepared keyword artwork (see
                  // KeywordIcon), which already has some breathing room
                  // baked into the image itself — at the same box size
                  // the photo one reads as noticeably bigger. Scaled down
                  // to 85% and centered in the same box instead of
                  // shrinking the box.
                  <button
                    key={key}
                    data-stamp-key={key}
                    type="button"
                    onClick={(e) => {
                      // While something's already focused, any click out
                      // here — this stamp included — just closes it (see
                      // the container's own onClick below); it doesn't
                      // jump straight to a different stamp.
                      if (focus) return;
                      // The hero shows the photo at full size (no 85%
                      // inset), so the FLIP source rect has to be the
                      // *inner* div actually holding the visible image,
                      // not this button's own full box — otherwise the
                      // hero starts ~15% too big/off-center relative to
                      // what was really on screen, popping visibly at the
                      // very first frame.
                      openLightbox(key, { kind: "photo", item }, e.currentTarget.firstElementChild as HTMLElement);
                    }}
                    style={stampButtonStyle(key)}
                    aria-label="사진 우표 크게 보기"
                    className="aspect-[499.78/671.48] flex cursor-pointer appearance-none items-center justify-center border-0 bg-transparent p-0"
                  >
                    <div className="h-[85%] w-[85%]">{stampEl}</div>
                  </button>
                ) : (
                  <button
                    key={key}
                    data-stamp-key={key}
                    type="button"
                    onClick={(e) => {
                      if (focus) return;
                      if (item.stampKey) openLightbox(key, { kind: "keyword", stampKey: item.stampKey }, e.currentTarget);
                    }}
                    style={stampButtonStyle(key)}
                    aria-label="우표 크게 보기"
                    className="aspect-[499.78/671.48] cursor-pointer appearance-none border-0 bg-transparent p-0"
                  >
                    {stampEl}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // The name + one line of context shown under a stamp once it's
  // enlarged (see the hero section below) — not shown in the grid
  // itself any more, only here. A keyword gets its own name, category,
  // and how many times it's been received; a photo (always a different
  // picture, no "kind" of its own to name) just gets the date it was
  // recorded and that it's a photo stamp.
  let heroCaption: { title: string; subtitle: string } | null = null;
  if (focus?.target.kind === "photo") {
    heroCaption = { title: formatDateStamp(focus.target.item.entryDate), subtitle: "사진우표" };
  } else if (collection && focus?.target.kind === "keyword") {
    const stampKey = focus.target.stampKey;
    for (const group of collection.keywordCategories) {
      const item = group.items.find((i) => i.stampKey === stampKey);
      if (item) {
        heroCaption = {
          title: STAMP_LABELS[stampKey],
          subtitle: `수집우표 · ${group.label} · ${item.count}번 받음`,
        };
        break;
      }
    }
  }

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6"
      // Anything outside the enlarged stamp is effectively a transparent
      // dim — clicking it (empty space, or any other stamp, which the
      // `if (focus) return;` guard on each stamp button's own onClick
      // leaves unhandled) just closes. Only the hero itself is excluded,
      // via its own stopPropagation.
      onClick={() => {
        if (focus) closeLightbox();
      }}
    >
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
                className={`px-4 py-2 text-sm font-medium transition ${
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
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-bold text-[var(--ink)]">{group.label}</span>
                      <span className="text-sm text-[var(--ink-soft)]">
                        {group.items.reduce((sum, item) => sum + item.count, 0)}장
                      </span>
                    </div>
                    <hr className="border-t border-[var(--ink)]" />
                    <div data-stamp-section className="grid grid-cols-4 gap-3">
                      {group.items.map(({ stampKey }) => {
                        const key = keywordKey(stampKey);
                        return (
                          <button
                            key={stampKey}
                            data-stamp-key={key}
                            type="button"
                            onClick={(e) => {
                              if (focus) return;
                              openLightbox(key, { kind: "keyword", stampKey }, e.currentTarget);
                            }}
                            style={stampButtonStyle(key)}
                            aria-label="우표 크게 보기"
                            className="aspect-[499.78/671.48] cursor-pointer appearance-none border-0 bg-transparent p-0"
                          >
                            <DiaryStamp
                              stampKind="keyword"
                              stampKey={stampKey}
                              className="h-full w-full drop-shadow-sm"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ))}
        </>
      )}

      {/* The focused stamp itself — no full-screen backdrop at all (the
          radial push on every other stamp already does the work of
          drawing focus, and skipping a backdrop means there's no OS
          status bar color to keep in sync with anything). Starts each
          open already sitting exactly over the clicked stamp
          (flipTransform, "enter" phase, no transition), then "open" drops
          that transform with a transition — the grow-to-center animation.
          Closing just plays the same transform back on, then unmounts.

          Portaled straight to `document.body` rather than rendered inline
          here — `left`/`top` are computed to center this fixed-position
          element in the real viewport (see openLightbox), but PageTransition
          (an ancestor of every page, including this one) applies a CSS
          animation with `animation-fill-mode: both`, which leaves a
          non-`none` `transform` sitting on that wrapper indefinitely after
          it finishes. Per spec, any ancestor with a `transform` set becomes
          the containing block for a `position: fixed` descendant instead of
          the viewport — so without the portal, this hero was actually
          positioned relative to that wrapper's full (scrollable, page-length)
          box, not the visible viewport, landing it up near the top of the
          page instead of centered on screen once the page had been scrolled
          down any amount. Rendering directly under <body> — which has no
          such transform — sidesteps that regardless of what any ancestor
          does. */}
      {focus &&
        createPortal(
          <>
            <div
              className="fixed z-50 drop-shadow-xl"
              onClick={(e) => e.stopPropagation()}
              // The real "closing is done" signal — see closeLightbox's own
              // comment on why a timer alone isn't enough.
              onTransitionEnd={(e) => {
                if (e.propertyName === "transform" && phase === "closing") finishClosing();
              }}
              style={{
                left: focus.hero.left,
                top: focus.hero.top,
                width: focus.hero.width,
                height: focus.hero.height,
                transform: phase === "open" ? "translate(0, 0) scale(1)" : focus.flipTransform,
                transition: `transform ${prefersReducedMotion() ? 0 : FLIP_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
              }}
            >
              {focus.target.kind === "photo" ? (
                <DiaryStamp
                  stampKind="photo"
                  stampKey={null}
                  photoUrl={photoPublicUrl(focus.target.item.photoPath!, focus.target.item.createdAt)}
                  className="h-full w-full"
                />
              ) : (
                <DiaryStamp stampKind="keyword" stampKey={focus.target.stampKey} className="h-full w-full" />
              )}
            </div>
            {heroCaption && (
              <div
                className="fixed z-50 flex flex-col items-center gap-1 px-4 text-center"
                onClick={(e) => e.stopPropagation()}
                style={{
                  left: focus.hero.left,
                  top: focus.hero.top + focus.hero.height + HERO_CAPTION_GAP,
                  width: focus.hero.width,
                  // Only once the hero's actually finished growing — fading
                  // in any earlier would have it competing with the grow
                  // animation right next to it.
                  opacity: phase === "open" ? 1 : 0,
                  transition: `opacity ${prefersReducedMotion() ? 0 : 180}ms ease`,
                }}
              >
                <p className="text-xl font-bold text-[var(--ink)]">{heroCaption.title}</p>
                <p className="text-sm text-[var(--ink-soft)]">{heroCaption.subtitle}</p>
              </div>
            )}
          </>,
          document.body
        )}
    </div>
  );
}
