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
          // Four straight attempts at sizing StampFrame's SVG inside this
          // cell's small margin (viewBox-inferred intrinsic size, a CSS
          // `aspect-ratio` box, hand-computed asymmetric inset percentages,
          // then a plain symmetric inset with the svg at `w-full h-full`
          // relying on SVG's own universal `preserveAspectRatio="meet"`
          // guarantee) all looked correct on Chrome/Android and in a
          // Chromium-based visual check here, but the real device this
          // still had to work on — iOS Safari — kept clipping the stamp's
          // bottom edge regardless, through every one of those approaches.
          // Rather than attempt a fifth theory about *why* blind, this
          // drops the scalloped SVG for this one small context entirely
          // and falls back to a plain `<img>` with `object-fit: cover` —
          // exactly the mechanism the keyword-stamp branch below already
          // uses and which has rendered correctly in every report so far,
          // including on the same Safari that kept failing the svg path.
          // Simple rounded corners instead of the scalloped cut, but
          // guaranteed to actually fill its box everywhere.
          <div className="absolute inset-[8%] overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, dimensions unknown ahead of time */}
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          </div>
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
