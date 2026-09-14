import { describe, expect, it } from "vitest";
import { daysInMonth, formatSavedAt, toDateKey } from "@/lib/utils/date";

describe("daysInMonth", () => {
  it("returns every day of a 30-day month, in order, with no padding", () => {
    const days = daysInMonth(2026, 8); // September (0-indexed)
    expect(days).toHaveLength(30);
    expect(toDateKey(days[0])).toBe("2026-09-01");
    expect(toDateKey(days[29])).toBe("2026-09-30");
  });

  it("handles a 31-day month and February correctly", () => {
    expect(daysInMonth(2026, 0)).toHaveLength(31); // January
    expect(daysInMonth(2026, 1)).toHaveLength(28); // February, non-leap
    expect(daysInMonth(2024, 1)).toHaveLength(29); // February, leap year
  });
});

describe("formatSavedAt", () => {
  it("shows just the time when saved the same local day", () => {
    expect(formatSavedAt("2026-09-08T00:30:00", "2026-09-08")).toBe("오전 12:30");
  });

  it("shows the full month/day + time when saved on a different day", () => {
    expect(formatSavedAt("2026-09-09T09:05:00", "2026-09-08")).toBe("9월 9일 오전 9:05");
  });

  it("uses 오전/오후 by hand rather than Intl — never depends on the runtime's ICU data", () => {
    // Midnight and noon are the classic 12-hour-clock edge cases: hour 0
    // and hour 12 both need to print as "12", not "0".
    expect(formatSavedAt("2026-09-08T00:00:00", "2026-09-08")).toBe("오전 12:00");
    expect(formatSavedAt("2026-09-08T12:00:00", "2026-09-08")).toBe("오후 12:00");
    expect(formatSavedAt("2026-09-08T11:59:00", "2026-09-08")).toBe("오전 11:59");
    expect(formatSavedAt("2026-09-08T13:05:00", "2026-09-08")).toBe("오후 1:05");
    expect(formatSavedAt("2026-09-08T23:59:00", "2026-09-08")).toBe("오후 11:59");
  });

  it("zero-pads the minute but not the hour", () => {
    expect(formatSavedAt("2026-09-08T09:05:00", "2026-09-08")).toBe("오전 9:05");
  });
});
