import { describe, expect, it } from "vitest";
import { collectStamps } from "@/lib/stamps/collectStamps";
import type { StampSourceEntry } from "@/lib/diary/client";

function entry(over: Partial<StampSourceEntry>): StampSourceEntry {
  return {
    entry_date: "2026-09-01",
    stamps: [],
    stamp_kind: "keyword",
    stamp_key: "movie",
    photo_path: null,
    ...over,
  };
}

describe("collectStamps", () => {
  it("counts a keyword stamp from the stamps array", () => {
    const { keywordCounts } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "movie", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCounts).toEqual([{ stampKey: "movie", count: 1 }]);
  });

  it("counts every session's own stamp, not just one per entry", () => {
    const { keywordCounts } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "movie", stampVariant: null, photoPath: null, createdAt: "" },
          { session: 1, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCounts).toEqual(
      expect.arrayContaining([
        { stampKey: "movie", count: 1 },
        { stampKey: "cat", count: 1 },
      ])
    );
  });

  it("sorts keyword counts most-picked-first", () => {
    const { keywordCounts } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "movie", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
      entry({
        entry_date: "2026-09-02",
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
      entry({
        entry_date: "2026-09-03",
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCounts[0]).toEqual({ stampKey: "cat", count: 2 });
    expect(keywordCounts[1]).toEqual({ stampKey: "movie", count: 1 });
  });

  it("falls back to the legacy top-level columns for an entry with no stamps array", () => {
    const { keywordCounts } = collectStamps([
      entry({ stamps: [], stamp_kind: "keyword", stamp_key: "sun" }),
    ]);
    expect(keywordCounts).toEqual([{ stampKey: "sun", count: 1 }]);
  });

  it("collects photo stamps separately, keeping entries' given order", () => {
    const { keywordCounts, photoStamps } = collectStamps([
      entry({
        entry_date: "2026-09-08",
        stamps: [
          { session: 0, stampKind: "photo", stampKey: null, stampVariant: null, photoPath: "u1/2026-09-08.jpg", createdAt: "" },
        ],
      }),
      entry({
        entry_date: "2026-09-01",
        stamps: [
          { session: 0, stampKind: "photo", stampKey: null, stampVariant: null, photoPath: "u1/2026-09-01.jpg", createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCounts).toEqual([]);
    expect(photoStamps).toEqual([
      { photoPath: "u1/2026-09-08.jpg", entryDate: "2026-09-08", session: 0, createdAt: "" },
      { photoPath: "u1/2026-09-01.jpg", entryDate: "2026-09-01", session: 0, createdAt: "" },
    ]);
  });

  it("drops a photo session with no actual photo path", () => {
    const { photoStamps } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "photo", stampKey: null, stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(photoStamps).toEqual([]);
  });

  it("counts a keyword stamp with no stampKey as the default bucket", () => {
    const { keywordCounts } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: null, stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCounts).toEqual([{ stampKey: "default", count: 1 }]);
  });

  // Almost every entry mentions eating something in passing (see
  // keywordMap.ts's own "음식" tier comment), so this ranking used to be
  // dominated by a long tail of individually small per-dish counts —
  // kept as its own list (foodStampCounts) instead, so 우표 모음 can still
  // show each dish's own stamp art in its own section (see collectStamps'
  // own comment).
  describe("food keywords", () => {
    it("keeps food keywords out of keywordCounts and puts them in foodStampCounts instead", () => {
      const { keywordCounts, foodStampCounts } = collectStamps([
        entry({
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "sushi", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
        entry({
          entry_date: "2026-09-02",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "coffee", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
        entry({
          entry_date: "2026-09-03",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "pizza", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
      ]);
      expect(keywordCounts).toEqual([]);
      expect(foodStampCounts).toEqual(
        expect.arrayContaining([
          { stampKey: "sushi", count: 1 },
          { stampKey: "coffee", count: 1 },
          { stampKey: "pizza", count: 1 },
        ])
      );
      expect(foodStampCounts).toHaveLength(3);
    });

    it("sums repeated occurrences of the same food keyword instead of merging kinds together", () => {
      const { foodStampCounts } = collectStamps([
        entry({
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "sushi", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
        entry({
          entry_date: "2026-09-02",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "sushi", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
      ]);
      expect(foodStampCounts).toEqual([{ stampKey: "sushi", count: 2 }]);
    });

    it("sorts foodStampCounts most-picked-first, independently of keywordCounts", () => {
      const { keywordCounts, foodStampCounts } = collectStamps([
        entry({
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "sushi", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
        entry({
          entry_date: "2026-09-02",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "sushi", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
        entry({
          entry_date: "2026-09-03",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "coffee", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
        entry({
          entry_date: "2026-09-04",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
      ]);
      expect(foodStampCounts).toEqual([
        { stampKey: "sushi", count: 2 },
        { stampKey: "coffee", count: 1 },
      ]);
      expect(keywordCounts).toEqual([{ stampKey: "cat", count: 1 }]);
    });
  });
});
