"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DayCell from "@/components/calendar/DayCell";
import FuriganaText from "@/components/review/FuriganaText";
import { fetchMonthEntries } from "@/lib/diary/client";
import { buildMonthGrid, parseDateKey, toDateKey, todayKey, WEEKDAY_LABELS_KO } from "@/lib/utils/date";
import type { DiaryEntryMap, Reading, Suggestion } from "@/types/diary";

/** One suggestion plus the readings from the entry it came from — kept
 * together so FuriganaText has the right context to annotate it with. */
type MonthWord = Suggestion & { readings: Reading[] };

interface MonthWordGroup {
  entryDate: string;
  words: MonthWord[];
}

// A learner mixing Korean into the Japanese diary is exactly the case the
// model translates into a new Japanese `suggestion` — those are the words
// most worth reviewing here, since they were never in Japanese to begin
// with. A pure grammar fix (both sides already Japanese) doesn't qualify.
const HANGUL_RE = /[가-힣]/;

/** This month's Korean-origin words, grouped by the day they were written,
 * most recent day first. */
function monthWordsByDate(entries: DiaryEntryMap): MonthWordGroup[] {
  const sortedEntries = Object.values(entries).sort((a, b) =>
    a.entry_date < b.entry_date ? 1 : -1
  );
  const groups: MonthWordGroup[] = [];
  for (const entry of sortedEntries) {
    const seen = new Set<string>();
    const words: MonthWord[] = [];
    for (const s of entry.suggestions) {
      if (!HANGUL_RE.test(s.original)) continue;
      const key = `${s.original} ${s.suggestion}`;
      if (seen.has(key)) continue;
      seen.add(key);
      words.push({ ...s, readings: entry.readings });
    }
    if (words.length > 0) groups.push({ entryDate: entry.entry_date, words });
  }
  return groups;
}

function parseMonthParam(value: string | null): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export default function MonthCalendar({ userId }: { userId: string }) {
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
      const rows = await fetchMonthEntries(userId, monthStartKey, monthEndKey);
      const map: DiaryEntryMap = {};
      for (const row of rows) map[row.entry_date] = row;
      setEntries(map);
    } finally {
      setLoading(false);
    }
  }, [userId, monthStartKey, monthEndKey]);

  useEffect(() => {
    // `load` sets loading state before awaiting Supabase — that's the point
    // of a fetch-on-mount effect, so this intentionally isn't deferred.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

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

  const weeks = buildMonthGrid(year, month);
  const today = todayKey();
  const monthWordGroups = monthWordsByDate(entries);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-heading)] text-xl text-[var(--ink)]">
          우표일기
        </h1>
        <form action="/auth/signout" method="post">
          <SignOutButton />
        </form>
      </header>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToMonth(year, month - 1)}
          className="rounded-full px-3 py-1 text-[var(--ink-soft)] hover:bg-[var(--paper-line)]/40"
          aria-label="이전 달"
        >
          ←
        </button>
        <p className="font-[family-name:var(--font-heading)] text-lg text-[var(--ink)]">
          {year}년 {month + 1}월
        </p>
        <button
          type="button"
          onClick={() => goToMonth(year, month + 1)}
          className="rounded-full px-3 py-1 text-[var(--ink-soft)] hover:bg-[var(--paper-line)]/40"
          aria-label="다음 달"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--ink-soft)] sm:gap-1.5">
        {WEEKDAY_LABELS_KO.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      {/* No flex-1 here — the grid should be exactly as tall as 6 rows of
          cells need, no more. It used to grow to fill whatever space was
          left in the page, which (combined with Grid's default
          align-content behaving like stretch on auto-sized row tracks)
          inflated the visual gap between rows far past the declared
          `gap` value. Now any leftover page height is just left for
          whatever comes after the grid, e.g. the month's word list below. */}
      <div className={`grid grid-cols-7 gap-1 sm:gap-1.5 ${loading ? "opacity-60" : ""}`}>
        {weeks.flatMap((week) =>
          week.map((date) => {
            const key = toDateKey(date);
            return (
              <DayCell
                key={key}
                date={date}
                dateKey={key}
                inCurrentMonth={date.getMonth() === month}
                isToday={key === today}
                isFuture={key > today}
                entry={entries[key]}
              />
            );
          })
        )}
      </div>

      {monthWordGroups.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--ink)]">
            이번 달
          </h2>
          {monthWordGroups.map((group) => (
            <div key={group.entryDate} className="flex flex-col gap-2">
              <p className="text-xs text-[var(--ink-soft)]">
                {parseDateKey(group.entryDate).toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.words.map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--paper-line)] bg-[var(--paper-raised)] px-3 py-1.5 text-[13px]"
                  >
                    <span className="text-[var(--ink-soft)]">{s.original}</span>
                    <span aria-hidden="true">→</span>
                    <span className="font-[family-name:var(--font-diary)] font-medium text-[var(--ink)]">
                      <FuriganaText text={s.suggestion} readings={s.readings} />
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function SignOutButton() {
  return (
    <button
      type="submit"
      className="text-xs text-[var(--ink-soft)] underline underline-offset-2 hover:text-[var(--ink)]"
    >
      로그아웃
    </button>
  );
}
