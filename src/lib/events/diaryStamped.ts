"use client";

const EVENT_NAME = "diary:stamped";

/**
 * Fired once a day's diary entry gets its *final*, reviewed stamp saved
 * — from ChatEditor's "마치기" (which finishes its AI review in the
 * background after the writing screen has already closed/navigated away)
 * and from ParagraphListEditor's per-row "수정 완료" (whose 첨삭 already
 * ran synchronously before the save, so this fires right away). The
 * calendar, if it happens to be the screen showing right then, listens
 * for this to play a real "stamp coming down" animation on that exact
 * day instead of just silently updating once re-fetched.
 *
 * A plain `window` CustomEvent rather than any state/context — the
 * calendar may or may not be mounted when this fires (the learner could
 * have navigated elsewhere entirely by the time the background review
 * finishes), and there's nothing wrong with the event simply going
 * unheard in that case.
 */
export function notifyDiaryStamped(dateKey: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENT_NAME, { detail: dateKey }));
}

/** Returns an unsubscribe function — call it from a `useEffect` cleanup. */
export function onDiaryStamped(handler: (dateKey: string) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
