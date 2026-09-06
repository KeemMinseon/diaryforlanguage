"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PhotoCropModal from "@/components/editor/PhotoCropModal";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import { pickStamp } from "@/lib/stamps/keywordMap";
import { photoPublicUrl, saveEntry, triggerReview, uploadStampPhoto } from "@/lib/diary/client";
import { parseDateKey } from "@/lib/utils/date";
import type { DiaryEntry } from "@/types/diary";

export default function DiaryEditor({
  userId,
  dateKey,
  initialEntry,
}: {
  userId: string;
  dateKey: string;
  initialEntry?: DiaryEntry | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState(initialEntry?.content ?? "");
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(
    initialEntry?.stamp_kind === "photo" ? photoPublicUrl(initialEntry.photo_path) : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    };
  }, [croppedPreviewUrl]);

  const dateLabel = parseDateKey(dateKey).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

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
    setExistingPhotoUrl(null);
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setRawImageUrl(null);
  }

  function handleRemovePhoto() {
    if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    setCroppedBlob(null);
    setCroppedPreviewUrl(null);
    setExistingPhotoUrl(null);
  }

  const previewPhotoUrl = croppedPreviewUrl ?? existingPhotoUrl;
  const hasPhoto = Boolean(previewPhotoUrl);
  const previewStampKey = hasPhoto ? null : pickStamp(content);

  async function handleSave() {
    if (!content.trim()) {
      setError("일기 내용을 적어주세요.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let photoPath: string | null = null;
      const stampKind: "photo" | "keyword" = hasPhoto ? "photo" : "keyword";

      if (croppedBlob) {
        photoPath = await uploadStampPhoto(userId, dateKey, croppedBlob);
      } else if (existingPhotoUrl && initialEntry?.photo_path) {
        photoPath = initialEntry.photo_path;
      }

      const entry = await saveEntry({
        userId,
        dateKey,
        content,
        stampKind,
        stampKey: stampKind === "keyword" ? pickStamp(content) : null,
        photoPath,
      });

      triggerReview(entry.id);

      const month = dateKey.slice(0, 7);
      router.push(`/?month=${month}`);
    } catch (err) {
      console.error(err);
      setError("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  }

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

      <div className="flex flex-1 flex-col gap-4 sm:flex-row">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="今日は…"
          autoFocus
          className="min-h-[46vh] flex-1 resize-none rounded-2xl border border-[var(--paper-line)] bg-[var(--paper-raised)] p-5 font-[family-name:var(--font-diary)] text-lg leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--shu-soft)] sm:min-h-[60vh]"
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
              className="rounded-lg border border-[var(--paper-line)] bg-white px-3 py-2 text-xs text-[var(--ink)] hover:border-[var(--shu-soft)]"
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
            {!hasPhoto && (
              <p className="text-[11px] leading-snug text-[var(--ink-soft)]">
                사진이 없으면 일기 내용에 맞는 손그림 우표가 자동으로 붙어요.
              </p>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--shu)]">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="sticky bottom-4 self-end rounded-full bg-[var(--shu)] px-8 py-3 text-sm font-medium text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "저장 중…" : "저장하기"}
      </button>

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
