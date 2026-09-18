import type { StampSourceEntry } from "@/lib/diary/client";
import { KEYWORD_CATEGORIES, type StampId } from "@/lib/stamps/keywordMap";
import type { SessionStamp, StampKind } from "@/types/diary";

/** One *distinct picture* — a keyword plus which of its uploaded variants —
 * and how many sessions (across every entry) actually picked exactly that
 * combination. Two sessions that both picked "hope" but got different
 * variants (see pickStampVariant) are two separate entries here, each with
 * its own count; only a repeat of the *same* keyword+variant merges into
 * one. `stampVariant` is that combination's own variant, always the one
 * actually rendered — needed here (not just derivable from `allStamps`)
 * because the "수집우표" tab's grid renders straight off this list. */
export interface KeywordStampCount {
  stampKey: StampId;
  count: number;
  stampVariant: number | null;
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
  /** Every photo stamp plus one entry per distinct keyword+variant *picture*
   * — a repeat of the exact same picture only adds to its count (see
   * `keywordCategories`), not a second tile here, but the same keyword
   * picked with a *different* variant (see pickStampVariant) is a genuinely
   * different picture and gets its own tile. Each tile is anchored to that
   * picture's *first-ever* occurrence date — like a real stamp album, each
   * design appears once, at the point it was first collected. Merged with
   * the photos and sorted most-recent-first for the "전체" tab, so the two
   * interleave by date instead of keywords sitting in their own separate,
   * dateless section. */
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

/** Identifies one distinct *picture* — a keyword id plus which variant —
 * so two different variants of the same keyword are tracked as separate
 * pictures throughout this function, not merged into one. `null` and `0`
 * are the same picture (KeywordIcon's own `variant ?? 0` fallback), so
 * both normalize to the same key here. */
function pictureKeyOf(stampKey: StampId, stampVariant: number | null): string {
  return `${stampKey}:${stampVariant ?? 0}`;
}

/** `entries` should already be sorted most-recent-first (see
 * fetchAllEntriesForStamps) so `photoStamps` comes out in that same
 * recency order without a separate sort here. */
export function collectStamps(entries: StampSourceEntry[]): StampCollection {
  const photoStamps: TimelineStampItem[] = [];
  const countByPictureKey = new Map<string, number>();
  const firstSeenOrder: string[] = [];
  const firstOccurrenceByPictureKey = new Map<
    string,
    { stampKey: StampId; stampVariant: number | null; entryDate: string; createdAt: string }
  >();

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

      const stampKey = (s.stampKey ?? "default") as StampId;
      const pictureKey = pictureKeyOf(stampKey, s.stampVariant);
      if (!countByPictureKey.has(pictureKey)) firstSeenOrder.push(pictureKey);
      countByPictureKey.set(pictureKey, (countByPictureKey.get(pictureKey) ?? 0) + 1);
      // entries iterate most-recent-first, so the last write below (from
      // the oldest entry with this exact keyword+variant) is the one that
      // sticks — ending up as this picture's first-ever occurrence date.
      firstOccurrenceByPictureKey.set(pictureKey, {
        stampKey,
        stampVariant: s.stampVariant,
        entryDate: entry.entry_date,
        createdAt: s.createdAt,
      });
    }
  }

  const keywordCount = [...countByPictureKey.values()].reduce((sum, n) => sum + n, 0);

  const keywordCategories: KeywordCategoryGroup[] = KEYWORD_CATEGORIES.map((category) => ({
    label: category.label,
    items: sortMostPickedFirst(
      [...firstOccurrenceByPictureKey.entries()]
        .filter(([, occ]) => category.ids.includes(occ.stampKey))
        .map(([pictureKey, occ]) => ({
          stampKey: occ.stampKey,
          count: countByPictureKey.get(pictureKey)!,
          stampVariant: occ.stampVariant,
        }))
    ),
  })).filter((group) => group.items.length > 0);

  const keywordTimelineItems: TimelineStampItem[] = firstSeenOrder.map((pictureKey) => {
    const occ = firstOccurrenceByPictureKey.get(pictureKey)!;
    return {
      stampKind: "keyword",
      stampKey: occ.stampKey,
      stampVariant: occ.stampVariant,
      photoPath: null,
      entryDate: occ.entryDate,
      session: 0,
      createdAt: occ.createdAt,
    };
  });

  // Same-day items (e.g. a photo from the day's first sitting and a
  // keyword stamp added later that day via "이어서 쓰기") break ties by
  // `createdAt` — otherwise a stable sort would just keep photos before
  // that date's keywords regardless of which one was actually collected
  // more recently, contradicting the newest-first order every other day
  // in this list follows.
  const allStamps = [...photoStamps, ...keywordTimelineItems].sort((a, b) => {
    if (a.entryDate !== b.entryDate) return a.entryDate < b.entryDate ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return 0;
  });

  return {
    totalCount: photoStamps.length + keywordCount,
    photoCount: photoStamps.length,
    keywordCount,
    photoStamps,
    allStamps,
    keywordCategories,
  };
}
