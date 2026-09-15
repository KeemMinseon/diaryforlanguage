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

/** One actual stamp — a specific session's own, keyword or photo — for the
 * day-by-day timeline shown in 우표 모음's "전체"/"사진우표" tabs. Unlike
 * `KeywordStampCount` (one row per distinct keyword, occurrences merged),
 * this is one row per occurrence, since a timeline is about *when* each
 * stamp was collected, not how many of a kind. */
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
   * old cached image at that same URL forever. */
  createdAt: string;
}

export interface StampCollection {
  totalCount: number;
  photoCount: number;
  keywordCount: number;
  /** Every stamp, keyword and photo alike — same order `entries` was given
   * in (most-recent-entry-first, see fetchAllEntriesForStamps), multiple
   * stamps on the same day keeping their session order within that day. */
  allStamps: TimelineStampItem[];
  /** Same order as `allStamps`, filtered to just the photo ones. */
  photoStamps: TimelineStampItem[];
  /** Every keyword-stamp category (see KEYWORD_CATEGORIES) that has at
   * least one collected keyword in it, in that same category order. */
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
 * fetchAllEntriesForStamps) so `allStamps`/`photoStamps` come out in that
 * same order without a separate sort here. */
export function collectStamps(entries: StampSourceEntry[]): StampCollection {
  const allStamps: TimelineStampItem[] = [];
  const countByKey = new Map<string, number>();

  for (const entry of entries) {
    for (const s of resolveStamps(entry)) {
      // A photo session with no actual photo path is nothing to show —
      // dropped here rather than counted or displayed as a blank stamp.
      if (s.stampKind === "photo" && !s.photoPath) continue;

      allStamps.push({
        stampKind: s.stampKind,
        stampKey: s.stampKey as StampId | null,
        stampVariant: s.stampVariant,
        photoPath: s.photoPath,
        entryDate: entry.entry_date,
        session: s.session,
        createdAt: s.createdAt,
      });

      if (s.stampKind === "keyword") {
        const key = s.stampKey ?? "default";
        countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
      }
    }
  }

  const photoStamps = allStamps.filter((s) => s.stampKind === "photo");

  const keywordCategories: KeywordCategoryGroup[] = KEYWORD_CATEGORIES.map((category) => ({
    label: category.label,
    items: sortMostPickedFirst(
      category.ids
        .filter((id) => countByKey.has(id))
        .map((id) => ({ stampKey: id, count: countByKey.get(id)! }))
    ),
  })).filter((group) => group.items.length > 0);

  return {
    totalCount: allStamps.length,
    photoCount: photoStamps.length,
    keywordCount: allStamps.length - photoStamps.length,
    allStamps,
    photoStamps,
    keywordCategories,
  };
}
