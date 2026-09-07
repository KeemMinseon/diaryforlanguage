"use client";

import { useEffect, useRef, useState } from "react";
import PhotoCropModal from "@/components/editor/PhotoCropModal";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import { useToast } from "@/components/toast/ToastProvider";
import { pickStamp } from "@/lib/stamps/keywordMap";
import { saveEntry, uploadStampPhoto } from "@/lib/diary/client";
import type { DiaryEntry } from "@/types/diary";

/**
 * Edits an already-reviewed entry. Unlike the paragraph-by-paragraph
 * ChatEditor, this re-reviews the whole edited text as one pass (through
 * the same /api/review-paragraph + /api/review-finalize calls) — simpler,
 * and the old per-paragraph exchange for this day is stale once its text
 * changes anyway.
 */
export default function EditEntry({
  userId,
  entry,
  existingPhotoUrl,
  onCancel,
  onSaved,
}: {
  userId: string;
  entry: DiaryEntry;
  existingPhotoUrl: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState(entry.content);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [keepExistingPhoto, setKeepExistingPhoto] = useState(
    entry.stamp_kind === "photo" && Boolean(existingPhotoUrl)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    };
  }, [croppedPreviewUrl]);

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

  const hasPhoto = Boolean(croppedPreviewUrl) || keepExistingPhoto;
  const previewPhotoUrl = croppedPreviewUrl ?? (keepExistingPhoto ? existingPhotoUrl : null);
  const previewStampKey = hasPhoto ? null : pickStamp(text);

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("일기 내용을 적어주세요.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let photoPath: string | null = null;
      const stampKind: "photo" | "keyword" = hasPhoto ? "photo" : "keyword";
      if (croppedBlob) {
        photoPath = await uploadStampPhoto(userId, entry.entry_date, croppedBlob);
      } else if (keepExistingPhoto) {
        photoPath = entry.photo_path;
      }

      const reviewRes = await fetch("/api/review-paragraph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paragraph: trimmed, priorText: "" }),
      });
      const reviewData = await reviewRes.json();
      if (!reviewRes.ok) throw new Error(reviewData.error ?? "첨삭에 실패했어요.");

      const finalizeRes = await fetch("/api/review-finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullText: trimmed }),
      });
      const finalizeData = await finalizeRes.json();
      if (!finalizeRes.ok) throw new Error(finalizeData.error ?? "총평 생성에 실패했어요.");

      await saveEntry({
        userId,
        dateKey: entry.entry_date,
        content: trimmed,
        stampKind,
        stampKey: stampKind === "keyword" ? pickStamp(trimmed) : null,
        photoPath,
        status: "reviewed",
        overallComment: finalizeData.overallComment,
        suggestions: reviewData.suggestions ?? [],
        readings: reviewData.readings ?? [],
      });

      toast("수정한 일기에 添削 도장이 다시 찍혔어요! 📮");
      onSaved();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "저장에 실패했어요. 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={saving}
          className="min-h-[30vh] flex-1 resize-none rounded-2xl border border-[var(--paper-line)] bg-[var(--paper-raised)] p-5 font-[family-name:var(--font-diary)] text-lg leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--ink)] disabled:opacity-60"
        />
        <div className="flex flex-row items-start gap-4 sm:w-36 sm:flex-col">
          <div className="w-28 sm:w-full">
            <DiaryStamp
              stampKind={hasPhoto ? "photo" : "keyword"}
              stampKey={previewStampKey}
              photoUrl={previewPhotoUrl}
              className="w-full drop-shadow-md"
            />
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-none sm:w-full">
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
              className="rounded-lg border border-[var(--paper-line)] bg-white px-3 py-2 text-xs text-[var(--ink)]"
            >
              📷 사진 첨부
            </button>
            {hasPhoto && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-xs text-[var(--ink-soft)] underline underline-offset-2"
              >
                사진 지우고 자동 우표로
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-[var(--ink)]">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-[var(--paper-line)] px-6 py-2.5 text-sm text-[var(--ink-soft)] disabled:opacity-60"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-[var(--ink)] px-7 py-2.5 text-sm font-medium text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "다시 첨삭하는 중…" : "수정 완료"}
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
