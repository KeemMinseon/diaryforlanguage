import Link from "next/link";
import DiaryStamp from "@/components/stamps/DiaryStamp";
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
        entry.stamp_kind === "photo" && photoUrl ? (
          // A photo stamp keeps the scalloped StampFrame mask everywhere
          // *else* (ReviewView, 우표 모아보기, EditEntry) — but not here.
          // Five straight attempts at this cell's small photo margin (four
          // ways of sizing StampFrame's SVG inside a wrapper div, then a
          // plain `<img>` inside that same wrapper div) all looked correct
          // on Chrome/Android but kept clipping the same way on iOS
          // Safari's small mobile viewport specifically (confirmed fine on
          // desktop Safari) — with the *img* version, the clipped edge
          // wasn't even rounded any more, meaning the clip was happening on
          // the wrapper `<div>`'s own square edge, one level further out
          // than the rounded corner. That points at the one thing common
          // to every attempt so far and different from the working
          // keyword-stamp branch below: a wrapper div nesting its own
          // `overflow-hidden` inside this cell's `overflow-hidden` already.
          //
          // This drops that wrapper entirely — top/left position it,
          // explicit height/width size it (no `inset`, no `bottom`/`right`,
          // nothing for any browser to solve for), directly on the `<img>`
          // itself, exactly one level deep, exactly like the keyword
          // branch already does successfully on the same device.
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, dimensions unknown ahead of time
          <img
            src={photoUrl}
            alt=""
            className="absolute top-[8%] left-[8%] h-[84%] w-[84%] rounded-lg object-cover"
          />
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
