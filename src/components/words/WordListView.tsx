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
import { parseDateKey } from "@/lib/utils/date";

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
    return [...filtered].sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
  }, [words, filter]);

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

      {words && words.length > 0 && (
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
                <span className="font-[family-name:var(--font-diary)] text-lg font-medium text-[var(--ink)]">
                  <FuriganaText text={w.text} readings={[{ text: w.text, reading: w.reading, kind: w.kind }]} />
                </span>
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
    </div>
  );
}
