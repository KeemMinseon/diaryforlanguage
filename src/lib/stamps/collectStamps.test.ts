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
  it("puts a keyword stamp from the stamps array into its own category", () => {
    const { keywordCategories } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "movie", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    // "movie" is in the "일상" tier — see KEYWORD_CATEGORIES.
    expect(keywordCategories).toEqual([{ label: "일상", items: [{ stampKey: "movie", count: 1 }] }]);
  });

  it("counts every session's own stamp, not just one per entry", () => {
    const { keywordCategories } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "movie", stampVariant: null, photoPath: null, createdAt: "" },
          { session: 1, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    const allItems = keywordCategories.flatMap((g) => g.items);
    expect(allItems).toEqual(
      expect.arrayContaining([
        { stampKey: "movie", count: 1 },
        { stampKey: "cat", count: 1 },
      ])
    );
  });

  it("sorts a category's own items most-picked-first", () => {
    const { keywordCategories } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
      entry({
        entry_date: "2026-09-02",
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "dog", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
      entry({
        entry_date: "2026-09-03",
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "dog", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    const animals = keywordCategories.find((g) => g.label === "동물")!;
    expect(animals.items[0]).toEqual({ stampKey: "dog", count: 2 });
    expect(animals.items[1]).toEqual({ stampKey: "cat", count: 1 });
  });

  it("falls back to the legacy top-level columns for an entry with no stamps array", () => {
    const { keywordCategories } = collectStamps([
      entry({ stamps: [], stamp_kind: "keyword", stamp_key: "sun" }),
    ]);
    expect(keywordCategories).toEqual([{ label: "날씨", items: [{ stampKey: "sun", count: 1 }] }]);
  });

  it("leaves out a category with nothing collected in it, rather than showing it empty", () => {
    const { keywordCategories } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCategories.map((g) => g.label)).toEqual(["동물"]);
  });

  it("groups keywords from different tiers into their own separate categories", () => {
    const { keywordCategories } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "sushi", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
      entry({
        entry_date: "2026-09-02",
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "rain", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
      entry({
        entry_date: "2026-09-03",
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCategories.map((g) => g.label)).toEqual(["날씨", "음식", "동물"]);
  });

  it("collects a photo stamp into photoStamps, keeping entries' given order", () => {
    const { photoStamps } = collectStamps([
      entry({
        entry_date: "2026-09-08",
        stamps: [
          { session: 0, stampKind: "photo", stampKey: null, stampVariant: null, photoPath: "u1/2026-09-08.jpg", createdAt: "t1" },
        ],
      }),
      entry({
        entry_date: "2026-09-01",
        stamps: [
          { session: 0, stampKind: "photo", stampKey: null, stampVariant: null, photoPath: "u1/2026-09-01.jpg", createdAt: "t2" },
        ],
      }),
    ]);
    expect(photoStamps).toEqual([
      { stampKind: "photo", stampKey: null, stampVariant: null, photoPath: "u1/2026-09-08.jpg", entryDate: "2026-09-08", session: 0, createdAt: "t1" },
      { stampKind: "photo", stampKey: null, stampVariant: null, photoPath: "u1/2026-09-01.jpg", entryDate: "2026-09-01", session: 0, createdAt: "t2" },
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

  describe("allStamps", () => {
    it("lists each distinct keyword once, anchored to its first (oldest) occurrence date", () => {
      const { allStamps } = collectStamps([
        // Given most-recent-first, as fetchAllEntriesForStamps provides.
        entry({
          entry_date: "2026-09-03",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
        entry({
          entry_date: "2026-09-01",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
      ]);
      // "cat" repeats on both days but only shows up once — dated to
      // 09-01 (its first-ever occurrence), not 09-03 (its most recent).
      expect(allStamps).toEqual([
        { stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, entryDate: "2026-09-01", session: 0, createdAt: "2026-09-01" },
      ]);
    });

    it("carries the first-ever occurrence's own stampVariant, not variant 0", () => {
      // pickStampVariant is random per-sitting, not fixed per keyword — a
      // later occurrence can pick a different variant than the first one.
      // The tile shown here has to match what that first day's own entry
      // detail actually shows, or the same stamp reads as two different
      // pictures depending on which screen you look at it from.
      const { allStamps } = collectStamps([
        entry({
          entry_date: "2026-09-03",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: 3, photoPath: null, createdAt: "" },
          ],
        }),
        entry({
          entry_date: "2026-09-01",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: 1, photoPath: null, createdAt: "" },
          ],
        }),
      ]);
      expect(allStamps).toEqual([
        { stampKind: "keyword", stampKey: "cat", stampVariant: 1, photoPath: null, entryDate: "2026-09-01", session: 0, createdAt: "2026-09-01" },
      ]);
    });

    it("merges photo and keyword entries, sorted most-recent-first", () => {
      const { allStamps } = collectStamps([
        entry({
          entry_date: "2026-09-01",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
        entry({
          entry_date: "2026-09-05",
          stamps: [
            { session: 0, stampKind: "photo", stampKey: null, stampVariant: null, photoPath: "u1/p.jpg", createdAt: "t1" },
          ],
        }),
      ]);
      expect(allStamps.map((s) => s.entryDate)).toEqual(["2026-09-05", "2026-09-01"]);
      expect(allStamps.map((s) => s.stampKind)).toEqual(["photo", "keyword"]);
    });

    it("doesn't repeat a photo — every occurrence is its own entry", () => {
      const { allStamps } = collectStamps([
        entry({
          entry_date: "2026-09-01",
          stamps: [
            { session: 0, stampKind: "photo", stampKey: null, stampVariant: null, photoPath: "u1/a.jpg", createdAt: "" },
            { session: 1, stampKind: "photo", stampKey: null, stampVariant: null, photoPath: "u1/b.jpg", createdAt: "" },
          ],
        }),
      ]);
      expect(allStamps).toHaveLength(2);
    });
  });

  it("counts a keyword stamp with no stampKey as the default bucket, under 기타", () => {
    const { keywordCategories } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: null, stampVariant: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCategories).toEqual([{ label: "기타", items: [{ stampKey: "default", count: 1 }] }]);
  });

  it("reports totalCount/photoCount/keywordCount across both kinds", () => {
    const collection = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "cat", stampVariant: null, photoPath: null, createdAt: "" },
          { session: 1, stampKind: "photo", stampKey: null, stampVariant: null, photoPath: "u1/p.jpg", createdAt: "" },
        ],
      }),
    ]);
    expect(collection.totalCount).toBe(2);
    expect(collection.photoCount).toBe(1);
    expect(collection.keywordCount).toBe(1);
  });

});
