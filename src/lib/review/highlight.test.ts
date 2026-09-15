import { describe, expect, it } from "vitest";
import { applyCorrections, buildHighlightSegments } from "@/lib/review/highlight";
import type { Suggestion } from "@/types/diary";

function suggestion(original: string, over: Partial<Suggestion> = {}): Suggestion {
  return { original, suggestion: over.suggestion ?? original, note: over.note ?? "" };
}

describe("buildHighlightSegments", () => {
  it("splits before/match/after around a single suggestion", () => {
    const segments = buildHighlightSegments("今日は会って楽しかった。", [suggestion("会って")]);
    expect(segments).toEqual([
      { text: "今日は", suggestionIndex: null },
      { text: "会って", suggestionIndex: 0 },
      { text: "楽しかった。", suggestionIndex: null },
    ]);
  });

  it("returns the whole text unhighlighted when a suggestion's original isn't found", () => {
    const content = "今日は楽しかった。";
    const segments = buildHighlightSegments(content, [suggestion("見つからない")]);
    expect(segments).toEqual([{ text: content, suggestionIndex: null }]);
  });

  it("ignores a suggestion with an empty original instead of matching everything", () => {
    const content = "今日は楽しかった。";
    const segments = buildHighlightSegments(content, [suggestion("")]);
    expect(segments).toEqual([{ text: content, suggestionIndex: null }]);
  });

  it("orders segments by position in the text, not by suggestion array order", () => {
    // "楽しかった" appears after "会って" in the string, but is listed
    // first in the suggestions array — segment order must follow the
    // text, not the array.
    const segments = buildHighlightSegments("今日は会って楽しかった。", [
      suggestion("楽しかった"),
      suggestion("会って"),
    ]);
    expect(segments.map((s) => s.suggestionIndex)).toEqual([null, 1, 0, null]);
  });

  it("skips a later suggestion that overlaps an earlier match instead of double-highlighting", () => {
    // Both "original"s share the "って" tail — once "会って" claims
    // characters 2-4, a second suggestion matching just "って" would
    // start inside that already-claimed range and must be dropped, not
    // layered on top of it.
    const segments = buildHighlightSegments("今日は会って楽しかった。", [
      suggestion("会って"),
      suggestion("って"),
    ]);
    expect(segments.filter((s) => s.suggestionIndex !== null)).toHaveLength(1);
    expect(segments.find((s) => s.suggestionIndex === 1)).toBeUndefined();
  });

  it("only highlights the first occurrence when the same phrase appears twice", () => {
    const segments = buildHighlightSegments("好きです。本当に好きです。", [suggestion("好き")]);
    const matched = segments.filter((s) => s.suggestionIndex === 0);
    expect(matched).toHaveLength(1);
    // The second "好き" (after "本当に") stays part of a plain segment.
    expect(segments.some((s) => s.suggestionIndex === null && s.text.includes("好き"))).toBe(true);
  });
});

describe("applyCorrections", () => {
  it("swaps a matched original for its suggestion", () => {
    const result = applyCorrections("駅まで走ったけど、濡れた。", [
      suggestion("走ったけど", { suggestion: "走ったのに" }),
    ]);
    expect(result).toBe("駅まで走ったのに、濡れた。");
  });

  it("applies several non-overlapping suggestions in one pass", () => {
    const result = applyCorrections("走ったけど、ずぶ濡れた。", [
      suggestion("走ったけど", { suggestion: "走ったのに" }),
      suggestion("ずぶ濡れた", { suggestion: "ずぶ濡れになった" }),
    ]);
    expect(result).toBe("走ったのに、ずぶ濡れになった。");
  });

  it("leaves the text unchanged when there are no suggestions", () => {
    expect(applyCorrections("今日は楽しかった。", [])).toBe("今日は楽しかった。");
  });

  it("leaves the text unchanged when a suggestion's original isn't found", () => {
    const content = "今日は楽しかった。";
    expect(applyCorrections(content, [suggestion("見つからない", { suggestion: "x" })])).toBe(content);
  });
});
