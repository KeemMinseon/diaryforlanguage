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

/** Weeks (Sun-Sat) of a full calendar month grid, including lead/trail days. */
export function buildMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const weeks: Date[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export const WEEKDAY_LABELS_KO = ["일", "월", "화", "수", "목", "금", "토"];

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
