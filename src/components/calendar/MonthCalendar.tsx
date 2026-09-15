"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DayCell from "@/components/calendar/DayCell";
import UiIcon from "@/components/icons/UiIcon";
import { fetchMonthEntries } from "@/lib/diary/client";
import { onDiaryStamped } from "@/lib/events/diaryStamped";
import { daysInMonth, parseDateKey, toDateKey, todayKey } from "@/lib/utils/date";
import type { DiaryEntryMap } from "@/types/diary";

function parseMonthParam(value: string | null): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export default function MonthCalendar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [{ year, month }, setCursor] = useState(() => parseMonthParam(searchParams.get("month")));
  const [entries, setEntries] = useState<DiaryEntryMap>({});
  const [loading, setLoading] = useState(true);

  const monthStartKey = toDateKey(new Date(year, month, 1));
  const monthEndKey = toDateKey(new Date(year, month + 1, 0));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchMonthEntries(monthStartKey, monthEndKey);
      const map: DiaryEntryMap = {};
      for (const row of rows) map[row.entry_date] = row;
      setEntries(map);
    } finally {
      setLoading(false);
    }
  }, [monthStartKey, monthEndKey]);

  useEffect(() => {
    // `load` sets loading state before awaiting Supabase — that's the point
    // of a fetch-on-mount effect, so this intentionally isn't deferred.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    return onDiaryStamped((dateKey) => {
      // Plain string comparison works here the same way it does for
      // Supabase's own gte/lte queries on entry_date — "YYYY-MM-DD" sorts
      // lexicographically exactly like it sorts chronologically. Just a
      // refetch — no per-cell "just stamped" animation any more (see
      // DayCell: no hanko, no pop-in to play here either).
      if (dateKey < monthStartKey || dateKey > monthEndKey) return;
      load();
    });
  }, [load, monthStartKey, monthEndKey]);

  function goToMonth(nextYear: number, nextMonth: number) {
    let y = nextYear;
    let m = nextMonth;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setCursor({ year: y, month: m });
    router.replace(`/?month=${y}-${String(m + 1).padStart(2, "0")}`, { scroll: false });
  }

  const days = daysInMonth(year, month);
  const today = todayKey();
  const now = new Date();
  const isCurrentMonthShown = year === now.getFullYear() && month === now.getMonth();
  const todayEntry = isCurrentMonthShown ? entries[today] : undefined;
  const filledCount = Object.keys(entries).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        {/* The month/year text here duplicated the "08 09 10" strip below
            it (which already says which month, just not spelled out) —
            swapped for the app's own icon instead of repeating that info
            a third time. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- app icon, not a next/image-worthy photo */}
        <img src="/icon.png" alt="우표일기" className="h-8 w-8 rounded-lg" />
        <div className="flex items-center gap-1">
          <Link
            href="/words"
            aria-label="단어장"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--paper-line)]/40 hover:text-[var(--ink)]"
          >
            <UiIcon name="book-open-line" className="h-5 w-5" alt="단어장">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H4z"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                />
                <path
                  d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5H20z"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                />
              </svg>
            </UiIcon>
          </Link>
          <Link
            href="/stamps"
            aria-label="우표 모음"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--paper-line)]/40 hover:text-[var(--ink)]"
          >
            <UiIcon name="stamp-grid-line" className="h-5 w-5" alt="우표 모음">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth={1.6} />
                <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth={1.6} />
                <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth={1.6} />
                <rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth={1.6} />
              </svg>
            </UiIcon>
          </Link>
          <Link
            href="/settings"
            aria-label="설정"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--paper-line)]/40 hover:text-[var(--ink)]"
          >
            <UiIcon name="settings-line" className="h-5 w-5" alt="설정">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <path
                  d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M19.4 13.5a1.7 1.7 0 0 0 .35 1.9l.05.05a2 2 0 1 1-2.85 2.85l-.05-.05a1.7 1.7 0 0 0-1.9-.35 1.7 1.7 0 0 0-1 1.55V19.6a2 2 0 1 1-4 0v-.08a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.9.35l-.05.05a2 2 0 1 1-2.85-2.85l.05-.05a1.7 1.7 0 0 0 .35-1.9 1.7 1.7 0 0 0-1.55-1H4.4a2 2 0 1 1 0-4h.08a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.35-1.9l-.05-.05A2 2 0 1 1 8.48 4.4l.05.05a1.7 1.7 0 0 0 1.9.35H10.5a1.7 1.7 0 0 0 1-1.55V3.4a2 2 0 1 1 4 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.9-.35l.05-.05a2 2 0 1 1 2.85 2.85l-.05.05a1.7 1.7 0 0 0-.35 1.9V9.5a1.7 1.7 0 0 0 1.55 1H19.6a2 2 0 1 1 0 4h-.08a1.7 1.7 0 0 0-1.55 1z"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
              </svg>
            </UiIcon>
          </Link>
        </div>
      </header>

      {/* Counter and month-nav share one row now, instead of stacking as
          two separate lines with a big gap between them. */}
      <div className="flex items-center justify-between">
        {/* Big "채운 날/총 일수" counter — how much of the month is written
            so far, not which day-of-month today is (that's the TODAY card
            below). */}
        <p className="font-[family-name:var(--font-heading)] text-[var(--ink)]">
          <span className="text-4xl font-bold">{filledCount}</span>
          <span className="text-base text-[var(--ink-soft)]">/{days.length}</span>
        </p>

        {/* Compact "‹ 08 09 10 ›" month strip — the two flanking numbers
            are shortcuts to prev/next month (same destination as the
            arrows, just also reachable by tapping the number itself), the
            bold center one is just the current month restated, not a
            button. */}
        <div className="flex items-center gap-1 font-[family-name:var(--font-heading)]">
          <button
            type="button"
            onClick={() => goToMonth(year, month - 1)}
            className="flex items-center justify-center rounded-full px-2 py-1 text-[var(--ink-soft)] hover:bg-[var(--paper-line)]/40"
            aria-label="이전 달"
          >
            <UiIcon name="bracket-left-line" className="h-4 w-4" alt="">
              ←
            </UiIcon>
          </button>
          <button
            type="button"
            onClick={() => goToMonth(year, month - 1)}
            className="rounded-full px-2 py-1 text-sm text-[var(--ink-tertiary)] hover:bg-[var(--paper-line)]/40 hover:text-[var(--ink-soft)]"
          >
            {String(((month - 1 + 12) % 12) + 1).padStart(2, "0")}
          </button>
          <p className="rounded-full px-2 py-1 text-lg font-bold text-[var(--ink)]">
            {String(month + 1).padStart(2, "0")}
          </p>
          <button
            type="button"
            onClick={() => goToMonth(year, month + 1)}
            className="rounded-full px-2 py-1 text-sm text-[var(--ink-tertiary)] hover:bg-[var(--paper-line)]/40 hover:text-[var(--ink-soft)]"
          >
            {String(((month + 1) % 12) + 1).padStart(2, "0")}
          </button>
          <button
            type="button"
            onClick={() => goToMonth(year, month + 1)}
            className="flex items-center justify-center rounded-full px-2 py-1 text-[var(--ink-soft)] hover:bg-[var(--paper-line)]/40"
            aria-label="다음 달"
          >
            <UiIcon name="bracket-right-line" className="h-4 w-4" alt="">
              →
            </UiIcon>
          </button>
        </div>
      </div>

      {/* No flex-1 here — the grid should be exactly as tall as its rows
          need, no more. It used to grow to fill whatever space was left
          in the page, which (combined with Grid's default align-content
          behaving like stretch on auto-sized row tracks) inflated the
          visual gap between rows far past the declared `gap` value. Now
          any leftover page height is just left for whatever comes after
          the grid, e.g. the TODAY card below.

          6 columns, plain sequential 1..daysInMonth — not a weekday-
          aligned calendar (see daysInMonth's own doc comment) — so the
          last row is simply however many days are left over, not padded
          out to a full row. */}
      <div className={`grid grid-cols-6 gap-1.5 sm:gap-2 ${loading ? "opacity-60" : ""}`}>
        {days.map((date) => {
          const key = toDateKey(date);
          return (
            <DayCell
              key={key}
              date={date}
              dateKey={key}
              isToday={key === today}
              isFuture={key > today}
              entry={entries[key]}
            />
          );
        })}
      </div>

      {/* Always today, never a day the learner tapped — this is a fixed
          "where do I stand today" focus, not a preview that follows the
          grid. Only shown while today is actually in the month on screen
          (browsing to a past/future month has no "오늘" cell to anchor
          it to). Tapping it goes to the same /entry/[date] detail a grid
          cell would — a day with nothing yet lands on the blank editor to
          start writing, exactly like tapping today's own (writable) empty
          cell above already does. */}
      {isCurrentMonthShown && (
        <Link
          href={`/entry/${today}`}
          className="flex flex-col gap-2 rounded-2xl bg-[var(--paper-raised)] px-5 py-4"
        >
          <p className="text-xs text-[var(--ink-soft)]">
            TODAY · {parseDateKey(today).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })} ·
            NO.{parseDateKey(today).getDate()}
          </p>
          {todayEntry ? (
            // Matches the entry detail screen (ReviewView): a "이어서
            // 쓰기" sitting's just-written text doesn't land anywhere
            // this card or that screen can show it until its own review
            // comes back (see ChatEditor's pending save) — showing this
            // raw `content` unconditionally used to let this card get
            // ahead of that, displaying text the detail screen itself
            // couldn't yet. Gated the same way there: nothing shown
            // until review is no longer pending (reviewed *or* failed).
            todayEntry.status === "pending" ? (
              <p className="text-sm text-[var(--ink-soft)]">검토 중이에요…</p>
            ) : (
              <p className="font-[family-name:var(--font-diary)] text-sm text-[var(--ink)] line-clamp-2">
                {todayEntry.content}
              </p>
            )
          ) : (
            <p className="font-[family-name:var(--font-diary)] text-sm text-[var(--ink-soft)]">
              오늘의 일기를 써보세요.
            </p>
          )}
        </Link>
      )}
    </div>
  );
}
