"use client";

import { useEffect, useRef, useState } from "react";
import PhotoCropModal from "@/components/editor/PhotoCropModal";
import UiIcon from "@/components/icons/UiIcon";
import DiaryStamp from "@/components/stamps/DiaryStamp";
import { useToast } from "@/components/toast/ToastProvider";
import { pickStamp } from "@/lib/stamps/keywordMap";
import { photoPublicUrl, saveEntry, uploadStampPhoto } from "@/lib/diary/client";
import type { DiaryEntry, DiaryParagraph, SessionStamp, StampKind } from "@/types/diary";

interface EditableParagraph {
  session: number;
  text: string;
}

/** An entry saved before per-session `stamps` existed has an empty array
 * — same fallback used everywhere else (ReviewView, collectStamps):
 * synthesize the one implicit stamp it does have from the top-level
 * columns instead of finding nothing for session 0. */
function resolveStamps(entry: DiaryEntry): SessionStamp[] {
  if (entry.stamps.length > 0) return entry.stamps;
  return [
    {
      session: 0,
      stampKind: entry.stamp_kind,
      stampKey: entry.stamp_key,
      photoPath: entry.photo_path,
      createdAt: entry.reviewed_at ?? entry.updated_at,
    },
  ];
}

/**
 * Edits an already-reviewed entry, one sitting (session) at a time — one
 * box per session, each with its own stamp shown right next to it. That
 * turns two things that used to only happen implicitly into something
 * the learner can see and act on directly: editing a sitting's text
 * updates *its own* stamp (a keyword one, anyway — see below), and
 * deleting a sitting removes its stamp along with it, instead of leaving
 * a stamp behind for text that no longer exists anywhere in the entry.
 *
 * "수정 완료" saves in two steps rather than waiting on Claude before
 * doing anything at all:
 *
 * 1. The edited text + stamps (both computed locally — stamps never
 *    needed Claude to begin with, see `pickStamp`) save immediately and
 *    this screen closes right away (`onSaved`) — the learner isn't stuck
 *    staring at "다시 첨삭하는 중…" for a full round trip just to see
 *    their own edit take effect. `paragraphs` keeps the *previous*
 *    review data for each surviving sitting for this one moment (still
 *    something better than blank), since real feedback for the just-
 *    edited text doesn't exist yet.
 * 2. Every sitting is then re-reviewed in the background (one
 *    /api/review-paragraph call per surviving sitting, same as
 *    ChatEditor, plus one /api/review-finalize — all in parallel, see
 *    the comment further down), and a second save lands the real
 *    suggestions/readings/총평/paragraphs a few seconds later, once
 *    they're ready. `onBackgroundSaveDone` re-triggers whatever the
 *    caller needs to pick that up (ReviewView re-fetches the page).
 *
 * Step 2 runs after this component has already told its caller it's
 * done and stopped touching its own state — it only ever calls
 * `saveEntry`/`toast`/`onBackgroundSaveDone`, none of which care whether
 * this component is still mounted.
 */
export default function EditEntry({
  userId,
  entry,
  existingPhotoUrl,
  onCancel,
  onSaved,
  onBackgroundSaveDone,
}: {
  userId: string;
  entry: DiaryEntry;
  existingPhotoUrl: string | null;
  onCancel: () => void;
  onSaved: () => void;
  /** Called once the background re-review (see the header comment)
   * lands its own save — lets the caller refresh again to pick up the
   * real feedback once it's ready. Not called if that background save
   * fails (nothing new to pick up then). */
  onBackgroundSaveDone?: () => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const originalStamps = resolveStamps(entry);
  const [paragraphs, setParagraphs] = useState<EditableParagraph[]>(() =>
    entry.paragraphs.length > 0
      ? entry.paragraphs.map((p) => ({ session: p.session ?? 0, text: p.text }))
      : [{ session: originalStamps[0]?.session ?? 0, text: entry.content }]
  );
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

  function updateParagraphText(index: number, text: string) {
    setParagraphs((prev) => prev.map((p, i) => (i === index ? { ...p, text } : p)));
  }

  function deleteParagraph(index: number) {
    setParagraphs((prev) => prev.filter((_, i) => i !== index));
  }

  // The front (index 0) stamp is the only one this screen's photo
  // controls ever touch — matches saveEntry's own convention (the
  // calendar always shows stamps[0]) and keeps every other sitting's own
  // photo/keyword stamp completely out of this whole-entry photo flow.
  const frontHasPhoto = Boolean(croppedPreviewUrl) || keepExistingPhoto;
  const frontPreviewPhotoUrl = croppedPreviewUrl ?? (keepExistingPhoto ? existingPhotoUrl : null);

  /** What a paragraph's own stamp looks like *right now*, live — a
   * keyword stamp recomputes instantly from its own current text (pure,
   * local, no AI call needed), while a sitting that was originally a
   * photo keeps that exact photo untouched by any text edit here (only
   * the front slot's own photo controls above can ever change a photo
   * stamp) — editing session 2's text was never going to know anything
   * about a photo taken for session 2 in the first place. */
  function previewFor(p: EditableParagraph, index: number) {
    if (index === 0 && frontHasPhoto) {
      return { stampKind: "photo" as StampKind, stampKey: null, photoUrl: frontPreviewPhotoUrl };
    }
    const original = originalStamps.find((s) => s.session === p.session);
    if (original?.stampKind === "photo" && original.photoPath) {
      return { stampKind: "photo" as StampKind, stampKey: null, photoUrl: photoPublicUrl(original.photoPath) };
    }
    return { stampKind: "keyword" as StampKind, stampKey: pickStamp(p.text), photoUrl: null };
  }

  async function handleSave() {
    const trimmed = paragraphs
      .map((p) => ({ ...p, text: p.text.trim() }))
      .filter((p) => p.text);
    if (trimmed.length === 0) {
      setError("일기 내용을 적어주세요.");
      return;
    }
    setError(null);
    setSaving(true);

    let frontPhotoPath: string | null = null;
    try {
      if (croppedBlob) {
        frontPhotoPath = await uploadStampPhoto(userId, entry.entry_date, croppedBlob);
      } else if (keepExistingPhoto) {
        frontPhotoPath = entry.photo_path;
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "사진 업로드에 실패했어요. 다시 시도해 주세요.");
      setSaving(false);
      return;
    }

    const fullText = trimmed.map((p) => p.text).join("\n\n");

    // Stamps never needed Claude at all — pickStamp is pure and local —
    // so they're final already, not just a placeholder for step 1 below.
    // One per surviving paragraph, in the same order — a deleted
    // paragraph's stamp simply isn't in this list at all, and whichever
    // paragraph now sits at index 0 (even if it wasn't originally the
    // day's first) becomes the new front/calendar stamp, exactly as
    // reordering `paragraphs` implies it should.
    const stamps: SessionStamp[] = trimmed.map((p, i) => {
      if (i === 0 && frontHasPhoto) {
        return {
          session: p.session,
          stampKind: "photo",
          stampKey: null,
          photoPath: frontPhotoPath,
          createdAt: new Date().toISOString(),
        };
      }
      const original = originalStamps.find((s) => s.session === p.session);
      if (i !== 0 && original?.stampKind === "photo") {
        return original;
      }
      return {
        session: p.session,
        stampKind: "keyword",
        stampKey: pickStamp(p.text),
        photoPath: null,
        createdAt: new Date().toISOString(),
      };
    });

    // Step 1: save the text + stamps right now — carrying over whichever
    // sitting's *previous* review data still applies (falls back to blank
    // for a brand new sitting split off just now), since fresh feedback
    // for the just-edited text doesn't exist yet. This is what the
    // learner actually sees the instant this screen closes below; step 2
    // replaces it a few seconds later.
    const staleParagraphs: DiaryParagraph[] = trimmed.map((p) => {
      const previous = entry.paragraphs.find((ep) => (ep.session ?? 0) === p.session);
      return {
        text: p.text,
        comment: previous?.comment ?? "",
        suggestions: previous?.suggestions ?? [],
        readings: previous?.readings ?? [],
        savedAt: previous?.savedAt ?? new Date().toISOString(),
        session: p.session,
      };
    });
    try {
      await saveEntry({
        userId,
        dateKey: entry.entry_date,
        content: fullText,
        stampKind: stamps[0].stampKind,
        stampKey: stamps[0].stampKey,
        photoPath: stamps[0].photoPath,
        status: "reviewed",
        overallComment: entry.overall_comment,
        suggestions: entry.suggestions,
        readings: entry.readings,
        paragraphs: staleParagraphs,
        stamps,
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "저장에 실패했어요. 다시 시도해 주세요.");
      setSaving(false);
      return;
    }

    toast("수정한 내용을 저장했어요. 첨삭은 잠시 후 반영돼요.");
    onSaved();

    // Step 2: re-review every surviving sitting for real, in the
    // background — this screen is already closed (onSaved above), so
    // nothing from here on touches this component's own state.
    //
    // One /api/review-paragraph call per sitting (each with everything
    // before it as context) instead of one giant call over the whole
    // day's text — /api/review-paragraph is built and tuned for a single
    // paragraph's worth of writing (see ChatEditor, where it's always
    // called this way); handing it a whole multi-sitting day at once made
    // for a much bigger, slower generation, and a bigger input is also
    // more likely to trip the missing-readings backfill (see that
    // route's own fetchMissingReadings) — a second, fully sequential
    // Claude call on top of the first. Running every sitting's call
    // together, and alongside finalize (which doesn't read any of their
    // output), bounds the wait by the slowest single paragraph-sized call
    // rather than the sum of a whole-day one plus a second whole-day
    // finalize call.
    void (async () => {
      try {
        const [finalizeRes, reviewResponses] = await Promise.all([
          fetch("/api/review-finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullText }),
          }),
          Promise.all(
            trimmed.map((p, i) =>
              fetch("/api/review-paragraph", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  paragraph: p.text,
                  priorText: trimmed
                    .slice(0, i)
                    .map((pp) => pp.text)
                    .join("\n\n"),
                }),
              })
            )
          ),
        ]);

        const reviewDataList = await Promise.all(reviewResponses.map((res) => res.json()));
        const failedIndex = reviewResponses.findIndex((res) => !res.ok);
        if (failedIndex !== -1) {
          throw new Error(reviewDataList[failedIndex]?.error ?? "첨삭에 실패했어요.");
        }
        const suggestions = reviewDataList.flatMap((d) => d.suggestions ?? []);
        // Deduped by (text, reading) — unlike suggestions (each occurrence
        // is its own real mistake worth flagging, wherever it lands in the
        // text), the same word reviewed independently in two different
        // sittings would otherwise show up twice in one entry's own
        // `readings`, inflating 단어장's occurrence count for a word that
        // just happened to appear in two paragraphs the same day.
        const seenReadingKeys = new Set<string>();
        const readings = reviewDataList
          .flatMap((d) => d.readings ?? [])
          .filter((r) => {
            const key = `${r.text}␟${r.reading}`;
            if (seenReadingKeys.has(key)) return false;
            seenReadingKeys.add(key);
            return true;
          });

        const finalizeData = await finalizeRes.json();
        if (!finalizeRes.ok) throw new Error(finalizeData.error ?? "총평 생성에 실패했어요.");

        // One paragraph per surviving sitting, each with its own fresh
        // review from the calls above — mirrors ChatEditor's own
        // paragraph shape, and (see the header comment) is what lets this
        // screen still show the right number of boxes the *next* time
        // it's opened.
        const savedAt = new Date().toISOString();
        const paragraphsOut: DiaryParagraph[] = trimmed.map((p, i) => ({
          text: p.text,
          comment:
            typeof reviewDataList[i]?.comment === "string" ? reviewDataList[i].comment : "",
          suggestions: reviewDataList[i]?.suggestions ?? [],
          readings: reviewDataList[i]?.readings ?? [],
          savedAt,
          session: p.session,
        }));

        await saveEntry({
          userId,
          dateKey: entry.entry_date,
          content: fullText,
          stampKind: stamps[0].stampKind,
          stampKey: stamps[0].stampKey,
          photoPath: stamps[0].photoPath,
          status: "reviewed",
          overallComment: finalizeData.overallComment,
          suggestions,
          readings,
          paragraphs: paragraphsOut,
          stamps,
        });

        toast("첨삭이 반영됐어요! 📮");
        onBackgroundSaveDone?.();
      } catch (err) {
        console.error(err);
        toast("첨삭을 갱신하지 못했어요. 다시 열어서 저장해 보세요.");
      }
    })();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {paragraphs.map((p, i) => {
          const preview = previewFor(p, i);
          return (
            <div key={p.session} className="flex flex-col gap-4 sm:flex-row">
              <textarea
                value={p.text}
                onChange={(e) => updateParagraphText(i, e.target.value)}
                disabled={saving}
                className="min-h-[16vh] flex-1 resize-none rounded-2xl border border-[var(--paper-line)] bg-[var(--paper-raised)] p-5 font-[family-name:var(--font-diary)] text-lg leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--ink)] disabled:opacity-60"
              />
              <div className="flex flex-row items-start gap-4 sm:w-36 sm:flex-col">
                <div className="w-28 sm:w-full">
                  <DiaryStamp
                    stampKind={preview.stampKind}
                    stampKey={preview.stampKey}
                    photoUrl={preview.photoUrl}
                    className="w-full drop-shadow-md"
                  />
                </div>
                {i === 0 && (
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
                      className="flex items-center gap-1 rounded-lg border border-[var(--paper-line)] bg-[var(--paper-raised)] px-3 py-2 text-xs text-[var(--ink)]"
                    >
                      <UiIcon name="camera-line" className="h-3.5 w-3.5" alt="">
                        📷
                      </UiIcon>
                      사진 첨부
                    </button>
                    {frontHasPhoto && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="text-xs text-[var(--ink-soft)] underline underline-offset-2"
                      >
                        사진 지우고 자동 우표로
                      </button>
                    )}
                  </div>
                )}
                {paragraphs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteParagraph(i)}
                    disabled={saving}
                    className="text-xs text-[var(--ink-soft)] underline underline-offset-2 disabled:opacity-60"
                  >
                    이 부분 삭제
                  </button>
                )}
              </div>
            </div>
          );
        })}
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
          className="rounded-full bg-[var(--cta)] px-7 py-2.5 text-sm font-medium text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
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
