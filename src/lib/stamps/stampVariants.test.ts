import { afterEach, describe, expect, it, vi } from "vitest";
import { STAMP_VARIANT_COUNT, pickStampVariant, stampVariantCount } from "@/lib/stamps/stampVariants";

describe("stampVariantCount", () => {
  it("is 1 for a keyword with no entry in STAMP_VARIANT_COUNT", () => {
    expect(stampVariantCount("rain")).toBe(1);
  });

  it("reflects a configured count", () => {
    STAMP_VARIANT_COUNT.cat = 5;
    expect(stampVariantCount("cat")).toBe(5);
    delete STAMP_VARIANT_COUNT.cat;
  });
});

describe("pickStampVariant", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete STAMP_VARIANT_COUNT.cat;
  });

  it("always returns 1 for a keyword with only one variant", () => {
    for (let i = 0; i < 10; i++) {
      expect(pickStampVariant("rain")).toBe(1);
    }
  });

  it("stays within 1..count for a keyword with several variants", () => {
    STAMP_VARIANT_COUNT.cat = 5;
    for (let i = 0; i < 50; i++) {
      const picked = pickStampVariant("cat");
      expect(picked).toBeGreaterThanOrEqual(1);
      expect(picked).toBeLessThanOrEqual(5);
      expect(Number.isInteger(picked)).toBe(true);
    }
  });

  it("can land on either boundary variant", () => {
    STAMP_VARIANT_COUNT.cat = 5;
    const randomSpy = vi.spyOn(Math, "random");

    randomSpy.mockReturnValue(0);
    expect(pickStampVariant("cat")).toBe(1);

    randomSpy.mockReturnValue(0.999);
    expect(pickStampVariant("cat")).toBe(5);
  });
});
