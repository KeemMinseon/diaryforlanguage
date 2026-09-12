"use client";

import { useMemo, useState } from "react";
import FuriganaText from "@/components/review/FuriganaText";
import { wordKey, type WordItem } from "@/lib/words/collectWords";

/** How many word/meaning pairs one round shows — capped to however many
 * the learner actually has a `meaning` for (see `quizPool` in
 * WordListView), so a small early vocabulary still gets a round instead
 * of nothing. */
const ROUND_SIZE = 6;

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** One round's word list (left column, its own draw order) and meaning
 * list (right column, independently reshuffled — otherwise row N of
 * both columns would always be the same pair, turning the "match them"
 * game into "read down the left column"). */
function drawRound(pool: WordItem[]): { words: WordItem[]; meanings: WordItem[] } {
  const words = shuffled(pool).slice(0, Math.min(ROUND_SIZE, pool.length));
  return { words, meanings: shuffled(words) };
}

type Selected = { side: "word" | "meaning"; key: string } | null;

/** The word column and meaning column show the *same* `WordItem`s (see
 * `drawRound` — `meanings` is just `words` reshuffled), so a plain
 * `Set<string>` of "wrong" keys doesn't work: word 十二月's key also
 * belongs to its own meaning card sitting at some other row, so marking
 * that key "wrong" would light up BOTH — including that other row, which
 * is exactly where the correct answer lives. Tracking wrong-ness per side
 * (one word-side key, one meaning-side key) keeps the flash on only the
 * two cards actually tapped. */
type WrongPair = { wordKey: string; meaningKey: string } | null;

/** How long a correct pair sits green-and-bouncing before settling into
 * the permanent gray "matched" look — long enough to read as a small
 * celebration, short enough not to stall the next pair. */
const CELEBRATE_MS = 550;

/** A tap-to-match quiz: pick a word, then pick its meaning (or the other
 * order) — no drag-and-drop, so it works as well with a mouse as with a
 * thumb. A correct pair pops green for a beat, then fades to the
 * permanent gray "matched" look; a wrong one flashes red on just the two
 * tapped cards for a moment, then clears the selection so the learner can
 * try again. Finishes once every pair in the round is matched. */
export default function WordQuiz({
  pool,
  onClose,
  onCorrect,
}: {
  pool: WordItem[];
  onClose: () => void;
  /** Called once a pair is confirmed correct (right as the celebration
   * starts, not after it settles) — WordListView owns the actual
   * "memorize after N correct matches" bookkeeping; this only needs to
   * know whether that tap just crossed the threshold, for the round-end
   * summary below. */
  onCorrect?: (word: WordItem) => Promise<boolean> | boolean;
}) {
  const [round, setRound] = useState(() => drawRound(pool));
  const [selected, setSelected] = useState<Selected>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  // A key sits here for CELEBRATE_MS right after a correct match, before
  // moving into `matched` — see cardClass and the `match-pop` keyframe.
  const [celebrating, setCelebrating] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<WrongPair>(null);
  const [misses, setMisses] = useState(0);
  // Words `onCorrect` reported as newly memorized this round — shown as a
  // small extra line on the round-end summary.
  const [newlyMemorized, setNewlyMemorized] = useState(0);

  const total = round.words.length;
  const done = matched.size === total && total > 0;

  const keyOf = useMemo(() => (w: WordItem) => wordKey(w.text, w.reading), []);
  const wordByKey = useMemo(
    () => new Map(round.words.map((w) => [keyOf(w), w])),
    [round.words, keyOf]
  );

  function restart() {
    setRound(drawRound(pool));
    setSelected(null);
    setMatched(new Set());
    setCelebrating(new Set());
    setWrongPair(null);
    setMisses(0);
    setNewlyMemorized(0);
  }

  function tap(side: "word" | "meaning", key: string) {
    if (matched.has(key) || celebrating.has(key) || wrongPair) return;

    if (!selected) {
      setSelected({ side, key });
      return;
    }
    if (selected.side === side) {
      // Tapping another card on the same side just moves the selection —
      // no penalty, since nothing was actually compared yet.
      setSelected(selected.key === key ? null : { side, key });
      return;
    }
    if (selected.key === key) {
      setSelected(null);
      setCelebrating((prev) => new Set(prev).add(key));
      const word = wordByKey.get(key);
      if (word && onCorrect) {
        Promise.resolve(onCorrect(word))
          .then((justMemorized) => {
            if (justMemorized) setNewlyMemorized((n) => n + 1);
          })
          .catch((err) => console.error(err));
      }
      setTimeout(() => {
        setMatched((prev) => new Set(prev).add(key));
        setCelebrating((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, CELEBRATE_MS);
      return;
    }
    setMisses((m) => m + 1);
    setWrongPair({
      wordKey: side === "word" ? key : selected.key,
      meaningKey: side === "meaning" ? key : selected.key,
    });
    setTimeout(() => {
      setWrongPair(null);
      setSelected(null);
    }, 500);
  }

  function cardClass(side: "word" | "meaning", key: string, isSelected: boolean): string {
    if (celebrating.has(key)) {
      return "border-emerald-400 bg-emerald-50 match-pop";
    }
    if (matched.has(key)) {
      return "border-[var(--paper-line)] bg-[var(--paper-raised)] opacity-40";
    }
    const isWrong = side === "word" ? wrongPair?.wordKey === key : wrongPair?.meaningKey === key;
    if (isWrong) {
      return "border-red-400 bg-red-50";
    }
    if (isSelected) {
      return "border-[var(--ink)] bg-black/5";
    }
    return "border-transparent bg-[var(--paper-raised)]";
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-[var(--paper-raised)] px-6 py-10 text-center">
        <p className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--ink)]">
          {total}개 다 맞췄어요! 📮
        </p>
        <p className="text-sm text-[var(--ink-soft)]">
          {misses === 0 ? "한 번에 다 맞혔어요." : `틀린 횟수 ${misses}번`}
        </p>
        {newlyMemorized > 0 && (
          <p className="text-sm font-medium text-[var(--shu)]">
            외운 단어로 새로 등록된 단어 {newlyMemorized}개 🎉
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={restart}
            className="rounded-full bg-[var(--cta)] px-6 py-2.5 text-sm font-medium text-white"
          >
            다시하기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--paper-line)] px-6 py-2.5 text-sm text-[var(--ink-soft)]"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--ink-soft)]">
          {matched.size}/{total}개 맞음 · 단어를 누르고 뜻을 눌러 짝지어 보세요
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-[var(--ink-soft)] underline underline-offset-2 hover:text-[var(--ink)]"
        >
          그만하기
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {round.words.map((w) => {
            const key = keyOf(w);
            return (
              <button
                key={key}
                type="button"
                onClick={() => tap("word", key)}
                disabled={matched.has(key) || celebrating.has(key)}
                className={`flex h-16 items-center rounded-xl border px-3 text-left font-[family-name:var(--font-diary)] text-base font-medium text-[var(--ink)] transition ${cardClass("word", key, selected?.side === "word" && selected.key === key)}`}
              >
                {/* Single-line truncation, not line-clamp-2: WebKit's line
                    box counting for `-webkit-line-clamp` doesn't reckon
                    with <ruby>'s extra annotation box the way it does plain
                    text, so it can clip mid-ruby and leave only a trailing
                    sliver of the furigana <rt> visible instead of the
                    kanji. Vocabulary words are short enough that a single
                    truncated line reads fine; the meaning column (plain
                    text, can run long) keeps the 2-line clamp. */}
                <span className="block w-full truncate">
                  <FuriganaText text={w.text} readings={[{ text: w.text, reading: w.reading, kind: w.kind }]} />
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {round.meanings.map((w) => {
            const key = keyOf(w);
            return (
              <button
                key={key}
                type="button"
                onClick={() => tap("meaning", key)}
                disabled={matched.has(key) || celebrating.has(key)}
                className={`flex h-16 items-center rounded-xl border px-3 text-left text-sm text-[var(--ink)] transition ${cardClass("meaning", key, selected?.side === "meaning" && selected.key === key)}`}
              >
                <span className="line-clamp-2">{w.meaning}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
