import { describe, it, expect } from "vitest";
import { stripCostFields, canViewProductCost } from "@/server/authorization/check-cost-visibility";
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
