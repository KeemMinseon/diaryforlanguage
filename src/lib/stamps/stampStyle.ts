import type { StampId } from "@/lib/stamps/keywordMap";

/**
 * Pale paper tint per keyword stamp — the flat color behind the stamp's
 * artwork (see StampFrame), quiet enough to sit on washi paper without
 * fighting the vermilion 添削 hanko. It's also what shows through on its
 * own (no icon on top) for a keyword whose image hasn't been uploaded yet
 * — see KeywordIcon.
 *
 * With 152 keywords (see keywordMap.ts), hand-picking a tint per id the
 * way the original smaller set did stopped being practical — this instead
 * derives a stable pastel deterministically from the id string itself,
 * the same hash+fmix32 approach stampTiltDeg uses for its per-day tilt
 * (see that file's own doc comment for why a plain string hash alone
 * doesn't spread similar inputs well). Two different ids reliably land on
 * two different hues; the same id always lands on the same tint.
 */
export function stampTint(id: StampId): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  hash = fmix32(hash);
  const hue = Math.abs(hash) % 360;
  // Low saturation, high lightness — pale enough to read as "paper", not
  // as a colored sticker.
  return `hsl(${hue}, 42%, 92%)`;
}

function fmix32(h: number): number {
  let x = h;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x;
}
