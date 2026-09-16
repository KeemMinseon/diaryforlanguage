/** YYYY-MM-DD in local time (no UTC shifting — avoids off-by-one-day bugs). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Every day of `year`/`month` (0-indexed month, like `Date`), the 1st
 * through the last — in order, no leading/trailing padding from the
 * previous or next month. The calendar (MonthCalendar) renders these as a
 * plain sequential grid (a "sheet" of the month, not a weekday-aligned
 * calendar), so there's no week-chunking here either. */
export function daysInMonth(year: number, month: number): Date[] {
  const count = new Date(year, month + 1, 0).getDate();
  const days: Date[] = [];
  for (let d = 1; d <= count; d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

const WEEKDAY_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_EN = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/** "SEP 2026 · SUN" — the entry-writing screen's own header date, next to
 * the big day-of-month number. Hand-written (not `Intl`/`toLocaleDateString`)
 * for the same reason as `formatTimeKo` below: a "use client" component
 * using one during render risks disagreeing with itself between the
 * server's bundled ICU and the browser's own. */
export function formatEntryHeaderDate(dateKey: string): string {
  const d = parseDateKey(dateKey);
  return `${MONTH_EN[d.getMonth()]} ${d.getFullYear()} · ${WEEKDAY_EN[d.getDay()]}`;
}

/** "2026.09.13 SUN" — the entry detail screen's own compact date stamp,
 * shown next to that day's stamp art. */
export function formatDateStamp(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day} ${WEEKDAY_EN[d.getDay()]}`;
}

/** "오전 9:12" style, entirely by hand — no `Intl`/`toLocaleTimeString`.
 * Those depend on the runtime's bundled ICU/CLDR data, and a "use
 * client" component using one during render gets server-rendered once
 * (Node's ICU) and then hydrated in the browser (its own, possibly
 * different, ICU) — a real mismatch was observed between the two for
 * "ko-KR" AM/PM specifically (the literal English "AM"/"PM" from one
 * Node build vs "오전"/"오후" from the browser), which is exactly the
 * kind of thing React's hydration check flags as an error. Formatting
 * it ourselves, with fixed Korean strings, can't disagree with itself. */
function formatTimeKo(d: Date): string {
  const period = d.getHours() < 12 ? "오전" : "오후";
  const hour12 = d.getHours() % 12 || 12;
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${period} ${hour12}:${minute}`;
}

/** Just the time when `iso` falls on the same local day as
 * `referenceDateKey`; full month/day + time otherwise (e.g. a paragraph
 * saved on a later day via "이어서 쓰기"), so that's never ambiguous. */
export function formatSavedAt(iso: string, referenceDateKey: string): string {
  const saved = new Date(iso);
  if (toDateKey(saved) === referenceDateKey) {
    return formatTimeKo(saved);
  }
  return `${saved.getMonth() + 1}월 ${saved.getDate()}일 ${formatTimeKo(saved)}`;
}
