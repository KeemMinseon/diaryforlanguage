import type { StampSourceEntry } from "@/lib/diary/client";
import { FOOD_STAMP_IDS, type StampId } from "@/lib/stamps/keywordMap";
import type { SessionStamp } from "@/types/diary";

const FOOD_STAMP_ID_SET = new Set<string>(FOOD_STAMP_IDS);

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
  /** Passed straight through to photoPublicUrl's cache-buster — every
   * day's photo is uploaded to the same fixed storage path (see
   * uploadStampPhoto), so without this a re-crop can keep showing the
   * old cached image at that same URL forever. */
  createdAt: string;
}

export interface StampCollection {
  /** Every non-food keyword, sorted most-picked-first. */
  keywordCounts: KeywordStampCount[];
  /** Every food-category keyword (see FOOD_STAMP_IDS) that's shown up at
   * least once, sorted most-picked-first — kept as its own list rather
   * than folded into `keywordCounts` so 우표 모음 can still show each
   * dish's own stamp art in its own section (a single merged "먹었어요
   * N번" row was tried first, but that hid the actual stamps — the whole
   * point of a *collection* screen is seeing what you've collected).
   * `keywordCounts.length` is exactly "몇 종류의 음식 우표를 모았는지"
   * for that section's own header. */
  foodStampCounts: KeywordStampCount[];
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
      // Not fetched by fetchAllEntriesForStamps (this collection view only
      // ever shows one representative image per keyword, never a specific
      // day's actual variant) — see StampSourceEntry.
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
 * order without a separate sort here. */
export function collectStamps(entries: StampSourceEntry[]): StampCollection {
  const countByKey = new Map<string, number>();
  const photoStamps: PhotoStampItem[] = [];

  for (const entry of entries) {
    for (const s of resolveStamps(entry)) {
      if (s.stampKind === "photo") {
        if (s.photoPath) {
          photoStamps.push({
            photoPath: s.photoPath,
            entryDate: entry.entry_date,
            session: s.session,
            createdAt: s.createdAt,
          });
        }
        continue;
      }
      const key = s.stampKey ?? "default";
      countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
    }
  }

  const keywordCounts: KeywordStampCount[] = [];
  const foodStampCounts: KeywordStampCount[] = [];
  for (const [key, count] of countByKey) {
    const item = { stampKey: key as StampId, count };
    (FOOD_STAMP_ID_SET.has(key) ? foodStampCounts : keywordCounts).push(item);
  }

  return {
    keywordCounts: sortMostPickedFirst(keywordCounts),
    foodStampCounts: sortMostPickedFirst(foodStampCounts),
    photoStamps,
  };
}
