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
          // Back to the scalloped StampFrame mask (a plain rounded `<img>`
          // stood in for a while — see git history on this branch for that
          // whole detour). What actually broke this on iOS Safari's small
          // mobile viewport (confirmed fine on desktop Safari, and on
          // Chrome/Android throughout) turned out to be a wrapper `<div>`
          // giving this margin its own `overflow-hidden`, nested inside
          // the cell's own — every earlier attempt at sizing the SVG
          // itself was tried *inside* that doubled-up wrapper, so none of
          // them ruled out the SVG's own sizing as a *second*, independent
          // problem. This drops the wrapper the same way the `<img>` fix
          // did — top/left position it, explicit height/width size it, no
          // `inset`/`bottom`/`right` for any browser to solve for — placed
          // directly on the SVG itself, one level deep, same as the
          // keyword branch below and the working `<img>` version before
          // it. If the mask still doesn't render right on that same
          // device, that confirms the SVG sizing was its own separate
          // issue after all.
          <DiaryStamp
            stampKind={entry.stamp_kind}
            stampKey={entry.stamp_key as never}
            stampVariant={entry.stamp_variant}
            photoUrl={photoUrl}
            pending={entry.status === "pending"}
            className="absolute top-[8%] left-[8%] h-[84%] w-[84%]"
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
            pending={entry.status === "pending"}
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
