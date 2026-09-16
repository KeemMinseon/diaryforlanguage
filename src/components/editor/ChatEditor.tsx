"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PhotoCropModal from "@/components/editor/PhotoCropModal";
import UiIcon from "@/components/icons/UiIcon";
import FuriganaText from "@/components/review/FuriganaText";
import ReadingsHint from "@/components/review/ReadingsHint";
import { useToast } from "@/components/toast/ToastProvider";
import { pickStamp } from "@/lib/stamps/keywordMap";
import { pickStampVariant } from "@/lib/stamps/stampVariants";
import { saveEntry, uploadStampPhoto } from "@/lib/diary/client";
import { notifyDiaryStamped } from "@/lib/events/diaryStamped";
import { buildHighlightSegments } from "@/lib/review/highlight";
import { formatEntryHeaderDate, formatSavedAt, parseDateKey } from "@/lib/utils/date";
import type { DiaryEntry, DiaryParagraph, Reading, SessionStamp, Suggestion } from "@/types/diary";

interface FeedbackRound {
  text: string;
  comment: string;
  suggestions: Suggestion[];
  readings: Reading[];
  translation: string;
  savedAt: string;
  /** Which "이어서 쓰기" sitting this round belongs to — see
   * `DiaryParagraph.session`/`SessionStamp`. */
  session: number;
}

/** The day's "front" stamp — the one the calendar shows and the one
 * mirrored into the top-level stamp_kind/stamp_key/stamp_variant/
 * photo_path columns (see the save calls below). A photo always wins
 * that spot over a keyword stamp, even if it came from a later "이어서
 * 쓰기" sitting than the day's actual first one — a learner who adds a
 * photo partway through the day almost always wants *that* to be what
 * the calendar shows, not whatever keyword the morning's first sitting
 * happened to pick. Falls back to the literal first sitting when
 * nothing that day is a photo yet. */
function frontStamp(stamps: SessionStamp[]): SessionStamp {
  return stamps.find((s) => s.stampKind === "photo") ?? stamps[0];
}

/** How far the true bottom edge of what's actually visible sits above the
 * bottom of the layout viewport — 0 with no on-screen keyboard, roughly
 * the keyboard's own height once one is open. `interactiveWidget:
 * resizes-content` (see layout.tsx) asks the browser to shrink the layout
 * viewport itself so plain `dvh` sizing already accounts for the
 * keyboard — Chrome honors that, but real-device testing on Safari (iOS)
 * showed it does not: the layout viewport, and anything sized in `vh`/
 * `dvh`, stayed exactly the same after the keyboard opened, so a plain
 * `position: fixed` bottom bar (or one sized off `dvh`) ended up hidden
 * behind the keyboard. `visualViewport` tracks the actually-visible
 * region directly and reliably shrinks on every browser regardless of
 * that meta hint, so this is used to keep the bottom action bar pinned
 * just above whatever's currently covering the screen instead of trusting
 * viewport units alone. */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function update() {
      const hidden = window.innerHeight - (vv!.height + vv!.offsetTop);
      setInset(Math.max(0, Math.round(hidden)));
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
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
      translation: p.translation ?? "",
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
      // No per-paragraph translation ever existed for a flat pre-`paragraphs` entry.
      translation: "",
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
              className="bg-black/[0.06] text-transparent underline decoration-[var(--ink)] decoration-2 underline-offset-4"
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
      className="flex flex-col gap-3 bg-[var(--paper-raised)] p-4 border border-[var(--paper-line)]"
    >
      <p className="whitespace-pre-wrap font-[family-name:var(--font-diary)] text-[15px] leading-relaxed text-[var(--ink)]">
        {buildHighlightSegments(r.text, r.suggestions).map((seg, si) =>
          seg.suggestionIndex === null ? (
            <span key={si}>{seg.text}</span>
          ) : (
            <mark
              key={si}
              className="bg-black/[0.06] px-0.5 text-[var(--ink)] underline decoration-[var(--ink)] decoration-2 underline-offset-4"
            >
              {seg.text}
            </mark>
          )
        )}
      </p>
      {(r.comment || r.suggestions.length > 0 || r.readings.length > 0) && (
        <div className="flex flex-col gap-1.5 border-t border-[var(--paper-line)] pt-2.5">
          <p className="text-[10px] text-[var(--ink-tertiary)]">{formatSavedAt(r.savedAt, dateKey)}</p>
          {r.comment && <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{r.comment}</p>}
          <ReadingsHint readings={r.readings} label="읽는 법" />
          {r.suggestions.map((s, j) => (
            <span
              key={j}
              className="inline-flex w-fit items-center gap-1.5 border border-[var(--paper-line)] bg-[var(--paper-raised)] px-2.5 py-1"
            >
              <span className="text-[13px] text-[var(--ink-soft)] line-through">
                <FuriganaText text={s.original} readings={r.readings} />
              </span>
              <UiIcon name="arrow-right-line" className="h-3 w-3" alt="">
                <span aria-hidden="true">→</span>
              </UiIcon>
              <span className="font-[family-name:var(--font-diary)] text-base font-medium text-[var(--ink)]">
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
  const keyboardInset = useKeyboardInset();
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
      // Bounds the wait to a bit past this route's own `maxDuration` (45s)
      // — without this, a request the platform kills mid-flight (or one
      // that just never gets a response back for some other reason) left
      // this promise hanging forever instead of ever reaching the catch
      // block below, which is what actually saves a visible "failed"
      // status. A learner watching "검토 중이에요…" has no way to tell
      // that apart from it actually still being in progress.
      signal: AbortSignal.timeout(50_000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "첨삭 요청에 실패했어요.");
    return {
      text: chunk,
      comment: data.comment,
      suggestions: data.suggestions ?? [],
      readings: data.readings ?? [],
      translation: data.translation ?? "",
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
    // Picked once, right here at save time, and carried into `stamps`
    // below untouched from then on — see pickStampVariant's own doc
    // comment for why this is the one safe place to call it.
    const stampVariant = stampKey ? pickStampVariant(stampKey) : null;
    const allSoFar = [...lockedRounds, ...rounds];
    const existingSuggestions = allSoFar.flatMap((r) => r.suggestions);
    const existingReadings = allSoFar.flatMap((r) => r.readings);
    const existingParagraphs: DiaryParagraph[] = allSoFar.map((r) => ({
      text: r.text,
      comment: r.comment,
      suggestions: r.suggestions,
      readings: r.readings,
      translation: r.translation,
      savedAt: r.savedAt,
      session: r.session,
    }));
    // Every earlier sitting's own stamp, plus this one's — appended once
    // here (after `photoPath` is settled) and reused for every save below,
    // pending/reviewed/failed alike, so a sitting's stamp is visible even
    // before its own review finishes.
    let stamps: SessionStamp[] = initialEntry?.stamps ?? [];
    // Assigned once `stamps` is finalized below, then reused by every save
    // call in this function (pending/reviewed/failed alike) — declared out
    // here rather than inside the try block so the later background
    // review/finalize pass (a separate async closure further down) can
    // still reach it.
    let front: SessionStamp;

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
        {
          session: currentSession,
          stampKind,
          stampKey,
          stampVariant,
          photoPath,
          createdAt: new Date().toISOString(),
        },
      ];
      front = frontStamp(stamps);

      await saveEntry({
        userId,
        dateKey,
        content: fullText,
        // The calendar reads the top-level stamp_kind/stamp_key/photo_path
        // columns directly (see DayCell) rather than the first entry of
        // `stamps` — kept in sync with `front` (see frontStamp's own doc
        // comment) here instead, so the calendar keeps showing the same
        // stamp it always has for this day even after a later "이어서
        // 쓰기" adds more sittings, rather than jumping to whichever one
        // was saved most recently (unless that one's a photo).
        stampKind: front.stampKind,
        stampKey: front.stampKey,
        stampVariant: front.stampVariant,
        photoPath: front.photoPath,
        status: "pending",
        title: initialEntry?.title ?? null,
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
            // See reviewChunk's identical comment — bounds this past its
            // own route's `maxDuration` (30s) instead of risking an
            // indefinitely hanging promise.
            signal: AbortSignal.timeout(35_000),
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
          translation: r.translation,
          savedAt: r.savedAt,
          session: r.session,
        }));

        await saveEntry({
          userId,
          dateKey,
          content: fullText,
          stampKind: front.stampKind,
          stampKey: front.stampKey,
          stampVariant: front.stampVariant,
          photoPath: front.photoPath,
          status: "reviewed",
          title: finalizeData.title ?? initialEntry?.title ?? null,
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
          initialEntry ? "이어서 쓴 내용에도 우표를 붙였어요! 📮" : "오늘 일기에 우표를 붙였어요! 📮"
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
            stampKind: front.stampKind,
            stampKey: front.stampKey,
            stampVariant: front.stampVariant,
            photoPath: front.photoPath,
            status: "failed",
            title: initialEntry?.title ?? null,
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

  // This visit's own suggestions/readings, flattened across every round
  // reviewed so far — `feedHistory` (unlike `rounds`) never rolls back
  // when the learner fixes a flagged spot, so a fix already applied still
  // shows up here as a record of what was caught, instead of vanishing
  // from the "고칠 곳" list the moment its own cause is gone.
  const suggestionEntries = feedHistory.flatMap((r) =>
    r.suggestions.map((s) => ({ suggestion: s, readings: r.readings }))
  );
  const allReadingsSoFar = feedHistory.flatMap((r) => r.readings);
  const latestComment = feedHistory.length > 0 ? feedHistory[feedHistory.length - 1].comment : "";
  const hasReviewed = feedHistory.length > 0;

  const charCount = content.trim().length;
  const sentenceCount = (content.match(/[。.!?！？]/g) ?? []).length;

  return (
    <>
      {/* A normal scrolling page, not an internal split-pane — see
          useKeyboardInset's own comment for why the bottom bar below is
          `position: fixed` and JS-tracked instead of relying on `dvh`
          sizing here. `pb-24` reserves room so the last line of text (or
          the "고칠 곳" card) can always scroll clear of that fixed bar
          instead of sitting hidden underneath it. */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pb-24 pt-4">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex w-fit shrink-0 items-center gap-1 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <UiIcon name="bracket-left-line" className="h-3.5 w-3.5" alt="">
            ←
          </UiIcon>
          캘린더
        </button>

        {/* Big day-of-month number, same visual weight as the calendar/
            stamps/words screens' own big headline number — the top-right
            label switches from the plain date to a running "N NOTES" count
            the moment this visit's own writing has actually been reviewed
            at least once, same trigger as the "고칠 곳" card below. Hidden
            once the keyboard is actually open: on a real device this is
            the first thing tapped to start writing, so it was costing
            real typing room the moment the keyboard appeared rather than
            once the learner had already scrolled past it. The back link
            above stays up regardless, so leaving the screen is never
            blocked on dismissing the keyboard first. */}
        <div className={`flex shrink-0 items-end justify-between ${keyboardInset > 0 ? "hidden" : ""}`}>
          <p className="font-[family-name:var(--font-heading)] text-6xl font-bold text-[var(--ink)]">
            {parseDateKey(dateKey).getDate()}
          </p>
          <p className="pb-1 font-mono text-xs tracking-wide text-[var(--ink-soft)]">
            {hasReviewed ? `${suggestionEntries.length} NOTES` : formatEntryHeaderDate(dateKey)}
          </p>
        </div>

        {lockedRounds.map((r, i) => renderLockedRound(r, dateKey, `locked-${i}`))}
        {lockedRounds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-[var(--paper-line)]" />
            <p className="shrink-0 text-[11px] text-[var(--ink-soft)]">여기서부터 이어서 써요</p>
            <span className="h-px flex-1 bg-[var(--paper-line)]" />
          </div>
        )}

        {/* This backdrop is decoration only — every character in it is
            invisible, it just paints a highlight behind where a matched
            suggestion sits. The textarea on top keeps its own text fully
            visible and completely normal, so typing (Japanese IME
            composition included) still works exactly like a plain input;
            only the highlight lives underneath. Kept in sync on scroll
            since only the (topmost, interactive) textarea actually
            receives scroll input. No bordered box around it any more —
            it now reads as one continuous page, not an input pinned
            inside its own card. `min-h` is just an initial comfortable
            size here, not load-bearing for keyboard handling (see
            useKeyboardInset) — plain `vh` is fine. */}
        <div className="relative min-h-[40vh] flex-1">
          <div
            ref={backdropRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-transparent font-[family-name:var(--font-diary)] text-lg leading-relaxed"
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
            placeholder={
              initialEntry ? "여기에 이어서 편하게 적어주세요…" : "오늘 하루는 어땠나요? 편하게 적어보세요."
            }
            disabled={busy}
            className="absolute inset-0 resize-none whitespace-pre-wrap break-words bg-transparent font-[family-name:var(--font-diary)] text-lg leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)] disabled:opacity-60"
          />
        </div>

        {sending && (
          <p className="flex shrink-0 items-center gap-2 text-[12.5px] text-[var(--ink-soft)]">
            <span className="flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 bg-[var(--ink-soft)]"
                style={{ animation: "typing-bounce 1.1s ease-in-out infinite", animationDelay: "0ms" }}
              />
              <span
                className="h-1.5 w-1.5 bg-[var(--ink-soft)]"
                style={{ animation: "typing-bounce 1.1s ease-in-out infinite", animationDelay: "150ms" }}
              />
              <span
                className="h-1.5 w-1.5 bg-[var(--ink-soft)]"
                style={{ animation: "typing-bounce 1.1s ease-in-out infinite", animationDelay: "300ms" }}
              />
            </span>
            살펴보고 있어요
          </p>
        )}

        {/* One aggregated card for everything this visit's writing has
            been flagged for so far, right under the text it's about —
            replaces the old running feed of one card per "살펴보기"
            click stacked above the box. */}
        {suggestionEntries.length > 0 && (
          <section className="flex flex-col gap-3 bg-[var(--card-highlight)] p-4 border border-[var(--paper-line)]">
            <p className="font-mono text-xs tracking-wide text-[var(--ink-soft)]">
              고칠 곳 {suggestionEntries.length}
            </p>
            {latestComment && (
              <p className="text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{latestComment}</p>
            )}
            <div className="flex flex-col gap-2.5">
              {suggestionEntries.map(({ suggestion: s, readings }, i) => (
                <div key={i} className="flex flex-col gap-0.5 border-l-2 border-[var(--paper-line)] pl-3">
                  <p className="font-[family-name:var(--font-diary)] text-base text-[var(--ink)]">
                    <span className="text-[var(--ink-tertiary)] line-through decoration-1">
                      <FuriganaText text={s.original} readings={readings} />
                    </span>{" "}
                    → <FuriganaText text={s.suggestion} readings={readings} />
                  </p>
                  {s.note && <p className="text-xs text-[var(--ink-soft)]">{s.note}</p>}
                </div>
              ))}
            </div>
            <ReadingsHint readings={allReadingsSoFar} label="읽는 법" />
          </section>
        )}

        {error && <p className="shrink-0 text-sm font-medium text-[var(--ink)]">{error}</p>}

        <div ref={threadEndRef} />
      </div>

      {/* One slim action bar: photo attach, a live char/sentence count,
          then 첨삭(review) and 저장(save) side by side. Pinned via
          `position: fixed` with a JS-tracked `bottom` offset (see
          useKeyboardInset) rather than sitting in normal flow at the end
          of an `h-dvh` column — that relied on the browser actually
          shrinking `dvh` for an open keyboard, which real-device Safari
          testing showed it does not. Which stamp this sitting ends up
          with (this photo, or an auto-picked keyword) is still only
          decided at save time (see handleFinish's own `pickStamp` call
          below), not guessed live here. */}
      <div
        className="fixed inset-x-0 z-10 mx-auto flex w-full max-w-2xl items-center gap-2.5 border-t border-[var(--paper-line)] bg-[var(--paper)] px-4 py-3"
        style={{ bottom: keyboardInset }}
      >
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={hasPhoto ? "사진 다시 선택" : "사진 추가"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center border ${
            hasPhoto ? "border-[var(--ink)] text-[var(--ink)]" : "border-[var(--paper-line)] text-[var(--ink-soft)]"
          }`}
        >
          <UiIcon name="camera-line" className="h-4 w-4" alt="">
            📷
          </UiIcon>
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
        <p className="flex-1 text-right font-mono text-[11px] text-[var(--ink-soft)]">
          {charCount} CHARS · {sentenceCount} SENT
        </p>
        <button
          type="button"
          onClick={handleSend}
          disabled={!pendingText.trim() || busy}
          className="shrink-0 border border-[var(--ink)] px-4 py-2 text-[12.5px] font-medium text-[var(--ink)] disabled:opacity-40"
        >
          {sending ? "확인 중…" : "첨삭"}
        </button>
        <button
          type="button"
          onClick={handleFinish}
          disabled={!content.trim() || busy}
          className="shrink-0 bg-[var(--cta)] px-5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
        >
          {finishing ? "저장 중…" : "저장"}
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
    </>
  );
}
