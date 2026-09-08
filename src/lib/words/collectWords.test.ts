import { describe, expect, it } from "vitest";
import { collectWords } from "@/lib/words/collectWords";
import type { WordSourceEntry } from "@/lib/diary/client";

function entry(over: Partial<WordSourceEntry>): WordSourceEntry {
  return { entry_date: "2026-09-01", readings: [], ...over };
}

describe("collectWords", () => {
  it("collects a kanji reading", () => {
    const words = collectWords(
      [entry({ readings: [{ text: "会", reading: "あ", kind: "kanji" }] })],
      []
    );
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ text: "会", reading: "あ", kind: "kanji", occurrences: 1 });
  });

  it("collapses the same word across multiple entries into one item with a bumped occurrence count", () => {
    const words = collectWords(
      [
        entry({ entry_date: "2026-09-08", readings: [{ text: "会", reading: "あ", kind: "kanji" }] }),
        entry({ entry_date: "2026-09-01", readings: [{ text: "会", reading: "あ", kind: "kanji" }] }),
      ],
      []
    );
    expect(words).toHaveLength(1);
    expect(words[0].occurrences).toBe(2);
    // entries are assumed most-recent-first, so the first one seen wins.
    expect(words[0].lastSeen).toBe("2026-09-08");
  });

  it("keeps kanji and katakana readings as separate items", () => {
    const words = collectWords(
      [
        entry({
          readings: [
            { text: "会", reading: "あ", kind: "kanji" },
            { text: "コーヒー", reading: "kohi", kind: "katakana" },
          ],
        }),
      ],
      []
    );
    expect(words).toHaveLength(2);
  });

  it("carries over a stored memorized flag by (text, reading)", () => {
    const words = collectWords(
      [entry({ readings: [{ text: "会", reading: "あ", kind: "kanji" }] })],
      [{ id: "p1", user_id: "u1", text: "会", reading: "あ", kind: "kanji", memorized: true, updated_at: "" }]
    );
    expect(words[0].memorized).toBe(true);
  });

  it("skips a malformed reading missing text or reading", () => {
    const words = collectWords(
      [
        entry({
          readings: [
            { text: "", reading: "あ", kind: "kanji" },
            { text: "会", reading: "", kind: "kanji" },
          ],
        }),
      ],
      []
    );
    expect(words).toHaveLength(0);
  });
});
