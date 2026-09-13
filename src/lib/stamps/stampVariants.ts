import type { StampId } from "@/lib/stamps/keywordMap";

/**
 * How many hand-picked image variants actually exist for a keyword — a
 * keyword missing here has just the one built-in image (exactly today's
 * behavior). Bump this number as more variant images are uploaded to the
 * "stamp-icons" Storage bucket (see KeywordIcon.tsx for the "<id>-<n>.ext"
 * naming this pairs with) — no other code needs to change.
 */
export const STAMP_VARIANT_COUNT: Partial<Record<StampId, number>> = {};

export function stampVariantCount(id: StampId): number {
  return STAMP_VARIANT_COUNT[id] ?? 1;
}

/**
 * Picks one of `id`'s variants at random, 1-indexed. Unlike `pickStamp` (or
 * stampTiltDeg's seeded pseudo-random), this is meant to be called exactly
 * once — right when a stamp is being finalized for saving — and its result
 * persisted (SessionStamp.stampVariant / diary_entries.stamp_variant) so
 * the same day always shows the same variant afterward. Because of that,
 * a plain Math.random() here is safe: this never runs during render (no
 * SSR/hydration mismatch to worry about) and never runs more than once per
 * stamp (no re-render jitter either) — see stampTiltDeg's own doc comment
 * for why those two things matter elsewhere and don't here.
 */
export function pickStampVariant(id: StampId): number {
  return 1 + Math.floor(Math.random() * stampVariantCount(id));
}
