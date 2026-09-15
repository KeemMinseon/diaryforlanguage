import Link from "next/link";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import { STAMP_MASK_HEIGHT, STAMP_MASK_WIDTH } from "@/components/stamps/stampMask";
import { photoPublicUrl } from "@/lib/diary/client";
import type { DiaryEntry } from "@/types/diary";

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
          // small margin instead. That margin needs its own centering
          // wrapper rather than putting `inset-[8%]` directly on the
          // StampFrame <svg> (an absolutely positioned element with all
          // four inset sides set but no explicit width/height falls back
          // to its own intrinsic size, which anchors it to one corner
          // instead of centering it in the box).
          //
          // The inner box below carries the mask's own aspect ratio as an
          // explicit CSS `aspect-ratio` (computed from STAMP_MASK_WIDTH/
          // HEIGHT, so it can never drift out of sync with the mask
          // itself), sized to the available height and centered by the
          // outer flex wrapper — deliberately *not* relying on the svg's
          // own viewBox-derived intrinsic ratio for its sizing (`h-full
          // w-auto` on the svg directly, an earlier version of this fix):
          // that depends on browsers correctly inferring an aspect ratio
          // from an SVG's `viewBox` for CSS auto-sizing, which is exactly
          // where this still broke on iOS Safari (worked fine on Chrome/
          // Android) — a real, known WebKit inconsistency, not just
          // sub-pixel rounding. The svg inside this box gets plain,
          // unambiguous `w-full h-full` — no browser-dependent intrinsic-
          // ratio inference left anywhere in this path.
          <div className="absolute inset-[8%] flex items-center justify-center overflow-hidden">
            <div
              className="h-full max-w-full overflow-hidden"
              style={{ aspectRatio: `${STAMP_MASK_WIDTH} / ${STAMP_MASK_HEIGHT}` }}
            >
              <DiaryStamp
                stampKind={entry.stamp_kind}
                stampKey={entry.stamp_key as never}
                stampVariant={entry.stamp_variant}
                photoUrl={photoUrl}
                className="h-full w-full"
              />
            </div>
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
