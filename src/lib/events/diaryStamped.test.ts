import { beforeAll, describe, expect, it, vi } from "vitest";
import { notifyDiaryStamped, onDiaryStamped } from "@/lib/events/diaryStamped";

// No jsdom in this project (see vitest.config.ts) — this module only
// ever needs `window` as a plain event target, which Node's own built-in
// EventTarget provides without pulling in a full DOM environment just
// for one test file.
beforeAll(() => {
  vi.stubGlobal("window", new EventTarget());
});

describe("diaryStamped events", () => {
  it("delivers the date key to a subscribed handler", () => {
    const handler = vi.fn();
    const unsubscribe = onDiaryStamped(handler);
    notifyDiaryStamped("2026-09-09");
    expect(handler).toHaveBeenCalledWith("2026-09-09");
    unsubscribe();
  });

  it("stops delivering once unsubscribed", () => {
    const handler = vi.fn();
    const unsubscribe = onDiaryStamped(handler);
    unsubscribe();
    notifyDiaryStamped("2026-09-09");
    expect(handler).not.toHaveBeenCalled();
  });

  it("doesn't deliver to a handler subscribed on a different call", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const unsubA = onDiaryStamped(handlerA);
    const unsubB = onDiaryStamped(handlerB);
    notifyDiaryStamped("2026-01-01");
    expect(handlerA).toHaveBeenCalledWith("2026-01-01");
    expect(handlerB).toHaveBeenCalledWith("2026-01-01");
    unsubA();
    unsubB();
  });
});
