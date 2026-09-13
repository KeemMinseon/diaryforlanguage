import type { StampId } from "@/lib/stamps/keywordMap";

/** One neutral tint/ink pair, reused for every keyword stamp — stamps used
 * to each carry their own pale paper tint and ink color (hand-picked per
 * category so they'd sit quietly on washi paper without fighting the
 * vermilion 添削 hanko), but the app went fully monochrome and that hanko
 * is ink now too, so the per-keyword color variety no longer has a role to
 * play. A stamp is told apart from another by its icon shape now, not its
 * color. Kept as a `Record<StampId, …>` (every key mapping to the same
 * value) rather than collapsing to a single constant, so callers that look
 * up `STAMP_STYLE[id]` don't need to change. */
const NEUTRAL = { tint: "#e7e2d8", ink: "#000000" };

export const STAMP_STYLE: Record<StampId, { tint: string; ink: string }> = {
  rain: NEUTRAL,
  snow: NEUTRAL,
  sun: NEUTRAL,
  coffee: NEUTRAL,
  food: NEUTRAL,
  travel: NEUTRAL,
  study: NEUTRAL,
  sleep: NEUTRAL,
  exercise: NEUTRAL,
  music: NEUTRAL,
  book: NEUTRAL,
  joy: NEUTRAL,
  sad: NEUTRAL,
  work: NEUTRAL,
  cat: NEUTRAL,
  flower: NEUTRAL,
  celebration: NEUTRAL,
  shopping: NEUTRAL,
  movie: NEUTRAL,
  phone: NEUTRAL,
  rest: NEUTRAL,
  cook: NEUTRAL,
  dog: NEUTRAL,
  cloud: NEUTRAL,
  bread: NEUTRAL,
  calendar: NEUTRAL,
  chat: NEUTRAL,
  heart: NEUTRAL,
  mountain: NEUTRAL,
  ocean: NEUTRAL,
  rainbow: NEUTRAL,
  tomato: NEUTRAL,
  gimbap: NEUTRAL,
  sushi: NEUTRAL,
  bibimbap: NEUTRAL,
  burger: NEUTRAL,
  pizza: NEUTRAL,
  salad: NEUTRAL,
  default: NEUTRAL,
};
