import { describe, expect, it } from "vitest";
import { pickStamp } from "@/lib/stamps/keywordMap";

describe("pickStamp", () => {
  it("falls back to default when nothing matches", () => {
    expect(pickStamp("特に何もなかった一日でした。")).toBe("default");
  });

  it("picks weather even when a meal is also mentioned", () => {
    expect(pickStamp("雨が降っていたので、家でご飯を食べた。")).toBe("rain");
  });

  // The bug this whole ordering exists to prevent: an entry that's really
  // about a trip (or any other specific, eventful category) shouldn't get
  // overridden by an incidental "먹었다"/"ご飯" mention along the way —
  // that's what regressed into every entry looking like a "food" stamp
  // before the categories were reordered.
  it("prefers a specific category over an incidental meal mention", () => {
    expect(pickStamp("旅行に行って、美味しいご飯も食べた。")).toBe("travel");
  });

  it("only picks food/coffee when nothing more specific matched", () => {
    expect(pickStamp("今日は牛丼を食べた。")).toBe("food");
    expect(pickStamp("カフェでコーヒーを飲んだ。")).toBe("coffee");
  });

  it("weather still wins over coffee/food when both appear", () => {
    expect(pickStamp("雪の日にカフェでコーヒーを飲んだ。")).toBe("snow");
  });

  it("returns the first matching rule in priority order regardless of word position", () => {
    // "ご飯" appears before "雨" in the text, but rain still wins — order
    // is about rule priority, not which word shows up first in the string.
    expect(pickStamp("ご飯を食べてから、雨の中を歩いた。")).toBe("rain");
  });

  it("picks joy for general happiness", () => {
    expect(pickStamp("今日はとても嬉しい一日でした。")).toBe("joy");
  });

  // "lover" (relationships tier) sits ahead of "date" (activities tier) in
  // KEYWORD_RULES, so a sentence naming both a partner and a date still
  // resolves to the relationship, not the activity.
  it("prefers a relationship category over an activity mentioned alongside it", () => {
    expect(pickStamp("彼女とデートした。")).toBe("lover");
  });

  // The 152-keyword set (replacing the old 38) merged the old fine-grained
  // "friend get-together" (calendar) vs. "friend mentioned in passing"
  // (chat) split into one broader "friendship" category — both read as
  // friendship now, which is a real, deliberate simplification from the
  // old rules, not a bug.
  it("reads any friend mention as friendship in the new keyword set", () => {
    expect(pickStamp("友達と会った。")).toBe("friendship");
    expect(pickStamp("友達に相談した。")).toBe("friendship");
  });
});
