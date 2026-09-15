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

  describe("distinctKeywordStamps", () => {
    it("lists each distinct keyword once, most-recently-collected-first", () => {
      const { distinctKeywordStamps } = collectStamps([
        entry({
          entry_date: "2026-09-03",
          stamps: [
            { session: 0, stampKind: "keyword", stampKey: "dog", stampVariant: null, photoPath: null, createdAt: "" },
          ],
        }),
        entry({
          entry_date: "2026-09-02",
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
      // "cat" repeats but only shows up once — and at the position of its
      // first (most recent, since entries are given most-recent-first)
      // occurrence, not its last.
      expect(distinctKeywordStamps).toEqual(["dog", "cat"]);
    });

    it("doesn't include photo stamps", () => {
      const { distinctKeywordStamps } = collectStamps([
        entry({
          stamps: [
            { session: 0, stampKind: "photo", stampKey: null, stampVariant: null, photoPath: "u1/p.jpg", createdAt: "" },
          ],
        }),
      ]);
      expect(distinctKeywordStamps).toEqual([]);
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
