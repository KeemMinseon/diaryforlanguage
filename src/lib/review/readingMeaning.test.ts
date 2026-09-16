import { describe, expect, it } from "vitest";
import { isUncertainMeaning } from "@/lib/review/readingMeaning";

describe("isUncertainMeaning", () => {
  it("flags a meaning hedging that the text was probably a typo", () => {
    expect(isUncertainMeaning("종관 제한(오타로 추정)")).toBe(true);
  });

  it("flags a meaning marked as misuse of a made-up, not-in-any-dictionary term", () => {
    expect(isUncertainMeaning("종관 제한(오용)")).toBe(true);
  });

  it("flags other common uncertainty phrasing", () => {
    expect(isUncertainMeaning("확실하지 않음")).toBe(true);
    expect(isUncertainMeaning("불확실한 표현")).toBe(true);
    expect(isUncertainMeaning("뜻을 알 수 없음")).toBe(true);
  });

  it("does not flag a plain dictionary-style gloss", () => {
    expect(isUncertainMeaning("일/직장")).toBe(false);
    expect(isUncertainMeaning("만나다")).toBe(false);
    expect(isUncertainMeaning("모임")).toBe(false);
  });

  it("does not flag an empty meaning", () => {
    expect(isUncertainMeaning("")).toBe(false);
  });
});
