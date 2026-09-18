"use client";

import { useEffect, useRef, useState } from "react";
import PhotoCropModal from "@/components/editor/PhotoCropModal";
import UiIcon from "@/components/icons/UiIcon";
import FuriganaText from "@/components/review/FuriganaText";
import ReadingsHint from "@/components/review/ReadingsHint";
import { useToast } from "@/components/toast/ToastProvider";
import { saveEntry, uploadStampPhoto } from "@/lib/diary/client";
import { notifyDiaryStamped } from "@/lib/events/diaryStamped";
import { applyCorrections } from "@/lib/review/highlight";
import { pickStamp } from "@/lib/stamps/keywordMap";
import { pickStampVariant } from "@/lib/stamps/stampVariants";
import { formatSavedAt } from "@/lib/utils/date";
import type { DiaryEntry, DiaryParagraph, Reading, SessionStamp, Suggestion } from "@/types/diary";

interface ReviewResult {
  comment: string;
  suggestions: Suggestion[];
  readings: Reading[];
  translation: string;
}

/** Same dedup rule as ChatEditor/EditEntry's own combined `readings` —
 * the same word reviewed independently in two different sittings would
 * otherwise count twice in one entry's `readings`, inflating 단어장's
 * occurrence count for a word that just happened to appear in two
 * paragraphs the same day. */
function dedupeReadings(readings: Reading[]): Reading[] {
  const seen = new Set<string>();
  return readings.filter((r) => {
    const key = `${r.text}␟${r.reading}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Edits exactly one paragraph (one "이어서 쓰기" sitting) in place — every
 * other paragraph, and every other session's own stamp, is carried
 * through to the save untouched. This is what keeps a multi-sitting day's
 * other stamps from disappearing the way merging the whole day back down
 * to one editable block would (see the conversation that led here):
 * `stamps`/`paragraphs` are rebuilt by replacing just this one entry in
 * the full arrays, never by re-deriving the day from scratch.
 *
 * Requires a fresh 첨삭 on the *current* text before "수정 완료" is
 * enabled — unless the text hasn't actually changed from what's already
 * saved, in which case there's nothing new to review (a photo-only change
 * saves immediately). `reviewedForText` tracks which exact string the
 * held `reviewResult` answers for, so editing further after running 첨삭
 * invalidates it again without needing to explicitly clear anything.
 */
export default function EditParagraph({
  userId,
  entry,
  paragraphs,
  stamps,
  targetSession,
  existingPhotoUrl,
  onCancel,
  onSaved,
}: {
  userId: string;
  entry: DiaryEntry;
  /** The full day's paragraphs, already normalized (legacy-entry fallback
   * applied) by the caller — see ReviewView's own `paragraphs`. */
  paragraphs: DiaryParagraph[];
  /** The full day's resolved stamps — see ReviewView's own `stamps`. */
  stamps: SessionStamp[];
  targetSession: number;
  /** Resolved public URL for this session's own photo, if it has one —
   * computed by the caller (ReviewView already has this logic for every
   * session's stamp) rather than re-deriving it here. */
  existingPhotoUrl: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const targetIndex = paragraphs.findIndex((p) => (p.session ?? 0) === targetSession);
  const target = paragraphs[targetIndex];
  const prev = targetIndex > 0 ? paragraphs[targetIndex - 1] : null;
  const next = targetIndex < paragraphs.length - 1 ? paragraphs[targetIndex + 1] : null;
  const precedingText = paragraphs
    .slice(0, targetIndex)
    .map((p) => p.text)
    .join("\n\n");
  const targetStamp = stamps.find((s) => s.session === targetSession);
  const hasPhoto = targetStamp?.stampKind === "photo";

  const [text, setText] = useState(target.text);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewedForText, setReviewedForText] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Photo controls only ever touch a session that *already* owns the
  // day's photo — every session's photo shares one fixed storage path
  // keyed by day, not by session (see uploadStampPhoto's own doc
  // comment: `${userId}/${dateKey}.jpg`, always the same file) — letting
  // a *different* session start a fresh upload here would silently
  // overwrite whichever session's photo already lives at that path
  // instead of giving this one its own. `hasPhoto` (above) gates every
  // photo affordance in this screen on that basis.
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [keepExistingPhoto, setKeepExistingPhoto] = useState(hasPhoto);

  useEffect(() => {
    return () => {
      if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    };
  }, [croppedPreviewUrl]);

  const textChanged = text.trim() !== target.text.trim();
  const hasFreshReview = reviewResult !== null && reviewedForText === text;
  const canSave = text.trim() !== "" && (!textChanged || hasFreshReview) && !saving && !reviewing;

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

  async function handleReview() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setReviewing(true);
    setError(null);
    try {
      const res = await fetch("/api/review-paragraph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paragraph: trimmed, priorText: precedingText }),
        signal: AbortSignal.timeout(50_000),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "첨삭 요청에 실패했어요.");
      setReviewResult({
        comment: typeof data.comment === "string" ? data.comment : "",
        suggestions: data.suggestions ?? [],
        readings: data.readings ?? [],
        translation: typeof data.translation === "string" ? data.translation : "",
      });
      setReviewedForText(text);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "첨삭 요청에 실패했어요.");
    } finally {
      setReviewing(false);
    }
  }

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("일기 내용을 적어주세요.");
      return;
    }
    setSaving(true);
    setError(null);

    let newPhotoPath: string | null = targetStamp?.photoPath ?? null;
    try {
      if (croppedBlob) {
        newPhotoPath = await uploadStampPhoto(userId, entry.entry_date, croppedBlob);
      } else if (hasPhoto && !keepExistingPhoto) {
        newPhotoPath = null;
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "사진 업로드에 실패했어요. 다시 시도해 주세요.");
      setSaving(false);
      return;
    }

    const keepsPhoto = Boolean(croppedBlob) || (hasPhoto && keepExistingPhoto);
    const newStamp: SessionStamp = keepsPhoto
      ? {
          session: targetSession,
          stampKind: "photo",
          stampKey: null,
          stampVariant: null,
          photoPath: newPhotoPath,
          createdAt: new Date().toISOString(),
        }
      : hasPhoto && !keepExistingPhoto
        ? // Photo removed — falls back to an auto-picked keyword, same as
          // ChatEditor/EditEntry when a sitting ends up with no photo.
          (() => {
            const keywordId = pickStamp(trimmed);
            return {
              session: targetSession,
              stampKind: "keyword" as const,
              stampKey: keywordId,
              stampVariant: pickStampVariant(keywordId),
              photoPath: null,
              createdAt: new Date().toISOString(),
            };
          })()
        : textChanged
          ? (() => {
              const keywordId = pickStamp(trimmed);
              return {
                session: targetSession,
                stampKind: "keyword" as const,
                stampKey: keywordId,
                stampVariant: pickStampVariant(keywordId),
                photoPath: null,
                createdAt: new Date().toISOString(),
              };
            })()
          : // Nothing that would change this session's stamp — keep it
            // exactly as-is rather than re-rolling a new random variant
            // for text that never actually changed.
            (targetStamp ?? {
              session: targetSession,
              stampKind: "keyword",
              stampKey: pickStamp(trimmed),
              stampVariant: null,
              photoPath: null,
              createdAt: new Date().toISOString(),
            });

    const newParagraph: DiaryParagraph = hasFreshReview
      ? {
          text: trimmed,
          comment: reviewResult.comment,
          suggestions: reviewResult.suggestions,
          readings: reviewResult.readings,
          translation: reviewResult.translation,
          savedAt: new Date().toISOString(),
          session: targetSession,
        }
      : { ...target, text: trimmed };

    const newParagraphs = paragraphs.map((p, i) => (i === targetIndex ? newParagraph : p));
    const newStamps = stamps.map((s) => (s.session === targetSession ? newStamp : s));

    // Photo always wins the calendar/top-level spot, same convention as
    // ChatEditor's own `frontStamp` — regardless of which sitting it came
    // from or whether it's the one just edited here.
    const front = newStamps.find((s) => s.stampKind === "photo") ?? newStamps[0];
    const allSuggestions = newParagraphs.flatMap((p) => p.suggestions);
    const allReadings = dedupeReadings(newParagraphs.flatMap((p) => p.readings));

    try {
      await saveEntry({
        userId,
        dateKey: entry.entry_date,
        content: newParagraphs.map((p) => p.text).join("\n\n"),
        stampKind: front.stampKind,
        stampKey: front.stampKey,
        stampVariant: front.stampVariant,
        photoPath: front.photoPath,
        status: "reviewed",
        title: entry.title,
        overallComment: entry.overall_comment,
        suggestions: allSuggestions,
        readings: allReadings,
        paragraphs: newParagraphs,
        stamps: newStamps,
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "저장에 실패했어요. 다시 시도해 주세요.");
      setSaving(false);
      return;
    }

    toast("수정한 내용을 저장했어요.");
    notifyDiaryStamped(entry.entry_date);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-sm text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
        >
          취소
        </button>
        <p className="text-xs text-[var(--ink-soft)]">
          {formatSavedAt(target.savedAt, entry.entry_date)} 수정
        </p>
      </header>

      {prev && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] tracking-wide text-[var(--ink-tertiary)]">
            앞 대목 {formatSavedAt(prev.savedAt, entry.entry_date)}
          </p>
          <p className="truncate font-[family-name:var(--font-diary)] text-sm text-[var(--ink-soft)]">
            {applyCorrections(prev.text, prev.suggestions)}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 bg-[var(--card-highlight)] p-4 border border-[var(--paper-line)]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={saving}
          autoFocus
          className="min-h-[16vh] w-full resize-none bg-transparent font-[family-name:var(--font-diary)] text-lg leading-relaxed text-[var(--ink)] outline-none disabled:opacity-60"
        />
        {hasPhoto && (
          <div className="flex items-center gap-3">
            <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden bg-[var(--paper-line)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, dimensions unknown ahead of time */}
              <img
                src={croppedPreviewUrl ?? existingPhotoUrl ?? undefined}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            {keepExistingPhoto && !croppedBlob && (
              <span className="text-xs text-[var(--ink-soft)]">사진 1 · 이 대목의 사진우표</span>
            )}
          </div>
        )}
      </div>

      {/* Same "고칠 곳" card ChatEditor shows for its own latest 첨삭 —
          only for this one paragraph's fresh review, gated on `hasFreshReview`
          so editing further after running 첨삭 hides a now-stale result
          instead of showing corrections for text that's since changed. */}
      {hasFreshReview && reviewResult.suggestions.length > 0 && (
        <section className="flex flex-col gap-3 bg-[var(--card-highlight)] p-4 border border-[var(--paper-line)]">
          <p className="font-mono text-xs tracking-wide text-[var(--ink-soft)]">
            고칠 곳 {reviewResult.suggestions.length}
          </p>
          {reviewResult.comment && (
            <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{reviewResult.comment}</p>
          )}
          <div className="flex flex-col gap-2.5">
            {reviewResult.suggestions.map((s, i) => (
              <div key={i} className="flex flex-col gap-0.5 border-l-2 border-[var(--paper-line)] pl-3">
                <p className="font-[family-name:var(--font-diary)] text-base text-[var(--ink)]">
                  <span className="text-[var(--ink-tertiary)] line-through decoration-1">
                    <FuriganaText text={s.original} readings={reviewResult.readings} />
                  </span>{" "}
                  → <FuriganaText text={s.suggestion} readings={reviewResult.readings} />
                </p>
                {s.note && <p className="text-xs text-[var(--ink-soft)]">{s.note}</p>}
              </div>
            ))}
          </div>
          <ReadingsHint readings={reviewResult.readings} label="읽는 법" />
        </section>
      )}

      {error && <p className="text-sm font-medium text-[var(--ink)]">{error}</p>}

      {next && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[10px] tracking-wide text-[var(--ink-tertiary)]">
            다음 대목 {formatSavedAt(next.savedAt, entry.entry_date)}
          </p>
          <p className="truncate font-[family-name:var(--font-diary)] text-sm text-[var(--ink-soft)]">
            {applyCorrections(next.text, next.suggestions)}
          </p>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2.5 border-t border-[var(--paper-line)] pt-3">
        {hasPhoto && (
          <>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              aria-label="사진 다시 선택"
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--ink)] text-[var(--ink)] disabled:opacity-60"
            >
              <UiIcon name="camera-line" className="h-4 w-4" alt="">
                📷
              </UiIcon>
            </button>
            {(keepExistingPhoto || croppedBlob) && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={saving}
                className="shrink-0 text-[11px] text-[var(--ink-soft)] underline underline-offset-2 disabled:opacity-60"
              >
                지우기
              </button>
            )}
          </>
        )}
        <p className="flex-1 text-right font-mono text-[11px] text-[var(--ink-soft)]">이 대목 {text.length}자</p>
        <button
          type="button"
          onClick={handleReview}
          disabled={!text.trim() || reviewing || saving}
          className="shrink-0 border border-[var(--ink)] px-4 py-2 text-[12.5px] font-medium text-[var(--ink)] disabled:opacity-40"
        >
          {reviewing ? "확인 중…" : "첨삭"}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="shrink-0 bg-[var(--cta)] px-5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
        >
          {saving ? "저장 중…" : "수정 완료"}
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
