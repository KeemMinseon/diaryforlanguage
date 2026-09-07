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
      <span
        className={`z-10 text-[11px] leading-none ${
          isToday ? "font-bold text-[var(--ink)]" : "text-[var(--ink-soft)]"
        }`}
      >
        {date.getDate()}
      </span>
      {entry && (
        <div className="absolute inset-x-2 bottom-1 top-5 flex items-center justify-center">
          <StampedDay entry={entry} photoUrl={photoUrl} className="h-full max-w-[85%]" />
        </div>
      )}
    </div>
  );

  if (!clickable) return content;

  return <Link href={`/entry/${dateKey}`}>{content}</Link>;
}
