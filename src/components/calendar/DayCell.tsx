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
      className={`group relative flex aspect-[1/1.3] flex-col overflow-visible rounded-xl p-1.5 transition ${
        isToday ? "border-[1.5px] border-[var(--ink)]" : "hover:border hover:border-[var(--paper-line)]"
      } ${inCurrentMonth ? "card-elevated bg-[var(--paper-raised)]" : "bg-transparent opacity-40"} ${
        clickable ? "cursor-pointer" : "cursor-default opacity-50"
      }`}
    >
      <span
        className={`z-10 text-[11px] leading-none ${
          isToday ? "font-bold text-[var(--ink)]" : "text-[var(--ink-soft)]"
        }`}
      >
        {date.getDate()}
      </span>
      {entry && (
        // `top-5` clears the date number above and can't shrink further.
        // `bottom-5` (matching it exactly) made the stamp itself look
        // noticeably smaller — the fixed inset overhead grew faster than
        // the small aspect-ratio bump could make up for. `bottom-3` still
        // gives real breathing room below the stamp (double the original
        // `bottom-1`, no longer touching the cell's edge) without eating
        // as much into the stamp's own size; the aspect ratio backed off
        // slightly too (1.4 → 1.3) since it no longer needs to make room
        // for a full top-sized bottom gap.
        <div className="absolute inset-x-1.5 bottom-3 top-5 flex items-center justify-center">
          <StampedDay entry={entry} photoUrl={photoUrl} className="h-full max-w-full" />
        </div>
      )}
    </div>
  );

  if (!clickable) return content;

  return <Link href={`/entry/${dateKey}`}>{content}</Link>;
}
