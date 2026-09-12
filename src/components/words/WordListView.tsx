"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import UiIcon from "@/components/icons/UiIcon";
import FuriganaText from "@/components/review/FuriganaText";
import { useToast } from "@/components/toast/ToastProvider";
import {
  fetchAllEntriesForWords,
  fetchWordProgress,
  setWordMemorized,
} from "@/lib/diary/client";
import { collectWords, wordKey, type WordItem } from "@/lib/words/collectWords";
import WordQuiz from "@/components/words/WordQuiz";
import { parseDateKey } from "@/lib/utils/date";

/** Below this many words-with-a-meaning, a match-the-pairs round would
 * either be trivially short or, worse, not fit the "10" the feature is
 * named after in even a loose sense — quieter to just not offer it yet
 * than to offer a 2-card round. */
const QUIZ_MIN_WORDS = 4;

type Filter = "all" | "memorized" | "learning";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "learning", label: "아직" },
  { value: "memorized", label: "외운 단어" },
];

export default function WordListView({ userId }: { userId: string }) {
  const push = useToast();
  const [words, setWords] = useState<WordItem[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [quizzing, setQuizzing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [entries, progress] = await Promise.all([
        fetchAllEntriesForWords(userId),
        fetchWordProgress(userId),
      ]);
      setWords(collectWords(entries, progress));
    } catch (err) {
      console.error(err);
      push("단어 목록을 불러오지 못했어요.");
    }
  }, [userId, push]);

  useEffect(() => {
    // Same fetch-on-mount pattern as MonthCalendar's `load` — the lint
    // rule flags this even though `load` itself only calls setState
    // after its await resolves, not synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const memorizedCount = useMemo(() => words?.filter((w) => w.memorized).length ?? 0, [words]);

  const visible = useMemo(() => {
    if (!words) return [];
    const filtered =
      filter === "all"
        ? words
        : words.filter((w) => (filter === "memorized" ? w.memorized : !w.memorized));
    // Must return 0 for equal dates — always returning -1/1 (never 0)
    // gives the sort contradictory signals for same-day words (a-before-b
    // AND b-before-a simultaneously), which let it reorder them
    // unpredictably instead of leaving equal-date words in their
    // original (most-recently-collected) order.
    return [...filtered].sort((a, b) =>
      a.lastSeen === b.lastSeen ? 0 : a.lastSeen < b.lastSeen ? 1 : -1
    );
  }, [words, filter]);

  // A word with no `meaning` (saved before that was collected) has
  // nothing on the "meaning" side of the quiz to match against, so it's
  // left out of the draw entirely rather than shown with a blank card.
  const quizPool = useMemo(() => words?.filter((w) => w.meaning) ?? [], [words]);

  async function toggle(word: WordItem) {
    const next = !word.memorized;
    const key = wordKey(word.text, word.reading);
    // Optimistic — this is a plain boolean flip a learner will tap
    // through many of in a row; waiting on the round trip before
    // reflecting it would make the list feel laggy for no benefit.
    setWords(
      (prev) =>
        prev?.map((w) => (wordKey(w.text, w.reading) === key ? { ...w, memorized: next } : w)) ??
        prev
    );
    try {
      await setWordMemorized(userId, word.text, word.reading, word.kind, next);
    } catch (err) {
      console.error(err);
      push("저장하지 못했어요. 다시 시도해 주세요.");
      setWords(
        (prev) =>
          prev?.map((w) =>
            wordKey(w.text, w.reading) === key ? { ...w, memorized: !next } : w
          ) ?? prev
      );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
            ←
          </UiIcon>
          캘린더
        </Link>
        <h1 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--ink)]">
          단어장
        </h1>
        <span className="w-[52px]" aria-hidden="true" />
      </header>

      {words && words.length > 0 && !quizzing && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--ink-soft)]">
            {words.length}개 중 {memorizedCount}개 외웠어요
          </p>
          <div className="flex gap-1 rounded-full bg-[var(--paper-raised)] p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === f.value
                    ? "bg-[var(--paper)] text-[var(--ink)]"
                    : "text-[var(--ink-soft)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Below the min, a round would either be too short to bother with
          or not really be the "10" the feature is about — quietly hidden
          rather than offered half-empty. Styled as its own card in the
          app's postmark red rather than another outlined pill (which just
          blended into the filter chips above it) — it's a distinct little
          game, not one more list filter. */}
      {!quizzing && quizPool.length >= QUIZ_MIN_WORDS && (
        <button
          type="button"
          onClick={() => setQuizzing(true)}
          className="flex items-center gap-3 rounded-2xl bg-[var(--shu)] px-4 py-3.5 text-left text-white shadow-sm transition hover:opacity-90"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
            <UiIcon name="cards-line" className="h-5 w-5" alt="">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                <rect x="3" y="7.5" width="12" height="13" rx="2" stroke="currentColor" strokeWidth={1.6} />
                <path
                  d="M8 7.5V5.5A1.5 1.5 0 0 1 9.5 4H19a1.5 1.5 0 0 1 1.5 1.5V17a1.5 1.5 0 0 1-1.5 1.5h-1.5"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </UiIcon>
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">단어 테스트</span>
            <span className="text-xs text-white/75">단어와 뜻을 짝지어 맞혀보세요</span>
          </span>
          {/* Layout/color classes go on this wrapping span, not on UiIcon's
              own `className` — its no-override fallback renders `children`
              inside a plain hardcoded span and doesn't forward the prop, so
              `ml-auto` etc. would silently never reach the DOM (matches the
              pattern already used for MonthCalendar's nav icons). */}
          <span className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center text-white/70">
            <UiIcon name="chevron-right-line" className="h-4 w-4" alt="">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </UiIcon>
          </span>
        </button>
      )}

      {quizzing ? (
        <WordQuiz pool={quizPool} onClose={() => setQuizzing(false)} />
      ) : (
        <>
          {words === null && <p className="text-sm text-[var(--ink-soft)]">불러오는 중…</p>}

          {words !== null && words.length === 0 && (
            <p className="text-sm text-[var(--ink-soft)]">
              아직 모은 단어가 없어요. 일기를 쓰고 첨삭을 받으면 여기에 쌓여요.
            </p>
          )}

          {words !== null && words.length > 0 && visible.length === 0 && (
            <p className="text-sm text-[var(--ink-soft)]">해당하는 단어가 없어요.</p>
          )}

          <div className="flex flex-col gap-2">
            {visible.map((w) => {
              const key = wordKey(w.text, w.reading);
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[var(--paper-raised)] p-4"
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="font-[family-name:var(--font-diary)] text-base font-medium text-[var(--ink)]">
                      <FuriganaText
                        text={w.text}
                        readings={[{ text: w.text, reading: w.reading, kind: w.kind }]}
                      />
                    </span>
                    {/* Empty for a word saved before `meaning` was collected —
                        no placeholder text, just one fewer line for that card. */}
                    {w.meaning && <p className="text-sm text-[var(--ink)]">{w.meaning}</p>}
                    <span className="text-[11px] text-[var(--ink-soft)]">
                      {parseDateKey(w.lastSeen).toLocaleDateString("ko-KR", {
                        month: "long",
                        day: "numeric",
                      })}
                      {w.occurrences > 1 && ` · ${w.occurrences}번 등장`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(w)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      w.memorized
                        ? "bg-[var(--shu)] text-white"
                        : "border border-[var(--paper-line)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {w.memorized ? "외웠어요" : "아직이에요"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
