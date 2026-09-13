import Link from "next/link";
import StampedDay from "@/components/stamps/StampedDay";
import { photoPublicUrl } from "@/lib/diary/client";
import { stampTiltDeg } from "@/lib/stamps/stampTilt";
import type { DiaryEntry } from "@/types/diary";

/**
 * "시트" grid cell: a filled slot shows only its stamp (no date number,
 * no box around it) and an empty slot shows only its date number (small,
 * muted, centered) — together read as a sheet of stamps with gaps where
 * none has landed yet, rather than a bordered day-box calendar. No cell
 * ever gets its own background/border/rounded corner; the grid's own gap
 * between cells is the only separation. (This replaced an earlier
 * experimental "frameless" toggle on the "우표일기" title — the sheet look
 * is that same box-less rendering, just made the one and only calendar
 * appearance instead of an opt-in preview.)
 */
export default function DayCell({
  date,
  dateKey,
  inCurrentMonth,
  isToday,
  isFuture,
  entry,
  justStamped = false,
}: {
  date: Date;
  dateKey: string;
  inCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  entry?: DiaryEntry;
  /** True for the few seconds right after this exact day's entry just
   * got its final reviewed stamp — see lib/events/diaryStamped.ts. */
  justStamped?: boolean;
}) {
  // Only this month's own days show at all now — a leading/trailing cell
  // from the previous/next month (there to pad the grid out to full
  // weeks) used to render its date number dimmed; it never had an entry
  // of its own to show a stamp for anyway (MonthCalendar only fetches
  // entries within the current month's own date range), so there was
  // nothing there worth keeping. Still occupies its grid slot (same
  // aspect ratio) so the day-of-week columns stay aligned — just empty.
  if (!inCurrentMonth) {
    return <div aria-hidden="true" className="aspect-[1/1.44]" />;
  }

  const clickable = Boolean(entry) || !isFuture;
  const photoUrl = entry?.stamp_kind === "photo" ? photoPublicUrl(entry.photo_path) : null;
  // At least 1 once there's an entry at all — an entry saved before
  // per-session stamps existed just has an empty `stamps` array, but
  // still has exactly one (implicit) stamp via stamp_kind/stamp_key.
  const stampCount = entry ? Math.max(entry.stamps?.length ?? 0, 1) : 0;
  // A stamp glued on perfectly straight every time read as too neat/
  // printed — seeded off the date itself so a given day's tilt stays the
  // same on every render (see stampTiltDeg's own comment on why not
  // Math.random()).
  const tiltDeg = entry ? stampTiltDeg(dateKey) : 0;

  const content = (
    <div
      className={`relative flex aspect-[1/1.44] items-center justify-center transition ${
        clickable ? "cursor-pointer" : "cursor-default opacity-50"
      }`}
    >
      {entry ? (
        // Percentages, not rem-based spacing — rem is relative to the
        // root font-size, which iOS bumps up under a larger system
        // text-size setting even when a page never opts into its own
        // zoom, and that ate into the stamp's own share of a cell that
        // didn't grow to match. Even margins on all four sides now (no
        // date number to clear room for up top the way a boxed cell
        // used to need) — inset-x-19%/inset-y-13% land on the same
        // *pixel* margin despite the different percentages, since
        // they're taken against this box's two different side lengths
        // (aspect-[1/1.44]: 19% of the width == 13% of the height).
        <div className="absolute inset-x-[19%] inset-y-[13%] flex items-center justify-center">
          <StampedDay
            entry={entry}
            photoUrl={photoUrl}
            stampCount={stampCount}
            justStamped={justStamped}
            tiltDeg={tiltDeg}
            className="h-full max-w-full"
          />
        </div>
      ) : (
        <span
          className={`flex h-6 w-6 items-center justify-center text-[11px] leading-none text-[var(--ink-soft)] ${
            isToday ? "rounded-full ring-1 ring-[var(--ink)]" : ""
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
