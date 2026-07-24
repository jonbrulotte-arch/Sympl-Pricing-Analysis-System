import { describe, it, expect } from "vitest";
import {
  resolveDimensions,
  applyDunnage,
  calculateDimensionalWeight,
} from "@/server/services/shipping/dimension-resolver";

describe("resolveDimensions", () => {
  const productWithBoth = {
    length: 10, width: 7, height: 5, weight: 9,
    shippingLength: 11, shippingWidth: 8, shippingHeight: 6, shippingWeight: 10,
  };

  const productUpcOnly = {
    length: 10, width: 7, height: 5, weight: 9,
    shippingLength: null, shippingWidth: null, shippingHeight: null, shippingWeight: null,
  };

  const productNoDims = {
    length: null, width: null, height: null, weight: null,
    shippingLength: null, shippingWidth: null, shippingHeight: null, shippingWeight: null,
  };

  it("uses shipping dims when useShippingDimensions=true and all present", () => {
    const result = resolveDimensions(productWithBoth, true, 0);
    expect(result.source).toBe("SHIPPING");
    expect(result.dimensions).toEqual({ length: 11, width: 8, height: 6, weight: 10 });
    expect(result.dunnageApplied).toBe(false);
  });

  it("falls back to UPC dims when useShippingDimensions=false", () => {
    const result = resolveDimensions(productWithBoth, false, 0);
    expect(result.source).toBe("UPC");
    expect(result.dimensions).toEqual({ length: 10, width: 7, height: 5, weight: 9 });
  });

  it("falls back to UPC dims when shipping dims incomplete", () => {
    const partial = { ...productWithBoth, shippingWeight: null };
    const result = resolveDimensions(partial, true, 0);
    expect(result.source).toBe("UPC");
  });

  it("falls back to dunnage when no UPC or shipping dims", () => {
    const result = resolveDimensions(productNoDims, false, 10);
    expect(result.source).toBe("DUNNAGE_FALLBACK");
    expect(result.dunnageApplied).toBe(true);
    expect(result.dunnagePercent).toBe(10);
    expect(result.dimensions).not.toBeNull();
    expect(result.dimensions!.length).toBeGreaterThan(12);
  });

  it("returns NONE when no dims and dunnagePercent=0", () => {
    const result = resolveDimensions(productNoDims, false, 0);
    expect(result.source).toBe("NONE");
    expect(result.dimensions).toBeNull();
    expect(result.dunnageApplied).toBe(false);
  });

  it("prefers shipping dims over UPC when useShippingDimensions=true", () => {
    const result = resolveDimensions(productWithBoth, true, 10);
    expect(result.source).toBe("SHIPPING");
  });

  it("prefers UPC dims over dunnage fallback", () => {
    const result = resolveDimensions(productUpcOnly, false, 10);
    expect(result.source).toBe("UPC");
  });
});

describe("applyDunnage", () => {
  it("multiplies L/W/H by dunnage factor, weight unchanged", () => {
    const dims = { length: 12, width: 12, height: 12, weight: 1 };
    const result = applyDunnage(dims, 10);
    expect(result.length).toBeCloseTo(13.2);
    expect(result.width).toBeCloseTo(13.2);
    expect(result.height).toBeCloseTo(13.2);
    expect(result.weight).toBe(1);
  });

  it("0% dunnage returns identical dims", () => {
    const dims = { length: 10, width: 10, height: 10, weight: 5 };
    const result = applyDunnage(dims, 0);
    expect(result).toEqual(dims);
  });
});

describe("calculateDimensionalWeight", () => {
  const dims = { length: 20, width: 15, height: 10, weight: 5 };
  // Volume = 3000 cu in

  it("uses UPS divisor 139", () => {
    const result = calculateDimensionalWeight(dims, "UPS");
    expect(result.divisorUsed).toBe(139);
    expect(result.dimensionalWeight).toBeCloseTo(3000 / 139);
    expect(result.billedWeight).toBeCloseTo(3000 / 139); // 21.58 > 5
  });

  it("uses USPS divisor 166", () => {
    const result = calculateDimensionalWeight(dims, "USPS");
    expect(result.divisorUsed).toBe(166);
    expect(result.dimensionalWeight).toBeCloseTo(3000 / 166);
    expect(result.billedWeight).toBeCloseTo(3000 / 166); // 18.07 > 5
  });

  it("billedWeight is max of dim and actual", () => {
    const heavy = { length: 10, width: 10, height: 10, weight: 50 };
    // Volume = 1000, dim weight = 1000/166 = 6.02
    const result = calculateDimensionalWeight(heavy, "USPS");
    expect(result.billedWeight).toBe(50);
  });

  it("UPS 1-cubic-foot exception uses actual weight when volume <= 1728", () => {
    const small = { length: 12, width: 12, height: 12, weight: 3 };
    // Volume = 1728, dim weight = 1728/139 = 12.43
    const result = calculateDimensionalWeight(small, "UPS");
    expect(result.billedWeight).toBe(3); // exception: use actual weight
  });

  it("UPS applies dim weight when volume > 1728", () => {
    const big = { length: 13, width: 12, height: 12, weight: 3 };
    // Volume = 1872, dim weight = 1872/139 = 13.47
    const result = calculateDimensionalWeight(big, "UPS");
    expect(result.billedWeight).toBeCloseTo(1872 / 139);
  });

  it("accepts divisor override", () => {
    const result = calculateDimensionalWeight(dims, "UPS", 200);
    expect(result.divisorUsed).toBe(200);
    expect(result.dimensionalWeight).toBeCloseTo(3000 / 200);
  });
});
