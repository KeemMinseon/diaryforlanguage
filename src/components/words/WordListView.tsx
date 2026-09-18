"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import UiIcon from "@/components/icons/UiIcon";
import FuriganaText from "@/components/review/FuriganaText";
import { useToast } from "@/components/toast/ToastProvider";
import { onDiaryStamped } from "@/lib/events/diaryStamped";
import {
  fetchAllEntriesForWords,
  fetchWordProgress,
  recordQuizCorrect,
  setWordMemorized,
} from "@/lib/diary/client";
import { collectWords, wordKey, type WordItem } from "@/lib/words/collectWords";
import WordQuiz from "@/components/words/WordQuiz";
import { toDateKey, todayKey } from "@/lib/utils/date";

/** Below this many words-with-a-meaning, a match-the-pairs round would
 * be too short to feel like a real round — quieter to just not offer it
 * yet than to offer a 2-card one. */
const QUIZ_MIN_WORDS = 4;

/** A word gets auto-marked memorized once 단어 테스트 (WordQuiz) has
 * matched it correctly this many times — cumulative across every round
 * ever played, not a consecutive streak (see recordQuizCorrect). A miss
 * doesn't reset the count, and the flag only ever gets set, never
 * cleared, by the quiz — the learner can still manually un-mark a word
 * by tapping its row regardless of this count. */
const QUIZ_MEMORIZE_THRESHOLD = 3;

type Filter = "all" | "memorized" | "learning";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "learning", label: "학습 단어" },
  { value: "memorized", label: "외운 단어" },
];

/** Yesterday's date key, in local time — used only to size the "오늘
 * 복습할 단어" card (see below); computed via Date's own day-rollover
 * arithmetic rather than subtracting 86400000ms, which breaks across a
 * DST transition. */
function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateKey(d);
}

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

  // Same reasoning as StampCollectionView's identical subscription: a
  // word collected elsewhere (an entry's review landing, which is what
  // `notifyDiaryStamped` actually signals — same save, just named for its
  // stamp side) only shows up here after a genuinely fresh mount
  // otherwise, and Next's client-side router cache can restore this
  // screen's previous render (still holding its old `words` state) on a
  // back/forward navigation without re-running the mount effect above.
  useEffect(() => {
    return onDiaryStamped(() => {
      load();
    });
  }, [load]);

  const memorizedCount = useMemo(() => words?.filter((w) => w.memorized).length ?? 0, [words]);

  // Scopes 단어 테스트 to recently-learned, not-yet-memorized words when
  // there are enough of them — no real spaced-repetition schedule behind
  // this (there's no per-word "next due" data at all), just an
  // approximation from what collectWords already returns. The "오늘
  // 복습할 단어" card that used to surface this same set on its own has
  // been hidden; this quiet scoping is what's left of it.
  const reviewQueue = useMemo(() => {
    if (!words) return [];
    const today = todayKey();
    const yesterday = yesterdayKey();
    return words.filter((w) => !w.memorized && (w.lastSeen === today || w.lastSeen === yesterday));
  }, [words]);

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
  // "복습 시작" quizzes the review queue specifically when it's big enough
  // to make a real round — otherwise falls back to the full pool rather
  // than refusing to start one at all.
  const reviewQuizPool = useMemo(() => {
    const scoped = reviewQueue.filter((w) => w.meaning);
    return scoped.length >= QUIZ_MIN_WORDS ? scoped : quizPool;
  }, [reviewQueue, quizPool]);

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

  /** Bumps a word's quiz-correct count and, once it crosses
   * QUIZ_MEMORIZE_THRESHOLD, its `memorized` flag — passed to WordQuiz as
   * `onCorrect`. Returns whether this exact tap is the one that just
   * crossed the threshold (for WordQuiz's round-end summary). Not
   * reverted on failure the way `toggle` reverts its optimistic flip:
   * this fires many times in a row while the learner is mid-quiz, and a
   * failed background sync isn't worth a reversion (or a toast)
   * interrupting that — the next `load()` reconciles it regardless. */
  async function handleQuizCorrect(word: WordItem): Promise<boolean> {
    const key = wordKey(word.text, word.reading);
    const nextCount = word.quizCorrectCount + 1;
    const justMemorized = !word.memorized && nextCount >= QUIZ_MEMORIZE_THRESHOLD;
    setWords(
      (prev) =>
        prev?.map((w) =>
          wordKey(w.text, w.reading) === key
            ? { ...w, quizCorrectCount: nextCount, memorized: w.memorized || justMemorized }
            : w
        ) ?? prev
    );
    try {
      await recordQuizCorrect(
        userId,
        word.text,
        word.reading,
        word.kind,
        word.quizCorrectCount,
        word.memorized,
        QUIZ_MEMORIZE_THRESHOLD
      );
    } catch (err) {
      console.error(err);
    }
    return justMemorized;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <Link
        href="/"
        className="flex w-fit items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
          ←
        </UiIcon>
        캘린더
      </Link>

      {words === null && <p className="text-sm text-[var(--ink-soft)]">불러오는 중…</p>}

      {words !== null && (
        <>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-[family-name:var(--font-heading)] text-5xl font-bold text-[var(--ink)]">
                {words.length}
              </p>
              <p className="text-sm text-[var(--ink-soft)]">모은 단어</p>
            </div>
            <div className="text-right text-sm text-[var(--ink-soft)]">
              <p>
                학습 단어{" "}
                <span className="font-medium text-[var(--ink)]">{words.length - memorizedCount}</span>
              </p>
              <p>
                외운 단어 <span className="font-medium text-[var(--ink)]">{memorizedCount}</span>
              </p>
            </div>
          </div>

          {words.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">
              아직 모은 단어가 없어요. 일기를 쓰고 첨삭을 받으면 여기에 쌓여요.
            </p>
          ) : (
            <>
              {/* Below the min, a round would either be too short to bother
                  with or not really be the "10" the feature is about —
                  quietly hidden rather than offered half-empty. */}
              {!quizzing && quizPool.length >= QUIZ_MIN_WORDS && (
                <button
                  type="button"
                  onClick={() => setQuizzing(true)}
                  className="flex items-center gap-3 bg-[var(--shu)] px-4 py-3.5 text-left text-white shadow-sm transition hover:opacity-90"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-white/20">
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
                  {/* Layout/color classes go on this wrapping span, not on
                      UiIcon's own `className` — its no-override fallback
                      renders `children` inside a plain hardcoded span and
                      doesn't forward the prop, so `ml-auto` etc. would
                      silently never reach the DOM. */}
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

              {!quizzing && (
                <div className="flex gap-2">
                  {FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFilter(f.value)}
                      className={`px-4 py-2 text-sm font-medium transition ${
                        filter === f.value
                          ? "bg-[var(--ink)] text-[var(--paper)]"
                          : "border border-[var(--paper-line)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {quizzing ? (
                <WordQuiz
                  pool={reviewQuizPool}
                  onClose={() => setQuizzing(false)}
                  onCorrect={handleQuizCorrect}
                />
              ) : (
                <>
                  <hr className="border-t border-[var(--ink)]" />

                  {visible.length === 0 ? (
                    <p className="text-sm text-[var(--ink-soft)]">해당하는 단어가 없어요.</p>
                  ) : (
                    <div className="flex flex-col">
                      {visible.map((w, i) => {
                        const key = wordKey(w.text, w.reading);
                        // A word marked memorized by hand (not via 3 quiz
                        // passes) still shows all 3 squares filled — they
                        // track "done", not literally quiz_correct_count
                        // once that's true.
                        const filled = w.memorized
                          ? QUIZ_MEMORIZE_THRESHOLD
                          : Math.min(w.quizCorrectCount, QUIZ_MEMORIZE_THRESHOLD);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggle(w)}
                            aria-label={
                              w.memorized
                                ? `${w.text} — 외운 단어, 눌러서 취소`
                                : `${w.text} — 퀴즈 통과 ${filled}/${QUIZ_MEMORIZE_THRESHOLD}, 눌러서 외운 단어로 표시`
                            }
                            className={`flex flex-col gap-1 py-4 text-left ${
                              i > 0 ? "border-t border-[var(--paper-line)]" : ""
                            }`}
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="flex items-baseline gap-2">
                                <span className="font-[family-name:var(--font-diary)] text-xl font-bold text-[var(--ink)]">
                                  <FuriganaText
                                    text={w.text}
                                    readings={[{ text: w.text, reading: w.reading, kind: w.kind }]}
                                  />
                                </span>
                              </span>
                              <span className="ml-auto flex shrink-0 items-center gap-1">
                                {Array.from({ length: QUIZ_MEMORIZE_THRESHOLD }).map((_, i2) => (
                                  <span
                                    key={i2}
                                    aria-hidden="true"
                                    className={`h-2 w-2 ${
                                      i2 < filled
                                        ? "bg-[var(--ink)]"
                                        : "border border-[var(--paper-line)]"
                                    }`}
                                  />
                                ))}
                              </span>
                            </div>
                            {/* Empty for a word saved before `meaning` was
                                collected — no placeholder text, just one
                                fewer line for that row. */}
                            {w.meaning && <p className="text-sm text-[var(--ink)]">{w.meaning}</p>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
