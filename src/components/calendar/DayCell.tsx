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
      className={`group relative flex aspect-[1/1.4] flex-col overflow-visible rounded-xl p-1.5 transition ${
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
        // `top-5` clears the date number above and can't shrink; `bottom-5`
        // matches it now instead of the old `bottom-1` — that asymmetry (a
        // tall gap above the stamp, almost none below it) was the point of
        // "숫자가 있는 쪽은 어쩔 수 없이 우표 위쪽에 공간이 더 있잖아". The
        // cell's own aspect ratio grew a bit (1.25 → 1.4) to make room for
        // the new bottom gap without just shrinking the stamp to fit.
        <div className="absolute inset-x-1.5 bottom-5 top-5 flex items-center justify-center">
          <StampedDay entry={entry} photoUrl={photoUrl} className="h-full max-w-full" />
        </div>
      )}
    </div>
  );

  if (!clickable) return content;

  return <Link href={`/entry/${dateKey}`}>{content}</Link>;
}
