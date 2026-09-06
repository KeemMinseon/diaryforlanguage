"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import HankoStamp from "@/components/stamps/HankoStamp";
import { buildHighlightSegments } from "@/lib/review/highlight";
import { parseDateKey } from "@/lib/utils/date";
import type { DiaryEntry } from "@/types/diary";

export default function ReviewView({
  entry,
  photoUrl,
}: {
  entry: DiaryEntry;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const segments = buildHighlightSegments(entry.content, entry.suggestions);
  const isReviewed = entry.status === "reviewed";
  const isPending = entry.status === "pending";
  const isFailed = entry.status === "failed";

  const dateLabel = parseDateKey(entry.entry_date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          ← 캘린더
        </button>
        <p className="font-[family-name:var(--font-heading)] text-sm text-[var(--ink-soft)]">
          {dateLabel}
        </p>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative w-28 shrink-0 self-start">
          <DiaryStamp
            stampKind={entry.stamp_kind}
            stampKey={entry.stamp_key as never}
            photoUrl={photoUrl}
            className="w-full drop-shadow-md"
          />
          {isReviewed && (
            <HankoStamp className="stamp-pop absolute -bottom-[10%] -right-[14%] w-[56%]" />
          )}
        </div>

        <div className="flex-1 rounded-2xl border border-[var(--paper-line)] bg-[var(--paper-raised)] p-5">
          {isPending && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--paper-line)]/50 px-3 py-1 text-xs text-[var(--ink-soft)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--shu-soft)]" />
              添削 검토 중이에요…
            </p>
          )}
          {isFailed && (
            <p className="mb-4 text-xs text-[var(--shu)]">
              첨삭 처리 중 문제가 있었어요. 다시 저장하면 재시도돼요.
            </p>
          )}

          <p className="whitespace-pre-wrap font-[family-name:var(--font-diary)] text-lg leading-loose text-[var(--ink)]">
            {segments.map((seg, i) =>
              seg.suggestionIndex === null ? (
                <span key={i}>{seg.text}</span>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() =>
                    setActiveIndex((cur) => (cur === seg.suggestionIndex ? null : seg.suggestionIndex))
                  }
                  className={`rounded px-0.5 underline decoration-[var(--shu)] decoration-2 underline-offset-4 transition ${
                    activeIndex === seg.suggestionIndex ? "bg-[var(--shu-soft)]/30" : "bg-[var(--shu-soft)]/10"
                  }`}
                >
                  {seg.text}
                </button>
              )
            )}
          </p>
        </div>
      </div>

      {isReviewed && (
        <>
          <section className="rounded-2xl border border-[var(--shu-soft)]/40 bg-white p-5">
            <h2 className="mb-2 font-[family-name:var(--font-heading)] text-sm text-[var(--shu)]">
              총평
            </h2>
            <p className="text-sm leading-relaxed text-[var(--ink)]">{entry.overall_comment}</p>
          </section>

          {entry.suggestions.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-[family-name:var(--font-heading)] text-sm text-[var(--shu)]">
                단어 · 표현 제안
              </h2>
              {entry.suggestions.map((s, i) => (
                <div
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    activeIndex === i
                      ? "border-[var(--shu)] bg-[var(--shu-soft)]/10"
                      : "border-[var(--paper-line)] bg-[var(--paper-raised)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-[var(--ink-soft)] line-through decoration-[var(--shu)]/60">
                      {s.original}
                    </span>
                    <span aria-hidden="true">→</span>
                    <span className="font-[family-name:var(--font-diary)] font-medium text-[var(--ink)]">
                      {s.suggestion}
                    </span>
                  </div>
                  {s.note && <p className="mt-1.5 text-xs text-[var(--ink-soft)]">{s.note}</p>}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
