import { describe, expect, it } from "vitest";
import { stampTiltDeg } from "@/lib/stamps/stampTilt";

describe("stampTiltDeg", () => {
  it("is deterministic for the same seed", () => {
    expect(stampTiltDeg("2026-09-11")).toBe(stampTiltDeg("2026-09-11"));
  });

  it("stays within the ±2° range", () => {
    for (let d = 1; d <= 28; d++) {
      const deg = stampTiltDeg(`2026-01-${String(d).padStart(2, "0")}`);
      expect(deg).toBeGreaterThanOrEqual(-2);
      expect(deg).toBeLessThan(2);
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
});
