import { describe, it, expect } from "vitest";
import {
  stripCostFields,
  canViewProductCost,
  stripShippingCostFields,
  canViewShippingCost,
} from "@/server/authorization/check-cost-visibility";
import { Permission } from "@/server/authorization/permissions";

const fullProduct = {
  id: "p1",
  name: "Widget A",
  sku: "SKU-001",
  currentCost: 10.5,
  futureCost: 11.0,
  costEffectiveDate: new Date(),
  futureCostEffectiveDate: new Date(),
  costSource: "VENDOR",
};

describe("stripCostFields", () => {
  it("returns full data when user has view_product_cost", () => {
    const result = stripCostFields(fullProduct, [Permission.VIEW_PRODUCT_COST]);
    expect(result).toHaveProperty("currentCost");
    expect(result).toHaveProperty("futureCost");
    expect(result).toHaveProperty("costSource");
  });

  it("strips cost fields when user lacks view_product_cost", () => {
    const result = stripCostFields(fullProduct, [Permission.VIEW_CUSTOMERS]);
    expect(result).not.toHaveProperty("currentCost");
    expect(result).not.toHaveProperty("futureCost");
    expect(result).not.toHaveProperty("costEffectiveDate");
    expect(result).not.toHaveProperty("futureCostEffectiveDate");
    expect(result).not.toHaveProperty("costSource");
  });

  it("preserves non-cost fields when stripping", () => {
    const result = stripCostFields(fullProduct, []);
    expect(result).toHaveProperty("id", "p1");
    expect(result).toHaveProperty("name", "Widget A");
    expect(result).toHaveProperty("sku", "SKU-001");
  });

  it("strips cost fields for empty permissions list", () => {
    const result = stripCostFields(fullProduct, []);
    expect(result).not.toHaveProperty("currentCost");
  });
});

describe("canViewProductCost", () => {
  it("returns true when view_product_cost is present", () => {
    expect(canViewProductCost([Permission.VIEW_PRODUCT_COST])).toBe(true);
  });

  it("returns false when view_product_cost is absent", () => {
    expect(canViewProductCost([Permission.VIEW_CUSTOMERS])).toBe(false);
    expect(canViewProductCost([])).toBe(false);
  });
});

const fullShippingData = {
  id: "q1",
  carrier: "UPS",
  serviceCode: "GROUND",
  shippingCost: 5.25,
  shippingQuotes: [{ id: "q1" }],
  rateAmount: 5.25,
  billedWeight: 10.0,
  dimensionalWeight: 8.5,
  rawResponse: { data: "test" },
  quoteExpiresAt: new Date(),
};

describe("stripShippingCostFields", () => {
  it("returns full data when user has view_shipping_cost", () => {
    const result = stripShippingCostFields(fullShippingData, [Permission.VIEW_SHIPPING_COST]);
    expect(result).toHaveProperty("shippingCost");
    expect(result).toHaveProperty("rateAmount");
    expect(result).toHaveProperty("billedWeight");
    expect(result).toHaveProperty("rawResponse");
  });

  it("strips shipping cost fields when user lacks view_shipping_cost", () => {
    const result = stripShippingCostFields(fullShippingData, [Permission.VIEW_CUSTOMERS]);
    expect(result).not.toHaveProperty("shippingCost");
    expect(result).not.toHaveProperty("shippingQuotes");
    expect(result).not.toHaveProperty("rateAmount");
    expect(result).not.toHaveProperty("billedWeight");
    expect(result).not.toHaveProperty("dimensionalWeight");
    expect(result).not.toHaveProperty("rawResponse");
  });

  it("preserves non-shipping fields when stripping", () => {
    const result = stripShippingCostFields(fullShippingData, []);
    expect(result).toHaveProperty("id", "q1");
    expect(result).toHaveProperty("carrier", "UPS");
    expect(result).toHaveProperty("quoteExpiresAt");
  });
});

describe("canViewShippingCost", () => {
  it("returns true when view_shipping_cost is present", () => {
    expect(canViewShippingCost([Permission.VIEW_SHIPPING_COST])).toBe(true);
  });

  it("returns false when view_shipping_cost is absent", () => {
    expect(canViewShippingCost([Permission.VIEW_CUSTOMERS])).toBe(false);
    expect(canViewShippingCost([])).toBe(false);
  });
});
