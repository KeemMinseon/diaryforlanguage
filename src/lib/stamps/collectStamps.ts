import type { StampSourceEntry } from "@/lib/diary/client";
import type { StampId } from "@/lib/stamps/keywordMap";
import type { SessionStamp } from "@/types/diary";

/** One keyword stamp id and how many sessions (across every entry) it was
 * actually picked for. Only ids that appeared at least once — see
 * `collectStamps`. */
export interface KeywordStampCount {
  stampKey: StampId;
  count: number;
}

/** One photo attached to some session's stamp, for the 우표 모아보기
 * gallery. */
export interface PhotoStampItem {
  photoPath: string;
  /** Which day this photo's session belongs to — not surfaced anywhere
   * yet (the gallery only opens a lightbox in place), but kept since it's
   * free from the source data and any future "go to that day" link would
   * want it. */
  entryDate: string;
  session: number;
}

export interface StampCollection {
  /** Sorted most-picked-first. */
  keywordCounts: KeywordStampCount[];
  /** Same order as `entries` was given in (most-recent-entry-first, see
   * fetchAllEntriesForStamps) — multiple photos on the same day keep
   * their session order within that day. */
  photoStamps: PhotoStampItem[];
}

/** An entry saved before per-session stamps existed has an empty `stamps`
 * array — same fallback used by ReviewView: synthesize the one implicit
 * stamp it does have from the top-level columns instead of counting it
 * as nothing. */
function resolveStamps(entry: StampSourceEntry): SessionStamp[] {
  if (entry.stamps.length > 0) return entry.stamps;
  return [
    {
      session: 0,
      stampKind: entry.stamp_kind,
      stampKey: entry.stamp_key,
      photoPath: entry.photo_path,
      createdAt: entry.entry_date,
    },
  ];
}

/** `entries` should already be sorted most-recent-first (see
 * fetchAllEntriesForStamps) so `photoStamps` comes out in that same
 * order without a separate sort here. */
export function collectStamps(entries: StampSourceEntry[]): StampCollection {
  const countByKey = new Map<string, number>();
  const photoStamps: PhotoStampItem[] = [];

  for (const entry of entries) {
    for (const s of resolveStamps(entry)) {
      if (s.stampKind === "photo") {
        if (s.photoPath) {
          photoStamps.push({ photoPath: s.photoPath, entryDate: entry.entry_date, session: s.session });
        }
        continue;
      }
      const key = s.stampKey ?? "default";
      countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
    }
  }

  const keywordCounts = Array.from(countByKey.entries())
    .map(([stampKey, count]) => ({ stampKey: stampKey as StampId, count }))
    .sort((a, b) => b.count - a.count);

  return { keywordCounts, photoStamps };
}
