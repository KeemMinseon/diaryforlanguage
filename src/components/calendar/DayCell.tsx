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
      } ${inCurrentMonth ? "bg-[var(--paper-raised)]" : "bg-transparent opacity-40"} ${
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
        // `top-5`/`bottom-3`/`inset-x-1.5` (rem-based) used to be here —
        // rem is relative to the root font-size, which iOS bumps up
        // under a larger system text-size setting even when a page never
        // opts into its own zoom. Measured effect: going from a 16px to
        // a 21px root shrank the stamp's own box by ~44% in height, while
        // the cell itself barely changed size at all (confirmed via a
        // learner comparing their iPhone, at its smallest text-size
        // setting, against an Android phone with an even smaller one).
        // Percentages here are relative to the cell's own size instead,
        // so root font-size can't eat into the stamp's share of it.
        // Chosen to match the previous rem values' proportions at a
        // typical cell size (top-5/bottom-3/inset-x-1.5 ≈ 32%/19%/12.5%
        // of a ~62×48px cell).
        <div className="absolute inset-x-[12.5%] top-[32%] bottom-[19%] flex items-center justify-center">
          <StampedDay entry={entry} photoUrl={photoUrl} className="h-full max-w-full" />
        </div>
      )}
    </div>
  );

  if (!clickable) return content;

  return <Link href={`/entry/${dateKey}`}>{content}</Link>;
}
