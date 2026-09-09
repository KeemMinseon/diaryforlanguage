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
import { notifyDiaryStamped } from "@/lib/events/diaryStamped";
import { buildHighlightSegments } from "@/lib/review/highlight";
import { formatSavedAt, parseDateKey } from "@/lib/utils/date";
import type { DiaryEntry, DiaryParagraph, Reading, SessionStamp, Suggestion } from "@/types/diary";

interface FeedbackRound {
  text: string;
  comment: string;
  suggestions: Suggestion[];
  readings: Reading[];
  savedAt: string;
  /** Which "이어서 쓰기" sitting this round belongs to — see
   * `DiaryParagraph.session`/`SessionStamp`. */
  session: number;
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
      // Missing on a paragraph saved before sessions existed — treat the
      // whole thing as one single prior sitting (session 0).
      session: p.session ?? 0,
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
      session: 0,
    },
  ];
}

/** A highlight-only backdrop for the input box: every character here is
 * invisible (`text-transparent`) — the learner's actual visible text is
 * still the real, fully normal, fully editable `<textarea>` on top of
 * this. Only the `<mark>` spans paint anything (a background + underline)
 * at the exact position their matched text sits, since this backdrop is
 * laid out identically underneath. This split — real text stays in the
 * real textarea, only the decoration lives underneath — is what keeps
 * typing (including IME composition, which renders using the textarea's
 * own text color) working exactly like a normal input; an earlier version
 * hid the textarea's own text and drew the visible glyphs from this
 * backdrop instead, which made composing Japanese invisible until
 * confirmed.
 *
 * `rounds` are exactly contiguous chunks of the box's text in order (each
 * one is whatever was sent by a "살펴보기" click), so concatenating
 * their segments plus the still-unreviewed tail lines up with the
 * textarea's full text with nothing double-rendered or out of place. */
function renderBoxHighlight(rounds: FeedbackRound[], pendingText: string) {
  return (
    <>
      {rounds.map((r, ri) =>
        buildHighlightSegments(r.text, r.suggestions).map((seg, si) =>
          seg.suggestionIndex === null ? (
            <span key={`${ri}-${si}`}>{seg.text}</span>
          ) : (
            <mark
              key={`${ri}-${si}`}
              // `text-transparent` isn't optional here — browsers' UA
              // stylesheet sets `mark { color: black }` explicitly (not
              // "inherit"), so without overriding it directly on the
              // element, its real text ghosts through underneath the
              // textarea's own text despite this whole backdrop's
              // wrapping div being transparent.
              className="rounded bg-black/[0.06] text-transparent underline decoration-[var(--ink)] decoration-2 underline-offset-4"
            >
              {seg.text}
            </mark>
          )
        )
      )}
      <span>{pendingText}</span>
      {/* Keeps a trailing newline from collapsing the last line's height. */}
      {"​"}
    </>
  );
}

/** A previous sitting's paragraph, shown as a plain (non-transparent) highlighted
 * block — unlike `renderBoxHighlight`, this isn't laid out under a live textarea,
 * so it can just render real, visible text straight through. Used for everything
 * already durably saved before this visit: once a round is locked, it's never
 * folded back into the editable box (see the "이어서 쓰기" split below), so its
 * own stored text and highlight positions can never drift out of sync with
 * anything — there's nothing live to drift against. */
function renderLockedRound(r: FeedbackRound, dateKey: string, key: string) {
  return (
    <div
      key={key}
      className="flex flex-col gap-3 rounded-2xl bg-[var(--paper-raised)] p-4"
    >
      <p className="whitespace-pre-wrap font-[family-name:var(--font-diary)] text-[15px] leading-relaxed text-[var(--ink)]">
        {buildHighlightSegments(r.text, r.suggestions).map((seg, si) =>
          seg.suggestionIndex === null ? (
            <span key={si}>{seg.text}</span>
          ) : (
            <mark
              key={si}
              className="rounded bg-black/[0.06] px-0.5 text-[var(--ink)] underline decoration-[var(--ink)] decoration-2 underline-offset-4"
            >
              {seg.text}
            </mark>
          )
        )}
      </p>
      {(r.comment || r.suggestions.length > 0 || r.readings.length > 0) && (
        <div className="flex flex-col gap-1.5 border-t border-[var(--paper-line)] pt-2.5">
          <p className="text-[10px] text-[var(--ink-soft)]/70">{formatSavedAt(r.savedAt, dateKey)}</p>
          {r.comment && <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{r.comment}</p>}
          <ReadingsHint readings={r.readings} label="읽는 법" />
          {r.suggestions.map((s, j) => (
            <span
              key={j}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--paper-line)] bg-[var(--paper-raised)] px-2.5 py-0.5 text-[12.5px]"
            >
              <span className="text-[var(--ink-soft)] line-through">
                <FuriganaText text={s.original} readings={r.readings} />
              </span>
              <UiIcon name="arrow-right-line" className="h-3 w-3" alt="">
                <span aria-hidden="true">→</span>
              </UiIcon>
              <span className="font-[family-name:var(--font-diary)] text-[var(--ink)]">
                <FuriganaText text={s.suggestion} readings={r.readings} />
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}


export default function ChatEditor({
  userId,
  dateKey,
  initialEntry,
}: {
  userId: string;
  dateKey: string;
  /** When reopening a day that already has an entry, to add more to it
   * ("이어서 쓰기") — pre-fills the box and feed from what's already saved. */
  initialEntry?: DiaryEntry;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Whatever was already saved before this visit — shown as locked,
  // read-only blocks (see renderLockedRound) rather than folded into the
  // editable box below. On "이어서 쓰기", the box used to reopen pre-filled
  // with all of it, one continuously editable string; editing anything
  // inside that older text (e.g. applying a suggested fix) had no way to
  // stay in sync with the review state built for it, and reopening a day
  // just to add a sentence buried today's new writing inside yesterday's,
  // scrolled far below. Splitting it into its own locked block up front
  // sidesteps both: nothing already reviewed can ever go stale again, and
  // every visit's own writing stays visually its own thing.
  const lockedRounds = initialRoundsFrom(initialEntry);
  // One higher than the last session already saved for this day (0 if
  // there's none, i.e. this is the day's very first sitting) — this
  // visit's own new rounds/paragraphs, and the one stamp they'll get, all
  // carry this same number. See `SessionStamp`.
  //
  // Takes whichever of `paragraphs` or `stamps` implies *more* prior
  // sessions, rather than trusting `paragraphs` (via `lockedRounds`)
  // alone — the two normally agree, but EditEntry's "수정" flattens
  // `paragraphs` back to one untagged block on a direct text edit while
  // deliberately leaving `stamps` alone (see its own comment on why), so
  // right after an edit `lockedRounds` alone would undercount and hand
  // out a session number that's already taken in `stamps`.
  const currentSession = Math.max(
    lockedRounds.length > 0 ? Math.max(...lockedRounds.map((r) => r.session)) + 1 : 0,
    initialEntry?.stamps.length ?? 0
  );
  // Prior context for the AI only — never part of the editable box, so it
  // can't desync with anything the learner types. Sent alongside whatever
  // this visit has reviewed so far, so a "이어서 쓰기" visit's very first
  // paragraph still gets judged against yesterday's tense/flow, not in a
  // vacuum.
  const priorContentForBlock = initialEntry?.content ?? "";

  // This visit's own writing, one continuously editable box — never wiped
  // after a review, so the learner never has to retype anything. Always
  // starts blank, even on "이어서 쓰기": everything from before this visit
  // lives only in `lockedRounds` above.
  // `reviewedPrefix` marks how much of it has already been sent for review;
  // only the part of `content` past that point counts as "new" next time.
  const [content, setContent] = useState("");
  const [reviewedPrefix, setReviewedPrefix] = useState("");
  // Bookkeeping copy of this visit's rounds — used for reviewedPrefix/the
  // backdrop highlight and for what actually gets persisted, so it can be
  // safely rolled back when an edit lands inside already-reviewed text
  // (see handleContentChange). `feedHistory` below is the visible log and
  // is never rolled back, so touching the box to apply a fix never makes
  // the feedback that pointed it out disappear — only `rounds` shrinks;
  // every card the learner has already seen stays right where it was.
  const [rounds, setRounds] = useState<FeedbackRound[]>([]);
  const [feedHistory, setFeedHistory] = useState<FeedbackRound[]>([]);
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // This visit's own stamp photo, if any — like `content`, always starts
  // blank even on "이어서 쓰기": a new sitting gets its own stamp
  // (see `currentSession`/`SessionStamp`), not last sitting's carried over.
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    };
  }, [croppedPreviewUrl]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [feedHistory.length, sending]);

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
  // Locked history + this visit's box, joined only for the saved `content`
  // column, which should reflect the whole day — the box itself never
  // contains the locked part. The keyword stamp, by contrast, is picked
  // from `content` alone (this visit's own writing only): each sitting
  // gets its own stamp now (see `currentSession`/`SessionStamp`), not one
  // shared across the whole day.
  const combinedContent = priorContentForBlock
    ? content
      ? `${priorContentForBlock}\n\n${content}`
      : priorContentForBlock
    : content;
  const hasPhoto = Boolean(croppedPreviewUrl);
  const previewPhotoUrl = croppedPreviewUrl;
  const previewStampKey = hasPhoto ? null : pickStamp(content);

  function handleContentChange(next: string) {
    setContent(next);
    const commonLen = commonPrefixLength(reviewedPrefix, next);
    if (commonLen >= reviewedPrefix.length) return; // strict append — nothing stale to fix
    // The learner edited words inside a paragraph that was already
    // reviewed — most often applying a suggested fix — instead of only
    // typing past the end. `reviewedPrefix`, and any round whose text
    // falls at or after that edit, now describe words that no longer
    // exist: sending them again as "already reviewed" context would show
    // the AI a version of the diary that doesn't match what's actually in
    // the box, and the highlight backdrop (built from each round's own
    // stored text — see renderBoxHighlight) would drift out of alignment
    // with the real textarea, since it's laid out assuming that stored
    // text is still accurate. This is what "제안대로 수정했는데
    // 틀렸다고 하네" was actually seeing — the round describing the old,
    // unfixed wording never got updated, so it kept being replayed as if
    // still true. Roll every round from the edit point on back into
    // "pending" so the whole rest is reviewed together, fresh, next time.
    // Only `rounds` (bookkeeping) rolls back here — `feedHistory` (what's
    // actually shown above) is untouched, so the comment/suggestion card
    // that pointed out the fix doesn't vanish the moment it's applied;
    // it just stays as the record of what was said, and a fresh round
    // gets added alongside it once this stretch is reviewed again.
    let consumed = 0;
    const kept: FeedbackRound[] = [];
    for (const r of rounds) {
      if (consumed + r.text.length > commonLen) break;
      kept.push(r);
      consumed += r.text.length;
    }
    if (kept.length !== rounds.length) {
      setRounds(kept);
      setReviewedPrefix(next.slice(0, consumed));
    }
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
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setRawImageUrl(null);
  }

  function handleRemovePhoto() {
    if (croppedPreviewUrl) URL.revokeObjectURL(croppedPreviewUrl);
    setCroppedBlob(null);
    setCroppedPreviewUrl(null);
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
      session: currentSession,
    };
  }

  async function handleSend() {
    // The raw, untrimmed slice — kept as the round's own `text` (not the
    // trimmed value sent to the API) so concatenating every round's text
    // plus whatever's still pending reconstructs `content` exactly. Any
    // round stored trimmed quietly drops the whitespace/newline the
    // learner typed between paragraphs, and the highlight backdrop (see
    // renderBoxHighlight) has no way to know that was missing — it just
    // drifts further out of alignment with the real textarea with every
    // round after that, which is what "이어서 작성하고 다시 검토했을 때
    // 앞의 문장은 잘리는 것 같아" was actually seeing.
    const rawChunk = pendingText;
    const chunk = rawChunk.trim();
    if (!chunk || sending) return;
    setError(null);
    setSending(true);
    try {
      const priorTextForApi = [priorContentForBlock, reviewedPrefix].filter(Boolean).join("\n\n");
      const round = await reviewChunk(chunk, priorTextForApi);
      const newRound = { ...round, text: rawChunk };
      setRounds((prev) => [...prev, newRound]);
      setFeedHistory((prev) => [...prev, newRound]);
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

    // This visit's own writing is *all* new by construction (the box never
    // starts pre-filled — see the state setup above), so there's no more
    // diffing needed here to figure out what to review versus what to skip.
    const newContent = content;
    const fullText = combinedContent;
    const rawChunk = pendingText; // see handleSend — kept raw for the same reason
    const chunk = rawChunk.trim();

    let photoPath: string | null = null;
    // This sitting's own stamp — picked from `newContent` alone, not the
    // whole day's `fullText`: each sitting gets its own stamp (see
    // `currentSession`), so a keyword mentioned only in an earlier sitting
    // shouldn't decide *this* one's.
    const stampKind: "photo" | "keyword" = hasPhoto ? "photo" : "keyword";
    const stampKey = stampKind === "keyword" ? pickStamp(newContent) : null;
    const allSoFar = [...lockedRounds, ...rounds];
    const existingSuggestions = allSoFar.flatMap((r) => r.suggestions);
    const existingReadings = allSoFar.flatMap((r) => r.readings);
    const existingParagraphs: DiaryParagraph[] = allSoFar.map((r) => ({
      text: r.text,
      comment: r.comment,
      suggestions: r.suggestions,
      readings: r.readings,
      savedAt: r.savedAt,
      session: r.session,
    }));
    // Every earlier sitting's own stamp, plus this one's — appended once
    // here (after `photoPath` is settled) and reused for every save below,
    // pending/reviewed/failed alike, so a sitting's stamp is visible even
    // before its own review finishes.
    let stamps: SessionStamp[] = initialEntry?.stamps ?? [];

    try {
      // Save the text itself first — it shouldn't sit in the browser
      // waiting on an AI round trip to be safe. It always lands as
      // "pending" here (there's always something from this visit still
      // unreviewed at this point); the background pass below then
      // reviews just that and re-saves as "reviewed".
      if (croppedBlob) {
        photoPath = await uploadStampPhoto(userId, dateKey, croppedBlob);
      }
      stamps = [
        ...stamps,
        { session: currentSession, stampKind, stampKey, photoPath, createdAt: new Date().toISOString() },
      ];

      await saveEntry({
        userId,
        dateKey,
        content: fullText,
        // The calendar reads the top-level stamp_kind/stamp_key/photo_path
        // columns directly (see DayCell/StampedDay) rather than the first
        // entry of `stamps` — kept in sync with `stamps[0]` (the day's
        // very *first* sitting) here instead, so the calendar keeps
        // showing the same stamp it always has for this day even after a
        // later "이어서 쓰기" adds more sittings, rather than jumping to
        // whichever one was saved most recently.
        stampKind: stamps[0].stampKind,
        stampKey: stamps[0].stampKey,
        photoPath: stamps[0].photoPath,
        status: "pending",
        overallComment: initialEntry?.overall_comment ?? "",
        suggestions: existingSuggestions,
        readings: existingReadings,
        paragraphs: existingParagraphs,
        stamps,
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "저장에 실패했어요. 다시 시도해 주세요.");
      setFinishing(false);
      return;
    }

    // The text + stamp are already safely saved — leave this screen right
    // away instead of making the learner wait through a full Claude round
    // trip just to get back to the calendar (same pattern as EditEntry's
    // own 수정 완료). Word-level feedback + 총평 finish in the background
    // below and land a moment later via a second save; nothing from here
    // on needs to block returning to the calendar.
    toast("일기를 저장했어요. 더 나은 첨삭을 잠시 후 보여드릴게요.");
    const month = dateKey.slice(0, 7);
    router.push(`/?month=${month}`);

    void (async () => {
      try {
        // Review just this visit's own writing — locked history from
        // earlier visits was already reviewed then and is never resent.
        //
        // This last paragraph's own review and the whole-day 총평 call
        // are two independent Claude requests — finalize only ever reads
        // `newContent` (this sitting's full text), never anything
        // reviewChunk returns — so there's nothing forcing them to happen
        // one after the other. Running them together roughly halves the
        // wait in the common case (an unreviewed trailing paragraph,
        // which is the whole reason this branch exists) — though now
        // that this runs after the screen has already moved on, that
        // mostly just means the background work finishes sooner, not
        // that the learner is staring at a spinner for less time.
        const priorTextForApi = [priorContentForBlock, reviewedPrefix].filter(Boolean).join("\n\n");
        const [round, finalizeRes] = await Promise.all([
          chunk ? reviewChunk(chunk, priorTextForApi) : Promise.resolve(null),
          fetch("/api/review-finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fullText: newContent }),
          }),
        ]);
        const allRounds = round ? [...rounds, { ...round, text: rawChunk }] : rounds;

        const finalizeData = await finalizeRes.json();
        if (!finalizeRes.ok) throw new Error(finalizeData.error ?? "총평 생성에 실패했어요.");

        const allBlocks = [...lockedRounds, ...allRounds];
        const allSuggestions = allBlocks.flatMap((r) => r.suggestions);
        const allReadings = allBlocks.flatMap((r) => r.readings);
        const paragraphs: DiaryParagraph[] = allBlocks.map((r) => ({
          text: r.text,
          comment: r.comment,
          suggestions: r.suggestions,
          readings: r.readings,
          savedAt: r.savedAt,
          session: r.session,
        }));

        await saveEntry({
          userId,
          dateKey,
          content: fullText,
          stampKind: stamps[0].stampKind,
          stampKey: stamps[0].stampKey,
          photoPath: stamps[0].photoPath,
          status: "reviewed",
          overallComment: finalizeData.overallComment,
          suggestions: allSuggestions,
          readings: allReadings,
          paragraphs,
          stamps,
        });

        // Not setRounds/setFeedHistory/setReviewedPrefix — this component
        // is already gone (the screen moved on right after the pending
        // save above), so there's no feed left here to update.
        toast(
          initialEntry
            ? "이어서 쓴 내용까지 도장이 다시 찍혔어요! 📮"
            : "오늘 일기에 도장이 찍혔어요! 📮"
        );
        // Lets the calendar — if it's the screen showing right now, which
        // it usually is, since the pending save above already sent the
        // learner back to it — play a real stamp-landing animation on
        // this exact day instead of the hanko just silently appearing
        // next time it happens to re-fetch.
        notifyDiaryStamped(dateKey);
      } catch (err) {
        console.error(err);
        // The text itself is already safely saved from the pending save
        // above — just mark it so reopening the entry shows "다시
        // 저장하면 재시도돼요" instead of looking like nothing was ever
        // attempted. No setError/setFinishing here either, for the same
        // reason — this screen is already gone.
        try {
          await saveEntry({
            userId,
            dateKey,
            content: fullText,
            stampKind: stamps[0].stampKind,
            stampKey: stamps[0].stampKey,
            photoPath: stamps[0].photoPath,
            status: "failed",
            overallComment: initialEntry?.overall_comment ?? "",
            suggestions: existingSuggestions,
            readings: existingReadings,
            paragraphs: existingParagraphs,
            stamps,
          });
        } catch (markErr) {
          console.error(markErr);
        }
        toast("첨삭을 완료하지 못했어요. 그 날짜를 다시 열어서 저장해 보세요.");
      }
    })();
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
          className="flex items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
            ←
          </UiIcon>
          캘린더
        </button>
        <p className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--ink-soft)]">
          {dateLabel}
        </p>
      </header>

      {/* Top half: locked history first (if any), then this visit's own
          feedback so far, scrolls on its own. This visit's own text stays
          only in the box below — it's never echoed back up here; locked
          rounds show their text right here instead, since it's not in the
          box at all anymore. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-1">
        {feedHistory.length === 0 && lockedRounds.length === 0 && !sending && (
          <p className="text-sm text-[var(--ink-soft)]">
            오늘 하루는 어땠나요? 편하게 적어보세요 — 한 문단씩 보낼 때마다 짧은 피드백을 드릴게요.
          </p>
        )}
        {lockedRounds.map((r, i) => renderLockedRound(r, dateKey, `locked-${i}`))}
        {lockedRounds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-[var(--paper-line)]" />
            <p className="shrink-0 text-[11px] text-[var(--ink-soft)]">여기서부터 이어서 써요</p>
            <span className="h-px flex-1 bg-[var(--paper-line)]" />
          </div>
        )}
        {feedHistory.map((r, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg bg-black/[0.035] px-3 py-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ink-soft)]" />
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] text-[var(--ink-soft)]/70">{formatSavedAt(r.savedAt, dateKey)}</p>
              <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{r.comment}</p>
              <ReadingsHint readings={r.readings} label="읽는 법" />
              {r.suggestions.map((s, j) => (
                <span
                  key={j}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--paper-line)] bg-[var(--paper-raised)] px-2.5 py-0.5 text-[12.5px]"
                >
                  <span className="text-[var(--ink-soft)] line-through">
                    <FuriganaText text={s.original} readings={r.readings} />
                  </span>
                  <UiIcon name="arrow-right-line" className="h-3 w-3" alt="">
                    <span aria-hidden="true">→</span>
                  </UiIcon>
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
            <p className="text-[12.5px] text-[var(--ink-soft)]">살펴보고 있어요</p>
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
          {/* This backdrop is decoration only — every character in it is
              invisible, it just paints a highlight behind where a matched
              suggestion sits. The textarea on top keeps its own text fully
              visible and completely normal, so typing (Japanese IME
              composition included) still works exactly like a plain input;
              only the highlight lives underneath. Kept in sync on scroll
              since only the (topmost, interactive) textarea actually
              receives scroll input. */}
          <div className="relative min-h-0 flex-1">
            <div
              ref={backdropRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-transparent font-[family-name:var(--font-diary)] text-[15px] leading-relaxed"
            >
              {renderBoxHighlight(rounds, pendingText)}
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              onScroll={(e) => {
                if (backdropRef.current) backdropRef.current.scrollTop = e.currentTarget.scrollTop;
              }}
              placeholder="여기에 이어서 편하게 적어주세요…"
              disabled={busy}
              className="absolute inset-0 resize-none whitespace-pre-wrap break-words bg-transparent font-[family-name:var(--font-diary)] text-[15px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)] disabled:opacity-60"
            />
          </div>
          <div className="flex shrink-0 justify-end">
            <button
              type="button"
              onClick={handleSend}
              disabled={!pendingText.trim() || busy}
              className="rounded-full border border-[var(--ink)] px-4 py-1.5 text-[12.5px] font-medium text-[var(--ink)] disabled:opacity-40"
            >
              {sending ? "살펴보는 중…" : "살펴보기"}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2.5 rounded-xl bg-[var(--paper-raised)] px-2.5 py-2">
          <div className="w-10 shrink-0">
            <DiaryStamp
              stampKind={hasPhoto ? "photo" : "keyword"}
              stampKey={previewStampKey}
              photoUrl={previewPhotoUrl}
              className="w-full drop-shadow-md"
            />
          </div>
          <p className="flex-1 text-[11px] leading-snug text-[var(--ink-soft)]">
            사진을 추가하고, 오늘의 우표로 붙여보세요.
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
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--paper-line)] bg-[var(--paper-raised)] px-2.5 py-1.5 text-[11px] text-[var(--ink)]"
          >
            <UiIcon name="camera-line" className="h-3.5 w-3.5" alt="">
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
          className="shrink-0 w-full rounded-full bg-[var(--cta)] px-7 py-4 text-base font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-40"
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
