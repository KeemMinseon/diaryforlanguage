"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DayCell from "@/components/calendar/DayCell";
import { useToast } from "@/components/toast/ToastProvider";
import { fetchMonthEntries } from "@/lib/diary/client";
import { buildMonthGrid, toDateKey, todayKey, WEEKDAY_LABELS_KO } from "@/lib/utils/date";
import type { DiaryEntry, DiaryEntryMap } from "@/types/diary";

const POLL_INTERVAL_MS = 8000;

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
  const toast = useToast();

  const [{ year, month }, setCursor] = useState(() => parseMonthParam(searchParams.get("month")));
  const [entries, setEntries] = useState<DiaryEntryMap>({});
  const [loading, setLoading] = useState(true);
  const knownStatus = useRef<Map<string, string>>(new Map());

  const monthStartKey = toDateKey(new Date(year, month, 1));
  const monthEndKey = toDateKey(new Date(year, month + 1, 0));

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const rows = await fetchMonthEntries(userId, monthStartKey, monthEndKey);
        const map: DiaryEntryMap = {};
        for (const row of rows) map[row.entry_date] = row;

        for (const row of rows) {
          const prevStatus = knownStatus.current.get(row.entry_date);
          if (prevStatus === "pending" && row.status === "reviewed") {
            const label = new Date(row.entry_date).toLocaleDateString("ko-KR", {
              month: "long",
              day: "numeric",
            });
            toast(`${label} 일기에 添削이 도착했어요!`);
          }
          knownStatus.current.set(row.entry_date, row.status);
        }

        setEntries(map);
      } finally {
        setLoading(false);
      }
    },
    [userId, monthStartKey, monthEndKey, toast]
  );

  useEffect(() => {
    // `load` sets loading state before awaiting Supabase — that's the point
    // of a fetch-on-mount effect, so this intentionally isn't deferred.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    const hasPending = Object.values(entries).some((e: DiaryEntry) => e.status === "pending");
    if (!hasPending) return;
    const id = setInterval(() => load({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [entries, load]);

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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-heading)] text-xl text-[var(--ink)]">
          言の葉日記
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

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-[var(--ink-soft)] sm:gap-2">
        {WEEKDAY_LABELS_KO.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className={`grid flex-1 grid-cols-7 gap-1.5 sm:gap-2 ${loading ? "opacity-60" : ""}`}>
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
