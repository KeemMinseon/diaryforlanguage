import Link from "next/link";
import StampedDay from "@/components/stamps/StampedDay";
import { photoPublicUrl } from "@/lib/diary/client";
import type { DiaryEntry } from "@/types/diary";

/** One day of the month's "sheet" grid (see MonthCalendar) — not a
 * weekday-aligned calendar cell, just the Nth square in a plain
 * sequential 1..daysInMonth grid. A filled square (has an entry) shows
 * only the stamp, full-bleed, no date number at all; an empty square
 * shows a bordered box with the date number centered. Today gets an ink
 * outline either way, on top of whichever of those two looks it already
 * has. */
export default function DayCell({
  date,
  dateKey,
  isToday,
  isFuture,
  entry,
  justStamped = false,
}: {
  date: Date;
  dateKey: string;
  isToday: boolean;
  isFuture: boolean;
  entry?: DiaryEntry;
  /** True for the few seconds right after this exact day's entry just
   * got its final reviewed stamp — see lib/events/diaryStamped.ts. */
  justStamped?: boolean;
}) {
  const clickable = Boolean(entry) || !isFuture;
  const photoUrl = entry?.stamp_kind === "photo" ? photoPublicUrl(entry.photo_path) : null;

  const content = (
    <div
      className={`group relative aspect-[4/5] overflow-hidden rounded-xl transition ${
        entry ? "" : "border border-[var(--paper-line)] bg-[var(--paper-raised)]"
      } ${isToday ? "border-[1.5px] border-[var(--ink)]" : ""} ${
        clickable ? "cursor-pointer" : "cursor-default opacity-50"
      }`}
    >
      {entry ? (
        <StampedDay
          entry={entry}
          photoUrl={photoUrl}
          justStamped={justStamped}
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
