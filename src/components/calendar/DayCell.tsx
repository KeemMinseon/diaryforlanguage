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
 * already has. */
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
  const photoUrl = entry?.stamp_kind === "photo" ? photoPublicUrl(entry.photo_path) : null;

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
      className={`group relative aspect-[4/5] overflow-hidden rounded-xl transition ${border} ${
        clickable ? "cursor-pointer" : "cursor-default opacity-50"
      }`}
    >
      {entry ? (
        <DiaryStamp
          stampKind={entry.stamp_kind}
          stampKey={entry.stamp_key as never}
          stampVariant={entry.stamp_variant}
          photoUrl={photoUrl}
          className="absolute inset-0 h-full w-full"
        />
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
