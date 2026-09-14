import { afterEach, describe, expect, it, vi } from "vitest";
import { STAMP_VARIANT_COUNT, pickStampVariant, stampVariantCount } from "@/lib/stamps/stampVariants";

describe("stampVariantCount", () => {
  it("is 1 for a keyword with no entry in STAMP_VARIANT_COUNT (e.g. the fallback id)", () => {
    expect(stampVariantCount("default")).toBe(1);
  });

  it("reflects the configured count for a keyword with several prepared variants", () => {
    expect(stampVariantCount("cat")).toBe(5);
  });

  it("reflects the configured count for a keyword with just one prepared variant", () => {
    expect(stampVariantCount("food")).toBe(1);
  });
});

describe("pickStampVariant", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("always returns 0 for a keyword with only one variant", () => {
    for (let i = 0; i < 10; i++) {
      expect(pickStampVariant("food")).toBe(0);
    }
  });

  it("stays within 0..count-1 for a keyword with several variants", () => {
    const count = STAMP_VARIANT_COUNT.cat!;
    for (let i = 0; i < 50; i++) {
      const picked = pickStampVariant("cat");
      expect(picked).toBeGreaterThanOrEqual(0);
      expect(picked).toBeLessThan(count);
      expect(Number.isInteger(picked)).toBe(true);
    }
  });

  it("can land on either boundary variant", () => {
    const count = STAMP_VARIANT_COUNT.cat!;
    const randomSpy = vi.spyOn(Math, "random");

    randomSpy.mockReturnValue(0);
    expect(pickStampVariant("cat")).toBe(0);

    randomSpy.mockReturnValue(0.999);
    expect(pickStampVariant("cat")).toBe(count - 1);
  });
});
