import type { StampId } from "@/lib/stamps/keywordMap";

/** Pale paper tints and ink colors per keyword stamp, hand-picked to sit
 * quietly on washi paper without fighting the vermilion 添削 hanko. */
export const STAMP_STYLE: Record<StampId, { tint: string; ink: string }> = {
  rain: { tint: "#e7eef2", ink: "#4a6b7a" },
  snow: { tint: "#eef3f6", ink: "#5b7c8c" },
  sun: { tint: "#faf1dc", ink: "#c1791f" },
  coffee: { tint: "#f1e6d8", ink: "#6b4a30" },
  food: { tint: "#f7ece0", ink: "#a35b2a" },
  travel: { tint: "#e9f0f0", ink: "#2f6f6b" },
  study: { tint: "#eef0e4", ink: "#546b3a" },
  sleep: { tint: "#e9e6f1", ink: "#544a80" },
  exercise: { tint: "#f3e9e6", ink: "#a34a3a" },
  music: { tint: "#f0e9f2", ink: "#7a4a80" },
  book: { tint: "#efe8db", ink: "#6b5530" },
  heart: { tint: "#fbe9ea", ink: "#b8465a" },
  sad: { tint: "#e9edf1", ink: "#5a6a80" },
  work: { tint: "#eae6de", ink: "#5a4f3a" },
  friend: { tint: "#f1ecdf", ink: "#8a6a2a" },
  cat: { tint: "#f0ebe1", ink: "#7a5a3a" },
  flower: { tint: "#f8ecef", ink: "#a85570" },
  default: { tint: "#f4ede0", ink: "#5c4a32" },
};
