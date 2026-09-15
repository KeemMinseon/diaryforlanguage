import Link from "next/link";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import { STAMP_MASK_HEIGHT, STAMP_MASK_WIDTH } from "@/components/stamps/stampMask";
import { photoPublicUrl } from "@/lib/diary/client";
import type { DiaryEntry } from "@/types/diary";

/** The cell itself is `aspect-[4/5]` (see below) — kept as a plain
 * number here too so the photo-stamp margin math can reference it
 * without re-deriving it from a Tailwind class string. */
const CELL_ASPECT = 4 / 5;

/** Vertical (top/bottom) margin fraction for a photo stamp's small
 * "glued onto the cell" gap — see the photo-stamp branch below. Picked
 * directly (was "8%" before); the matching horizontal margin is derived
 * from it, not picked separately, so the resulting box's aspect ratio is
 * always exactly the mask's own regardless of what either aspect ratio
 * happens to be. */
const PHOTO_STAMP_VERTICAL_MARGIN = 0.08;

const MASK_ASPECT = STAMP_MASK_WIDTH / STAMP_MASK_HEIGHT;

/** Horizontal margin fraction that makes the resulting inset box's own
 * aspect ratio come out to exactly `MASK_ASPECT`, given the cell's own
 * aspect ratio and the chosen vertical margin — see the derivation: with
 * vertical margin `my`, the box height is `cellHeight * (1 - 2*my)`; for
 * the box width (`cellWidth * (1 - 2*mx)`) to equal `boxHeight *
 * MASK_ASPECT`, given `cellWidth = cellHeight * CELL_ASPECT`, solving for
 * `mx` gives this. Plain top/bottom/left/right percentages computed this
 * way (as opposed to `aspect-ratio` + flex centering, or the svg's own
 * viewBox-inferred intrinsic size) is the one approach here that doesn't
 * depend on any browser inferring anything — every value is an explicit
 * number, which is what finally made this render identically on iOS
 * Safari after two earlier attempts (viewBox-inferred auto-sizing, then
 * an `aspect-ratio` div) still looked right on Chrome/Android but not on
 * Safari. */
const PHOTO_STAMP_HORIZONTAL_MARGIN =
  0.5 * (1 - (1 - 2 * PHOTO_STAMP_VERTICAL_MARGIN) * (MASK_ASPECT / CELL_ASPECT));

/** One day of the month's "sheet" grid (see MonthCalendar) — not a
 * weekday-aligned calendar cell, just the Nth square in a plain
 * sequential 1..daysInMonth grid. A filled square (has an entry) shows
 * only the stamp, full-bleed, no date number at all — no 添削-complete
 * hanko overlay here either, that's ReviewView's job (this is meant to
 * read as a clean grid of stamps, not a mini review screen). An empty
 * square shows a bordered box with the date number centered. Today gets
 * an ink outline either way, on top of whichever of those two looks it
 * already has. Every cell (filled or not) is a plain link straight to
 * /entry/[date] — the bottom card (see MonthCalendar) is its own
 * separate always-today preview, not something tapping a cell changes. */
export default function DayCell({
  date,
  dateKey,
  isToday,
  isFuture,
  entry,
}: {
  date: Date;
  dateKey: string;
  isToday: boolean;
  isFuture: boolean;
  entry?: DiaryEntry;
}) {
  const clickable = Boolean(entry) || !isFuture;
  const photoUrl =
    entry?.stamp_kind === "photo" ? photoPublicUrl(entry.photo_path, entry.updated_at) : null;

  // Exactly one border-color utility per case, not two stacked ones —
  // border-[var(--paper-line)] and border-[var(--ink)] both set the same
  // CSS property, so applying both at once (e.g. the old "always
  // paper-line, plus ink when today" pairing) left which one actually
  // wins up to Tailwind's generated stylesheet order rather than
  // anything in this file. An empty today cell explicitly gets the same
  // --ink color as its own date-number text, not just whichever border
  // class happened to be declared last.
  const border = entry
    ? isToday
      ? "border-[1.5px] border-[var(--ink)]"
      : ""
    : `border bg-[var(--paper-raised)] ${isToday ? "border-[1.5px] border-[var(--ink)]" : "border-[var(--paper-line)]"}`;

  const content = (
    <div
      className={`group relative aspect-[4/5] overflow-hidden transition ${border} ${
        clickable ? "cursor-pointer" : "cursor-default opacity-50"
      }`}
    >
      {entry ? (
        entry.stamp_kind === "photo" ? (
          // A photo stamp still wears the scalloped StampFrame mask (see
          // DiaryStamp) — full-bleed made it read as coextensive with the
          // cell itself rather than a stamp glued onto it, so it gets a
          // small margin instead.
          //
          // This box's four inset percentages (top/bottom fixed at
          // PHOTO_STAMP_VERTICAL_MARGIN, left/right derived from it) are
          // the *only* numbers involved — no flex centering, no CSS
          // `aspect-ratio`, and no relying on the svg's own viewBox to
          // imply a width from `height: 100%`. Two earlier versions of
          // this fix (in order: `inset-[8%]` directly on the svg; then
          // `h-full w-auto` in a centered flex box; then an `aspect-ratio`
          // div around a `w-full h-full` svg) each looked correct on
          // Chrome/Android but still clipped a hair on iOS Safari —
          // apparently different browsers resolve "the other axis, from
          // an implied ratio" differently once flex and/or `aspect-ratio`
          // are involved. Precomputing plain top/bottom/left/right
          // percentages ahead of time removes every one of those implied
          // calculations — the svg is just told its literal box, in the
          // one way that's never been ambiguous in any browser.
          <div
            className="absolute overflow-hidden"
            style={{
              top: `${PHOTO_STAMP_VERTICAL_MARGIN * 100}%`,
              bottom: `${PHOTO_STAMP_VERTICAL_MARGIN * 100}%`,
              left: `${PHOTO_STAMP_HORIZONTAL_MARGIN * 100}%`,
              right: `${PHOTO_STAMP_HORIZONTAL_MARGIN * 100}%`,
            }}
          >
            <DiaryStamp
              stampKind={entry.stamp_kind}
              stampKey={entry.stamp_key as never}
              stampVariant={entry.stamp_variant}
              photoUrl={photoUrl}
              className="h-full w-full"
            />
          </div>
        ) : (
          // A keyword stamp is just its own flat image with no mask/
          // border of its own, so it still fills the cell edge to edge —
          // explicit inset-0 + h-full + w-full leaves nothing "auto" to
          // fall back on, so the over-constrained case above doesn't
          // apply here.
          <DiaryStamp
            stampKind={entry.stamp_kind}
            stampKey={entry.stamp_key as never}
            stampVariant={entry.stamp_variant}
            photoUrl={photoUrl}
            className="absolute inset-0 h-full w-full"
          />
        )
      ) : (
        <span
          className={`absolute inset-0 flex items-center justify-center text-sm ${
            isToday ? "font-bold text-[var(--ink)]" : "text-[var(--ink-soft)]"
          }`}
        >
          {date.getDate()}
        </span>
      )}
    </div>
  );

  if (!clickable) return content;

  return <Link href={`/entry/${dateKey}`}>{content}</Link>;
}
