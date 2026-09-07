"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PhotoCropModal from "@/components/editor/PhotoCropModal";
import UiIcon from "@/components/icons/UiIcon";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import FuriganaText from "@/components/review/FuriganaText";
import ReadingsHint from "@/components/review/ReadingsHint";
import { useToast } from "@/components/toast/ToastProvider";
import { pickStamp } from "@/lib/stamps/keywordMap";
import { saveEntry, uploadStampPhoto } from "@/lib/diary/client";
import { parseDateKey } from "@/lib/utils/date";
import type { DiaryEntry, DiaryParagraph, Reading, Suggestion } from "@/types/diary";

interface FeedbackRound {
  text: string;
  comment: string;
  suggestions: Suggestion[];
  readings: Reading[];
  savedAt: string;
}

/** How much of `text` matches `prefix` from the start. */
function commonPrefixLength(prefix: string, text: string): number {
  const max = Math.min(prefix.length, text.length);
  let i = 0;
  while (i < max && prefix[i] === text[i]) i++;
  return i;
}

/** Rebuilds the rounds feed from a previously saved entry, so reopening it
 * to add more shows the same per-paragraph history instead of starting
 * blank. An entry saved before `paragraphs` existed has none — fall back
 * to one untimed round covering everything already there, rather than
 * losing that day's suggestions/readings from the feed entirely. */
function initialRoundsFrom(entry?: DiaryEntry): FeedbackRound[] {
  if (!entry) return [];
  if (entry.paragraphs.length > 0) {
    return entry.paragraphs.map((p: DiaryParagraph) => ({
      text: p.text,
      comment: p.comment,
      suggestions: p.suggestions,
      readings: p.readings,
      savedAt: p.savedAt,
    }));
  }
  if (!entry.content.trim()) return [];
  return [
    {
      text: entry.content,
      comment: entry.overall_comment ?? "",
      suggestions: entry.suggestions,
      readings: entry.readings,
      savedAt: entry.reviewed_at ?? entry.updated_at,
    },
  ];
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Just the time (e.g. "오후 9:12") when saved the same local day as the
 * entry itself; full date + time when it was added on a later day (the
 * "이어서 쓰기" case), so that's not ambiguous. */
function formatSavedAt(iso: string, entryDateKey: string): string {
  const saved = new Date(iso);
  if (localDateKey(saved) === entryDateKey) {
    return saved.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  }
  return saved.toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ChatEditor({
  userId,
  dateKey,
  initialEntry,
  existingPhotoUrl,
}: {
  userId: string;
  dateKey: string;
  /** When reopening a day that already has an entry, to add more to it
   * ("이어서 쓰기") — pre-fills the box and feed from what's already saved. */
  initialEntry?: DiaryEntry;
  existingPhotoUrl?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // The whole diary-so-far, one continuously editable box — never wiped
  // after a review, so the learner never has to retype anything.
  // `reviewedPrefix` marks how much of it has already been sent for review;
  // only the part of `content` past that point counts as "new" next time.
  const [content, setContent] = useState(initialEntry?.content ?? "");
  const [reviewedPrefix, setReviewedPrefix] = useState(initialEntry?.content ?? "");
  const [rounds, setRounds] = useState<FeedbackRound[]>(() => initialRoundsFrom(initialEntry));
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [keepExistingPhoto, setKeepExistingPhoto] = useState(
    Boolean(initialEntry && initialEntry.stamp_kind === "photo" && initialEntry.photo_path)
  );

  useEffect(() => {
    return () => {
      if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    };
  }, [croppedPreviewUrl]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [rounds.length, sending]);

  const dateLabel = parseDateKey(dateKey).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // Text typed since the last successful review (based on where it stops
  // matching what was already reviewed, not a fixed offset — so editing
  // something earlier in the box doesn't desync the split point too badly).
  const pendingText = content.slice(commonPrefixLength(reviewedPrefix, content));
  const hasPhoto = Boolean(croppedPreviewUrl) || keepExistingPhoto;
  const previewPhotoUrl = croppedPreviewUrl ?? (keepExistingPhoto ? (existingPhotoUrl ?? null) : null);
  const previewStampKey = hasPhoto ? null : pickStamp(content);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setRawImageUrl(URL.createObjectURL(file));
  }

  function handleCropConfirm(blob: Blob) {
    if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    setCroppedBlob(blob);
    setCroppedPreviewUrl(URL.createObjectURL(blob));
    setKeepExistingPhoto(false);
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setRawImageUrl(null);
  }

  function handleRemovePhoto() {
    if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    setCroppedBlob(null);
    setCroppedPreviewUrl(null);
    setKeepExistingPhoto(false);
  }

  async function reviewChunk(chunk: string, priorText: string): Promise<FeedbackRound> {
    const res = await fetch("/api/review-paragraph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paragraph: chunk, priorText }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "첨삭 요청에 실패했어요.");
    return {
      text: chunk,
      comment: data.comment,
      suggestions: data.suggestions ?? [],
      readings: data.readings ?? [],
      savedAt: new Date().toISOString(),
    };
  }

  async function handleSend() {
    const chunk = pendingText.trim();
    if (!chunk || sending) return;
    setError(null);
    setSending(true);
    try {
      const round = await reviewChunk(chunk, reviewedPrefix);
      setRounds((prev) => [...prev, round]);
      setReviewedPrefix(content);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "첨삭 요청에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  }

  async function handleFinish() {
    if (!content.trim() || finishing) return;
    setError(null);
    setFinishing(true);
    try {
      // Anything typed but not yet reviewed gets one last pass so it's not
      // saved without feedback/furigana just because the learner never
      // hit "검토 요청" on it themselves.
      let allRounds = rounds;
      const chunk = pendingText.trim();
      if (chunk) {
        const round = await reviewChunk(chunk, reviewedPrefix);
        allRounds = [...rounds, round];
        setRounds(allRounds);
        setReviewedPrefix(content);
      }

      const fullText = content;

      let photoPath: string | null = null;
      const stampKind: "photo" | "keyword" = hasPhoto ? "photo" : "keyword";
      if (croppedBlob) {
        photoPath = await uploadStampPhoto(userId, dateKey, croppedBlob);
      } else if (keepExistingPhoto) {
        photoPath = initialEntry?.photo_path ?? null;
      }

      const finalizeRes = await fetch("/api/review-finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullText }),
      });
      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeData.error ?? "총평 생성에 실패했어요.");

      const allSuggestions = allRounds.flatMap((r) => r.suggestions);
      const allReadings = allRounds.flatMap((r) => r.readings);
      const paragraphs: DiaryParagraph[] = allRounds.map((r) => ({
        text: r.text,
        comment: r.comment,
        suggestions: r.suggestions,
        readings: r.readings,
        savedAt: r.savedAt,
      }));

      await saveEntry({
        userId,
        dateKey,
        content: fullText,
        stampKind,
        stampKey: stampKind === "keyword" ? pickStamp(fullText) : null,
        photoPath,
        status: "reviewed",
        overallComment: finalizeData.overallComment,
        suggestions: allSuggestions,
        readings: allReadings,
        paragraphs,
      });

      toast(
        initialEntry
          ? "이어서 쓴 내용까지 添削 도장이 다시 찍혔어요! 📮"
          : "오늘 일기에 添削 도장이 찍혔어요! 📮"
      );
      const month = dateKey.slice(0, 7);
      router.push(`/?month=${month}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "마무리에 실패했어요. 다시 시도해 주세요.");
      setFinishing(false);
    }
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  const busy = sending || finishing;

  return (
    // Fixed to the viewport height (not the page's natural scroll height) so
    // the feedback feed and the compose area below split the screen and
    // scroll independently — previously this whole block just grew with
    // every sent paragraph, pushing the input further down each time and
    // forcing a scroll-hunt for it (which read as "having to start over").
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4 py-4">
      <header className="flex shrink-0 items-center justify-between pb-3">
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

      {/* Top half: feedback so far, scrolls on its own. The learner's own
          text stays only in the box below — it's never echoed back up here. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1">
        {rounds.length === 0 && !sending && (
          <p className="text-sm text-[var(--ink-soft)]">
            오늘 하루는 어땠나요? 편하게 적어보세요 — 한 문단씩 보낼 때마다 짧은 피드백을 드릴게요.
          </p>
        )}
        {rounds.map((r, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg bg-black/[0.035] px-3 py-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ink-soft)]" />
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] text-[var(--ink-soft)]/70">{formatSavedAt(r.savedAt, dateKey)}</p>
              <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{r.comment}</p>
              <ReadingsHint readings={r.readings} label="읽는 법" />
              {r.suggestions.map((s, j) => (
                <span
                  key={j}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--paper-line)] bg-white px-2.5 py-0.5 text-[12.5px]"
                >
                  <span className="text-[var(--ink-soft)] line-through">
                    <FuriganaText text={s.original} readings={r.readings} />
                  </span>
                  <span aria-hidden="true">→</span>
                  <span className="font-[family-name:var(--font-diary)] text-[var(--ink)]">
                    <FuriganaText text={s.suggestion} readings={r.readings} />
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 rounded-lg bg-black/[0.035] px-3 py-2.5">
            <span className="flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--ink-soft)]"
                style={{ animation: "typing-bounce 1.1s ease-in-out infinite", animationDelay: "0ms" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--ink-soft)]"
                style={{ animation: "typing-bounce 1.1s ease-in-out infinite", animationDelay: "150ms" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--ink-soft)]"
                style={{ animation: "typing-bounce 1.1s ease-in-out infinite", animationDelay: "300ms" }}
              />
            </span>
            <p className="text-[12.5px] text-[var(--ink-soft)]">검토하고 있어요</p>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Bottom half: everything about writing the next paragraph, pinned in place.
          Weighted heavier than the feed above — this half also carries the
          stamp bar and the full-width finish button, so giving it the same
          flex-1 as the feed left the actual textarea box visibly smaller
          than the feed area even though the two halves were equal height. */}
      <div className="flex min-h-0 flex-[1.4] flex-col gap-2 border-t border-[var(--paper-line)] pt-3">
        <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-2xl border border-[var(--paper-line)] bg-[var(--paper-raised)] p-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="여기에 이어서 편하게 적어주세요…"
            disabled={busy}
            rows={3}
            className="min-h-0 flex-1 resize-none bg-transparent font-[family-name:var(--font-diary)] text-[15px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)] disabled:opacity-60"
          />
          <div className="flex shrink-0 justify-end">
            <button
              type="button"
              onClick={handleSend}
              disabled={!pendingText.trim() || busy}
              className="rounded-full border border-[var(--ink)] px-4 py-1.5 text-[12.5px] font-medium text-[var(--ink)] disabled:opacity-40"
            >
              {sending ? "검토 중…" : "검토 요청"}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-[var(--paper-line)] bg-[var(--paper-raised)] px-2.5 py-2">
          <div className="w-10 shrink-0">
            <DiaryStamp
              stampKind={hasPhoto ? "photo" : "keyword"}
              stampKey={previewStampKey}
              photoUrl={previewPhotoUrl}
              className="w-full"
            />
          </div>
          <p className="flex-1 text-[11px] leading-snug text-[var(--ink-soft)]">
            쓴 내용에 맞는 우표가 자동으로 붙어요.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--paper-line)] bg-white px-2.5 py-1.5 text-[11px] text-[var(--ink)]"
          >
            <UiIcon name="camera" className="h-3.5 w-3.5" alt="">
              📷
            </UiIcon>
            사진
          </button>
          {hasPhoto && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="shrink-0 text-[11px] text-[var(--ink-soft)] underline underline-offset-2"
            >
              지우기
            </button>
          )}
        </div>

        {error && <p className="shrink-0 text-sm font-medium text-[var(--ink)]">{error}</p>}

        <button
          type="button"
          onClick={handleFinish}
          disabled={!content.trim() || busy}
          className="shrink-0 w-full rounded-full bg-[var(--ink)] px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-40"
        >
          {finishing ? "마무리하는 중…" : initialEntry ? "이어서 쓴 일기 마치기" : "오늘 일기 마치기"}
        </button>
      </div>

      {rawImageUrl && (
        <PhotoCropModal
          imageSrc={rawImageUrl}
          onCancel={() => {
            URL.revokeObjectURL(rawImageUrl);
            setRawImageUrl(null);
          }}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
