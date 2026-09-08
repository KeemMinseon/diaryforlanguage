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

  // The friend -> calendar/chat split: an actual get-together reads as
  // "calendar", a bare mention of a friend in passing reads as "chat".
  it("splits friend mentions by whether it's an actual plan", () => {
    expect(pickStamp("友達と会った。")).toBe("calendar");
    expect(pickStamp("友達に相談した。")).toBe("chat");
  });

  // The heart/joy re-split: romantic love only, general happiness stays
  // under joy.
  it("splits romantic love from general happiness", () => {
    expect(pickStamp("彼に恋をしている。")).toBe("heart");
    expect(pickStamp("今日はとても嬉しい一日でした。")).toBe("joy");
  });

  it("returns the first matching rule in priority order regardless of word position", () => {
    // "ご飯" appears before "雨" in the text, but rain still wins — order
    // is about rule priority, not which word shows up first in the string.
    expect(pickStamp("ご飯を食べてから、雨の中を歩いた。")).toBe("rain");
  });
});
