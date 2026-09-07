import Link from "next/link";
import StampedDay from "@/components/stamps/StampedDay";
import { photoPublicUrl } from "@/lib/diary/client";
import type { DiaryEntry } from "@/types/diary";

export default function DayCell({
  date,
  dateKey,
  inCurrentMonth,
  isToday,
  isFuture,
  entry,
}: {
  date: Date;
  dateKey: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  entry?: DiaryEntry;
}) {
  const clickable = Boolean(entry) || !isFuture;
  const photoUrl = entry?.stamp_kind === "photo" ? photoPublicUrl(entry.photo_path) : null;

  const content = (
    <div
      className={`group relative flex aspect-square flex-col overflow-visible rounded-xl border p-1.5 transition ${
        isToday ? "border-[1.5px] border-[var(--ink)]" : "border-[var(--paper-line)]"
      } ${inCurrentMonth ? "bg-[var(--paper-raised)]" : "bg-transparent opacity-40"} ${
        clickable ? "cursor-pointer hover:border-[var(--ink-soft)]" : "cursor-default opacity-50"
      }`}
    >
      {entry ? (
        // With a stamp to show, the date number rides on top of it as a
        // small corner badge instead of taking its own reserved strip —
        // now that cells are square (not the old 1:2 rectangle) that
        // strip ate a much bigger share of the cell, leaving the stamp
        // itself looking tiny.
        <>
          <div className="absolute inset-1 flex items-center justify-center">
            <StampedDay entry={entry} photoUrl={photoUrl} className="h-full max-w-full" />
          </div>
          <span
            className={`absolute left-1 top-1 z-10 rounded bg-black/40 px-1 text-[9px] leading-tight text-white ${
              isToday ? "font-bold" : ""
            }`}
          >
            {date.getDate()}
          </span>
        </>
      ) : (
        <span
          className={`z-10 text-[11px] leading-none ${
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
