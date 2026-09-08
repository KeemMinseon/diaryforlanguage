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
      className={`group relative flex aspect-[1/1.44] flex-col overflow-visible rounded-xl p-1.5 transition ${
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
        // Percentages, not rem-based spacing (top-5/bottom-3/inset-x-1.5
        // used to be here) — rem is relative to the root font-size, which
        // iOS bumps up under a larger system text-size setting even when
        // a page never opts into its own zoom, and that ate into the
        // stamp's own share of a cell that didn't grow to match.
        //
        // The stamp's own artwork (inside StampedDay/StampFrame) always
        // renders at a fixed aspect ratio, letterboxed to fit this box.
        // A first pass at making the stamp bigger just shrank `bottom`
        // and switched to `justify-start`, growing the box rightward from
        // a fixed left edge — bigger, but visibly lopsided (a lot of
        // empty space on the right that centering used to hide, and no
        // matching gap below). Instead: `bottom` is set to the same
        // *pixel* margin as `inset-x` (left/right and bottom read as one
        // consistent frame around the stamp; only `top` differs, for the
        // date number's clearance) — that pixel/percentage mismatch is
        // also why bottom's percentage looks smaller than inset-x's even
        // though the margins match: bottom-% is of the *cell's height*,
        // inset-x-% is of its *width*, two different bases for the same
        // target pixel amount. The cell grew taller again
        // (aspect-[1/1.35] → aspect-[1/1.44]) to fit a stamp this size
        // with all three margins actually even.
        <div className="absolute inset-x-[19%] top-[29%] bottom-[13%] flex items-center justify-center">
          <StampedDay entry={entry} photoUrl={photoUrl} className="h-full max-w-full" />
        </div>
      )}
    </div>
  );

  if (!clickable) return content;

  return <Link href={`/entry/${dateKey}`}>{content}</Link>;
}
