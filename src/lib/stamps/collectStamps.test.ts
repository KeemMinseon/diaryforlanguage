import { describe, expect, it } from "vitest";
import { collectStamps } from "@/lib/stamps/collectStamps";
import type { StampSourceEntry } from "@/lib/diary/client";

function entry(over: Partial<StampSourceEntry>): StampSourceEntry {
  return {
    entry_date: "2026-09-01",
    stamps: [],
    stamp_kind: "keyword",
    stamp_key: "coffee",
    photo_path: null,
    ...over,
  };
}

describe("collectStamps", () => {
  it("counts a keyword stamp from the stamps array", () => {
    const { keywordCounts } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "coffee", photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCounts).toEqual([{ stampKey: "coffee", count: 1 }]);
  });

  it("counts every session's own stamp, not just one per entry", () => {
    const { keywordCounts } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "coffee", photoPath: null, createdAt: "" },
          { session: 1, stampKind: "keyword", stampKey: "movie", photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCounts).toEqual(
      expect.arrayContaining([
        { stampKey: "coffee", count: 1 },
        { stampKey: "movie", count: 1 },
      ])
    );
  });

  it("sorts keyword counts most-picked-first", () => {
    const { keywordCounts } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "coffee", photoPath: null, createdAt: "" },
        ],
      }),
      entry({
        entry_date: "2026-09-02",
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "movie", photoPath: null, createdAt: "" },
        ],
      }),
      entry({
        entry_date: "2026-09-03",
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: "movie", photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCounts[0]).toEqual({ stampKey: "movie", count: 2 });
    expect(keywordCounts[1]).toEqual({ stampKey: "coffee", count: 1 });
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
          { session: 0, stampKind: "photo", stampKey: null, photoPath: "u1/2026-09-08.jpg", createdAt: "" },
        ],
      }),
      entry({
        entry_date: "2026-09-01",
        stamps: [
          { session: 0, stampKind: "photo", stampKey: null, photoPath: "u1/2026-09-01.jpg", createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCounts).toEqual([]);
    expect(photoStamps).toEqual([
      { photoPath: "u1/2026-09-08.jpg", entryDate: "2026-09-08", session: 0 },
      { photoPath: "u1/2026-09-01.jpg", entryDate: "2026-09-01", session: 0 },
    ]);
  });

  it("drops a photo session with no actual photo path", () => {
    const { photoStamps } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "photo", stampKey: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(photoStamps).toEqual([]);
  });

  it("counts a keyword stamp with no stampKey as the default bucket", () => {
    const { keywordCounts } = collectStamps([
      entry({
        stamps: [
          { session: 0, stampKind: "keyword", stampKey: null, photoPath: null, createdAt: "" },
        ],
      }),
    ]);
    expect(keywordCounts).toEqual([{ stampKey: "default", count: 1 }]);
  });
});
