"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import DayCell from "@/components/calendar/DayCell";
import UiIcon from "@/components/icons/UiIcon";
import FuriganaText from "@/components/review/FuriganaText";
import { fetchMonthEntries } from "@/lib/diary/client";
import { onDiaryStamped } from "@/lib/events/diaryStamped";
import { wordKey } from "@/lib/words/collectWords";
import { buildMonthGrid, parseDateKey, toDateKey, todayKey, WEEKDAY_LABELS_KO } from "@/lib/utils/date";
import type { DiaryEntryMap, Reading, Suggestion } from "@/types/diary";

/** One suggestion plus the readings from the entry it came from — kept
 * together so FuriganaText has the right context to annotate it with. */
type MonthSuggestion = Suggestion & { readings: Reading[] };

interface MonthWordGroup {
  entryDate: string;
  suggestions: MonthSuggestion[];
  /** The day's own vocabulary (읽는 법 + 뜻) — same source 단어장 itself
   * reads from, just scoped to this one day instead of collapsed across
   * the whole account. The same word turning up again on some other day
   * this month isn't deduped away here — only within a single day, same
   * as `suggestions` below — this list is "what came up that day", not a
   * running once-per-month tally. */
  vocab: Reading[];
}

/** A reading whose exact text never actually appears in what the learner
 * themselves wrote (`entry.content`) only ever got there through a
 * suggestion's corrected phrasing — a word the correction introduced,
 * not one the learner already used (and, in a very concrete sense,
 * therefore already knows) on their own. Readings the learner's own
 * writing already contains are filtered out of the month list below —
 * they're not what "새로 배운 단어" is about, and 단어장 (which shows
 * every word regardless, since that's meant to be the full running
 * list) is still the place for those. */
function isFromSuggestionOnly(reading: Reading, content: string): boolean {
  return !content.includes(reading.text);
}

/** This month's word/expression suggestions plus actual vocabulary,
 * grouped by the day they were written, most recent day first — every
 * suggestion from the entry, not just ones that started out as Korean
 * mixed into the Japanese (that used to be the only case shown here,
 * which made a day's grammar/phrasing suggestions disappear from this
 * list even though they're just as worth reviewing). Vocabulary (added
 * later, per user feedback that a list of corrections alone didn't feel
 * like it captured what was actually *learned* that day) is 단어장's own
 * source data, `readings` — grouped per-day instead of collapsed across
 * every entry ever written, and narrowed to words the learner didn't
 * already know how to write themselves (see `isFromSuggestionOnly`). */
function monthWordsByDate(entries: DiaryEntryMap): MonthWordGroup[] {
  const sortedEntries = Object.values(entries).sort((a, b) =>
    a.entry_date < b.entry_date ? 1 : -1
  );
  const groups: MonthWordGroup[] = [];
  for (const entry of sortedEntries) {
    const seenSuggestions = new Set<string>();
    const suggestions: MonthSuggestion[] = [];
    for (const s of entry.suggestions) {
      const key = `${s.original} ${s.suggestion}`;
      if (seenSuggestions.has(key)) continue;
      seenSuggestions.add(key);
      suggestions.push({ ...s, readings: entry.readings });
    }

    const seenVocab = new Set<string>();
    const vocab: Reading[] = [];
    for (const r of entry.readings) {
      if (!r.text || !r.reading) continue;
      if (!isFromSuggestionOnly(r, entry.content)) continue;
      const key = wordKey(r.text, r.reading);
      if (seenVocab.has(key)) continue;
      seenVocab.add(key);
      vocab.push(r);
    }

    if (suggestions.length > 0 || vocab.length > 0) {
      groups.push({ entryDate: entry.entry_date, suggestions, vocab });
    }
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

export default function MonthCalendar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [{ year, month }, setCursor] = useState(() => parseMonthParam(searchParams.get("month")));
  const [entries, setEntries] = useState<DiaryEntryMap>({});
  const [loading, setLoading] = useState(true);
  // Set for a few seconds right after a "diary:stamped" event names a day
  // in the currently-shown month — StampedDay uses this to play a real
  // stamp-landing animation on that one cell instead of the hanko just
  // silently appearing next time this data happens to re-fetch.
  const [justStampedDate, setJustStampedDate] = useState<string | null>(null);

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
      // lexicographically exactly like it sorts chronologically.
      if (dateKey < monthStartKey || dateKey > monthEndKey) return;
      load().then(() => {
        setJustStampedDate(dateKey);
        // Only actually matters for hygiene — a CSS animation triggers
        // once when a class is first added to an element, not on every
        // render it stays present for, so this isn't what stops the
        // animation from replaying on its own.
        setTimeout(() => setJustStampedDate(null), 3000);
      });
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

  const weeks = buildMonthGrid(year, month);
  const today = todayKey();
  const monthWordGroups = monthWordsByDate(entries);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--ink)]">
          우표일기
        </h1>
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

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToMonth(year, month - 1)}
          className="flex items-center justify-center rounded-full px-3 py-1 text-[var(--ink-soft)] hover:bg-[var(--paper-line)]/40"
          aria-label="이전 달"
        >
          <UiIcon name="bracket-left-line" className="h-4 w-4" alt="">
            ←
          </UiIcon>
        </button>
        <p className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--ink)]">
          {year}년 {month + 1}월
        </p>
        <button
          type="button"
          onClick={() => goToMonth(year, month + 1)}
          className="flex items-center justify-center rounded-full px-3 py-1 text-[var(--ink-soft)] hover:bg-[var(--paper-line)]/40"
          aria-label="다음 달"
        >
          <UiIcon name="bracket-right-line" className="h-4 w-4" alt="">
            →
          </UiIcon>
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
                justStamped={key === justStampedDate}
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
              <div className="flex flex-col gap-1.5">
                {group.vocab.map((r) => (
                  <span
                    key={wordKey(r.text, r.reading)}
                    className="flex w-full flex-col gap-1 rounded-[10px] bg-[var(--paper-raised)] px-3 py-2"
                  >
                    <span className="font-[family-name:var(--font-diary)] text-[15px] font-medium text-[var(--ink)]">
                      <FuriganaText text={r.text} readings={[r]} />
                    </span>
                    {r.meaning && (
                      <span className="text-[12px] text-[var(--ink-soft)]">{r.meaning}</span>
                    )}
                  </span>
                ))}
                {group.suggestions.map((s, i) => (
                  <span
                    key={i}
                    className="flex w-full flex-col gap-1 rounded-[10px] bg-[var(--paper-raised)] px-3 py-2"
                  >
                    {/* Color alone (soft original above, full-ink suggestion
                        below) already reads as "before → after" — a
                        strikethrough and arrow on top of that was redundant. */}
                    <span className="text-[12px] text-[var(--ink-soft)]">{s.original}</span>
                    <span className="font-[family-name:var(--font-diary)] text-[15px] font-medium text-[var(--ink)]">
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
