import type { StampSourceEntry } from "@/lib/diary/client";
import { KEYWORD_CATEGORIES, type StampId } from "@/lib/stamps/keywordMap";
import type { SessionStamp, StampKind } from "@/types/diary";

/** One keyword stamp id and how many sessions (across every entry) it was
 * actually picked for. Only ids that appeared at least once. */
export interface KeywordStampCount {
  stampKey: StampId;
  count: number;
}

/** One category's own collected keywords — only the ones that actually
 * appeared at least once, sorted most-picked-first. Categories with
 * nothing collected in them yet are left out of `StampCollection.
 * keywordCategories` entirely rather than showing up empty. */
export interface KeywordCategoryGroup {
  label: string;
  items: KeywordStampCount[];
}

/** One actual stamp for the day-by-day timeline shown in 우표 모음's
 * "전체"/"사진우표" tabs — either a specific session's own photo, or (for
 * `allStamps` only) one distinct keyword's single representative entry.
 * Unlike `KeywordStampCount` (one row per distinct keyword, occurrences
 * merged, no date), this always carries an `entryDate` to place it in the
 * timeline. */
export interface TimelineStampItem {
  stampKind: StampKind;
  stampKey: StampId | null;
  stampVariant: number | null;
  photoPath: string | null;
  entryDate: string;
  session: number;
  /** Passed straight through to photoPublicUrl's cache-buster — every
   * day's photo is uploaded to the same fixed storage path (see
   * uploadStampPhoto), so without this a re-crop can keep showing the
   * old cached image at that same URL forever. Meaningless for a keyword
   * entry (no photo to fetch). */
  createdAt: string;
}

export interface StampCollection {
  totalCount: number;
  photoCount: number;
  keywordCount: number;
  /** Every photo stamp, most-recent-entry-first (see
   * fetchAllEntriesForStamps), multiple photos on the same day keeping
   * their session order within that day. Used by the "사진우표" tab. */
  photoStamps: TimelineStampItem[];
  /** Every photo stamp plus one entry per distinct keyword — unlike a
   * photo (always a different picture), the same keyword's stamp art is
   * identical every time it's picked, so a repeat contributes nothing a
   * single copy doesn't already show. That single copy is anchored to the
   * keyword's *first-ever* occurrence date, not its most recent — like a
   * real stamp album, each design appears once, at the point it was first
   * collected. Merged with the photos and sorted most-recent-first for
   * the "전체" tab, so the two interleave by date instead of keywords
   * sitting in their own separate, dateless section. */
  allStamps: TimelineStampItem[];
  /** Every keyword-stamp category (see KEYWORD_CATEGORIES) that has at
   * least one collected keyword in it, in that same category order —
   * for the "수집우표" tab, which groups by category instead. */
  keywordCategories: KeywordCategoryGroup[];
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
      // Not fetched by fetchAllEntriesForStamps (a pre-per-session entry
      // never recorded which variant it used at the top level either) —
      // falls back to variant 0, same as DiaryStamp's own default.
      stampVariant: null,
      photoPath: entry.photo_path,
      createdAt: entry.entry_date,
    },
  ];
}

function sortMostPickedFirst(counts: KeywordStampCount[]): KeywordStampCount[] {
  return counts.sort((a, b) => b.count - a.count);
}

/** `entries` should already be sorted most-recent-first (see
 * fetchAllEntriesForStamps) so `photoStamps` comes out in that same
 * recency order without a separate sort here. */
export function collectStamps(entries: StampSourceEntry[]): StampCollection {
  const photoStamps: TimelineStampItem[] = [];
  const countByKey = new Map<string, number>();
  const firstSeenOrder: StampId[] = [];
  const firstDateByKey = new Map<StampId, string>();

  for (const entry of entries) {
    for (const s of resolveStamps(entry)) {
      if (s.stampKind === "photo") {
        // A photo session with no actual photo path is nothing to show —
        // dropped here rather than counted or displayed as a blank stamp.
        if (!s.photoPath) continue;
        photoStamps.push({
          stampKind: "photo",
          stampKey: null,
          stampVariant: s.stampVariant,
          photoPath: s.photoPath,
          entryDate: entry.entry_date,
          session: s.session,
          createdAt: s.createdAt,
        });
        continue;
      }

      const key = (s.stampKey ?? "default") as StampId;
      if (!countByKey.has(key)) firstSeenOrder.push(key);
      countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
      // entries iterate most-recent-first, so the last write below (from
      // the oldest entry that has this key) is the one that sticks —
      // ending up as this key's first-ever occurrence date.
      firstDateByKey.set(key, entry.entry_date);
    }
  }

  const keywordCount = [...countByKey.values()].reduce((sum, n) => sum + n, 0);

  const keywordCategories: KeywordCategoryGroup[] = KEYWORD_CATEGORIES.map((category) => ({
    label: category.label,
    items: sortMostPickedFirst(
      category.ids
        .filter((id) => countByKey.has(id))
        .map((id) => ({ stampKey: id, count: countByKey.get(id)! }))
    ),
  })).filter((group) => group.items.length > 0);

  const keywordTimelineItems: TimelineStampItem[] = firstSeenOrder.map((stampKey) => {
    const entryDate = firstDateByKey.get(stampKey)!;
    return {
      stampKind: "keyword",
      stampKey,
      stampVariant: null,
      photoPath: null,
      entryDate,
      session: 0,
      createdAt: entryDate,
    };
  });

  // A stable sort keeps same-date items in their existing relative order
  // (photos before that date's keywords is arbitrary but consistent).
  const allStamps = [...photoStamps, ...keywordTimelineItems].sort((a, b) =>
    a.entryDate < b.entryDate ? 1 : a.entryDate > b.entryDate ? -1 : 0
  );

  return {
    totalCount: photoStamps.length + keywordCount,
    photoCount: photoStamps.length,
    keywordCount,
    photoStamps,
    allStamps,
    keywordCategories,
  };
}
