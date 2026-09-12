import { describe, expect, it } from "vitest";
import { stampTiltDeg } from "@/lib/stamps/stampTilt";

describe("stampTiltDeg", () => {
  it("is deterministic for the same seed", () => {
    expect(stampTiltDeg("2026-09-11")).toBe(stampTiltDeg("2026-09-11"));
  });

  it("stays within the ±5° range", () => {
    for (let d = 1; d <= 28; d++) {
      const deg = stampTiltDeg(`2026-01-${String(d).padStart(2, "0")}`);
      expect(deg).toBeGreaterThanOrEqual(-5);
      expect(deg).toBeLessThan(5);
    }
  });

  it("varies across different seeds rather than picking one fixed angle", () => {
    const degs = new Set(
      Array.from({ length: 28 }, (_, i) =>
        stampTiltDeg(`2026-01-${String(i + 1).padStart(2, "0")}`)
      )
    );
    expect(degs.size).toBeGreaterThan(1);
  });

  // Regression test for the exact bug this hash's fmix32 finalizing step
  // exists to fix: every dateKey in a month shares the same "YYYY-MM-"
  // prefix and differs only in its last two low-ASCII digits, so a plain
  // polynomial hash (no avalanche step) barely spread that difference —
  // a whole month's worth of days landed within about a degree of each
  // other instead of across the full range. "size > 1" alone (the test
  // above) can't catch that: 30 nearly-identical values still count as
  // more than one unique value.
  it("spreads a full month's days across most of the ±5° range, not a tight cluster", () => {
    const degs = Array.from({ length: 30 }, (_, i) =>
      stampTiltDeg(`2026-09-${String(i + 1).padStart(2, "0")}`)
    );
    const spread = Math.max(...degs) - Math.min(...degs);
    expect(spread).toBeGreaterThan(6);
  });
});
