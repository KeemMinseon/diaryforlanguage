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

/** Same dedup rule used everywhere a day's paragraphs get flattened back
 * into one entry's top-level `readings` — the same word reviewed
 * independently in two different sittings would otherwise count twice. */
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
 * The "수정하기" screen — every paragraph (sitting) in the day, each
 * editable in place: tapping "수정" on a row swaps just that row into a
 * textarea (with a fresh 첨삭 required before it can save), while every
 * other row stays exactly as it was, giving natural "이전/다음" context
 * for free instead of needing separate preview blocks. Replaces the old
 * EditEntry (whole-day, all-textareas-at-once) screen entirely.
 *
 * Each row saves independently the moment its own "수정 완료"/"삭제" is
 * used — there's no single whole-screen "저장" step. `paragraphs`/
 * `stamps` are kept as this component's own local state (seeded from the
 * props once) so a save's result shows immediately without waiting on
 * the caller to refresh and hand back new props.
 */
export default function ParagraphListEditor({
  userId,
  entry,
  paragraphs: initialParagraphs,
  stamps: initialStamps,
  stampPhotoUrl,
  onExit,
}: {
  userId: string;
  entry: DiaryEntry;
  paragraphs: DiaryParagraph[];
  stamps: SessionStamp[];
  stampPhotoUrl: (s: SessionStamp) => string | null;
  onExit: () => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [paragraphs, setParagraphs] = useState(initialParagraphs);
  const [stamps, setStamps] = useState(initialStamps);
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [confirmingDeleteSession, setConfirmingDeleteSession] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [text, setText] = useState("");
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewedForText, setReviewedForText] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Photo controls only ever touch a session that *already* owns the
  // day's photo — every session's photo shares one fixed storage path
  // keyed by day, not by session (see uploadStampPhoto's own doc
  // comment), so letting a *different* session start a fresh upload here
  // would silently overwrite whichever session's photo already lives at
  // that path instead of giving this one its own.
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [keepExistingPhoto, setKeepExistingPhoto] = useState(false);

  useEffect(() => {
    return () => {
      if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    };
  }, [croppedPreviewUrl]);

  const editingIndex = paragraphs.findIndex((p) => (p.session ?? 0) === editingSession);
  const editingTarget = editingIndex !== -1 ? paragraphs[editingIndex] : null;
  const editingStamp = stamps.find((s) => s.session === editingSession);
  const editingHasPhoto = editingStamp?.stampKind === "photo";
  // A brand-new photo can only be *added* here if no other session already
  // owns the day's photo — every session's photo shares one fixed storage
  // path keyed by day (see uploadStampPhoto's own doc comment), so adding
  // one here while another session already has one would silently
  // overwrite that other session's photo file with this one's, even
  // though both stamps would still show their own (now identical, wrong)
  // `photoPath`. Replacing *this* session's own existing photo is always
  // fine — it already owns that one path.
  const otherSessionHasPhoto = stamps.some(
    (s) => s.session !== editingSession && s.stampKind === "photo"
  );
  const canTouchPhoto = editingHasPhoto || !otherSessionHasPhoto;

  const textChanged = editingTarget !== null && text.trim() !== editingTarget.text.trim();
  const hasFreshReview = reviewResult !== null && reviewedForText === text;
  const canSave = text.trim() !== "" && (!textChanged || hasFreshReview) && !saving && !reviewing;

  function startEditing(session: number) {
    const target = paragraphs.find((p) => (p.session ?? 0) === session);
    if (!target) return;
    const targetStamp = stamps.find((s) => s.session === session);
    setConfirmingDeleteSession(null);
    setEditingSession(session);
    setText(target.text);
    setReviewResult(null);
    setReviewedForText(null);
    setError(null);
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setRawImageUrl(null);
    if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    setCroppedBlob(null);
    setCroppedPreviewUrl(null);
    setKeepExistingPhoto(targetStamp?.stampKind === "photo");
  }

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

  function stopEditingSafely() {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    setEditingSession(null);
  }

  async function handleReview() {
    if (!editingTarget || editingIndex === -1) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const precedingText = paragraphs
      .slice(0, editingIndex)
      .map((p) => p.text)
      .join("\n\n");
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

  async function handleSaveRow() {
    if (!editingTarget || editingSession === null || editingIndex === -1) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError("일기 내용을 적어주세요.");
      return;
    }
    setSaving(true);
    setError(null);

    let newPhotoPath: string | null = editingStamp?.photoPath ?? null;
    try {
      if (croppedBlob) {
        newPhotoPath = await uploadStampPhoto(userId, entry.entry_date, croppedBlob);
      } else if (editingHasPhoto && !keepExistingPhoto) {
        newPhotoPath = null;
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "사진 업로드에 실패했어요. 다시 시도해 주세요.");
      setSaving(false);
      return;
    }

    const keepsPhoto = Boolean(croppedBlob) || (editingHasPhoto && keepExistingPhoto);
    const newStamp: SessionStamp = keepsPhoto
      ? {
          session: editingSession,
          stampKind: "photo",
          stampKey: null,
          stampVariant: null,
          photoPath: newPhotoPath,
          createdAt: new Date().toISOString(),
        }
      : editingHasPhoto && !keepExistingPhoto
        ? // Photo removed — falls back to an auto-picked keyword.
          (() => {
            const keywordId = pickStamp(trimmed);
            return {
              session: editingSession,
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
                session: editingSession,
                stampKind: "keyword" as const,
                stampKey: keywordId,
                stampVariant: pickStampVariant(keywordId),
                photoPath: null,
                createdAt: new Date().toISOString(),
              };
            })()
          : // Nothing that would change this session's stamp — keep it as-is.
            (editingStamp ?? {
              session: editingSession,
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
          session: editingSession,
        }
      : { ...editingTarget, text: trimmed };

    const newParagraphs = paragraphs.map((p, i) => (i === editingIndex ? newParagraph : p));
    const newStamps = stamps.map((s) => (s.session === editingSession ? newStamp : s));
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

    setParagraphs(newParagraphs);
    setStamps(newStamps);
    toast("수정한 내용을 저장했어요.");
    notifyDiaryStamped(entry.entry_date);
    setSaving(false);
    setEditingSession(null);
  }

  async function handleDelete(session: number) {
    if (paragraphs.length <= 1) return;
    setDeleting(true);
    const remainingParagraphs = paragraphs.filter((p) => (p.session ?? 0) !== session);
    const remainingStamps = stamps.filter((s) => s.session !== session);
    const front = remainingStamps.find((s) => s.stampKind === "photo") ?? remainingStamps[0];
    const allSuggestions = remainingParagraphs.flatMap((p) => p.suggestions);
    const allReadings = dedupeReadings(remainingParagraphs.flatMap((p) => p.readings));

    try {
      await saveEntry({
        userId,
        dateKey: entry.entry_date,
        content: remainingParagraphs.map((p) => p.text).join("\n\n"),
        stampKind: front.stampKind,
        stampKey: front.stampKey,
        stampVariant: front.stampVariant,
        photoPath: front.photoPath,
        status: "reviewed",
        title: entry.title,
        overallComment: entry.overall_comment,
        suggestions: allSuggestions,
        readings: allReadings,
        paragraphs: remainingParagraphs,
        stamps: remainingStamps,
      });
    } catch (err) {
      console.error(err);
      toast("삭제에 실패했어요. 다시 시도해 주세요.");
      setDeleting(false);
      return;
    }

    setParagraphs(remainingParagraphs);
    setStamps(remainingStamps);
    toast("이 대목을 지웠어요.");
    setDeleting(false);
    setConfirmingDeleteSession(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
            ←
          </UiIcon>
          완료
        </button>
        <p className="text-xs text-[var(--ink-soft)]">일기 수정</p>
      </header>

      <div className="flex flex-col">
        {paragraphs.map((p, pi) => {
          const session = p.session ?? 0;
          const stamp = stamps.find((s) => s.session === session);
          const hasPhoto = stamp?.stampKind === "photo";
          const isLast = pi === paragraphs.length - 1;
          const isEditing = editingSession === session;

          if (isEditing) {
            return (
              <div key={pi} className="flex flex-col gap-3 py-4">
                <p className="font-mono text-[11px] tracking-wide text-[var(--ink-tertiary)]">
                  {formatSavedAt(p.savedAt, entry.entry_date)}
                </p>
                <div className="flex flex-col gap-3 bg-[var(--card-highlight)] p-4 border border-[var(--paper-line)]">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={saving}
                    autoFocus
                    className="min-h-[14vh] w-full resize-none bg-transparent font-[family-name:var(--font-diary)] text-lg leading-relaxed text-[var(--ink)] outline-none disabled:opacity-60"
                  />
                  {canTouchPhoto && (editingHasPhoto || croppedBlob) && (
                    <div className="flex items-center gap-3">
                      <div className="aspect-[4/5] w-16 shrink-0 overflow-hidden bg-[var(--paper-line)]">
                        {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, dimensions unknown ahead of time */}
                        <img
                          src={croppedPreviewUrl ?? (stamp ? (stampPhotoUrl(stamp) ?? undefined) : undefined)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                      {croppedBlob ? (
                        <span className="text-xs text-[var(--ink-soft)]">사진 1 · 새로 넣은 사진</span>
                      ) : (
                        keepExistingPhoto && (
                          <span className="text-xs text-[var(--ink-soft)]">사진 1 · 이 대목의 사진우표</span>
                        )
                      )}
                    </div>
                  )}
                  {!canTouchPhoto && (
                    <p className="text-xs text-[var(--ink-soft)]">
                      이미 다른 대목에 이 날의 사진우표가 있어서, 여기서는 사진을 넣을 수 없어요.
                    </p>
                  )}
                </div>

                {hasFreshReview && reviewResult.suggestions.length > 0 && (
                  <section className="flex flex-col gap-3 bg-[var(--card-highlight)] p-4 border border-[var(--paper-line)]">
                    <p className="font-mono text-xs tracking-wide text-[var(--ink-soft)]">
                      고칠 곳 {reviewResult.suggestions.length}
                    </p>
                    {reviewResult.comment && (
                      <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
                        {reviewResult.comment}
                      </p>
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

                <div className="flex shrink-0 items-center gap-2.5">
                  {canTouchPhoto && (
                    <>
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
                        disabled={saving}
                        aria-label={keepExistingPhoto || croppedBlob ? "사진 다시 선택" : "사진 추가"}
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
                    onClick={stopEditingSafely}
                    disabled={saving}
                    className="shrink-0 border border-[var(--ink)] px-4 py-2 text-[12.5px] font-medium text-[var(--ink)] disabled:opacity-40"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRow}
                    disabled={!canSave}
                    className="shrink-0 bg-[var(--cta)] px-5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
                  >
                    {saving ? "저장 중…" : "수정 완료"}
                  </button>
                </div>
                {!isLast && <hr className="mt-1 border-t border-[var(--paper-line)]" />}
              </div>
            );
          }

          const confirmingDelete = confirmingDeleteSession === session;
          const photoUrl = hasPhoto && stamp ? stampPhotoUrl(stamp) : null;

          return (
            <div key={pi} className="flex flex-col gap-2 py-4">
              <p className="font-mono text-[11px] tracking-wide text-[var(--ink-tertiary)]">
                {formatSavedAt(p.savedAt, entry.entry_date)}
              </p>
              <p className="whitespace-pre-wrap font-[family-name:var(--font-diary)] text-base leading-loose text-[var(--ink)]">
                {applyCorrections(p.text, p.suggestions)}
              </p>
              {photoUrl && (
                <div className="aspect-square w-24 overflow-hidden bg-[var(--paper-line)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, dimensions unknown ahead of time */}
                  <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)]">
                {confirmingDelete ? (
                  <>
                    <span>정말 삭제할까요?</span>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteSession(null)}
                      disabled={deleting}
                      className="ml-auto underline underline-offset-2 hover:text-[var(--ink)] disabled:opacity-60"
                    >
                      아니오
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(session)}
                      disabled={deleting}
                      className="underline underline-offset-2 hover:text-[var(--ink)] disabled:opacity-60"
                    >
                      {deleting ? "삭제 중…" : "삭제"}
                    </button>
                  </>
                ) : (
                  <>
                    {p.suggestions.length > 0 && <span>고침 {p.suggestions.length}</span>}
                    {p.suggestions.length > 0 && hasPhoto && <span>·</span>}
                    {hasPhoto && <span>사진 1</span>}
                    {paragraphs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteSession(session)}
                        className="ml-auto underline underline-offset-2 hover:text-[var(--ink)]"
                      >
                        삭제
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEditing(session)}
                      className={paragraphs.length > 1 ? "underline underline-offset-2 hover:text-[var(--ink)]" : "ml-auto underline underline-offset-2 hover:text-[var(--ink)]"}
                    >
                      수정
                    </button>
                  </>
                )}
              </div>
              {!isLast && <hr className="border-t border-[var(--paper-line)]" />}
            </div>
          );
        })}
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
