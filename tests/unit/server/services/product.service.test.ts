import { describe, it, expect, vi, beforeEach } from "vitest";
import { Permission } from "@/server/authorization/permissions";

// Mock db and audit log before importing the service
vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    productCostHistory: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/audit-log.service", () => ({
  logAction: vi.fn(),
  AuditAction: {
    COST_CHANGED: "COST_CHANGED",
    CUSTOMER_CREATED: "CUSTOMER_CREATED",
    CUSTOMER_UPDATED: "CUSTOMER_UPDATED",
    CUSTOMER_DELETED: "CUSTOMER_DELETED",
  },
}));

import { db } from "@/lib/db";
import { listProducts, getProductCostHistory, updateProductCost } from "@/server/services/product.service";
import { ForbiddenError } from "@/lib/errors";

const mockDb = db as unknown as {
  product: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  productCostHistory: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const fakeProduct = {
  id: "prod-1",
  sku: "SKU-001",
  name: "Widget A",
  brand: "BrandX",
  isActive: true,
  currentCost: "4.2000",
  futureCost: null,
  costEffectiveDate: null,
  futureCostEffectiveDate: null,
  costSource: null,
  deletedAt: null,
  category: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listProducts", () => {
  it("includes cost fields for users with view_product_cost", async () => {
    mockDb.product.findMany.mockResolvedValue([fakeProduct]);
    const results = await listProducts([Permission.VIEW_PRODUCT_COST]);
    expect(results[0]).toHaveProperty("currentCost");
  });

  it("strips cost fields for users without view_product_cost", async () => {
    mockDb.product.findMany.mockResolvedValue([fakeProduct]);
    const results = await listProducts([Permission.VIEW_PRODUCTS]);
    expect(results[0]).not.toHaveProperty("currentCost");
    expect(results[0]).not.toHaveProperty("futureCost");
    expect(results[0]).not.toHaveProperty("costSource");
  });

  it("preserves non-cost fields for all users", async () => {
    mockDb.product.findMany.mockResolvedValue([fakeProduct]);
    const results = await listProducts([]);
    expect(results[0]).toHaveProperty("id", "prod-1");
    expect(results[0]).toHaveProperty("name", "Widget A");
    expect(results[0]).toHaveProperty("sku", "SKU-001");
  });
});

describe("getProductCostHistory", () => {
  it("throws ForbiddenError when user lacks view_product_cost", async () => {
    await expect(
      getProductCostHistory("prod-1", [Permission.VIEW_PRODUCTS])
    ).rejects.toThrow(ForbiddenError);
  });

  it("returns history for authorized users", async () => {
    mockDb.product.findFirst.mockResolvedValue(fakeProduct);
    const fakeHistory = [{ id: "h1", cost: "4.2000", effectiveDate: new Date(), createdAt: new Date() }];
    mockDb.productCostHistory.findMany.mockResolvedValue(fakeHistory);

    const result = await getProductCostHistory("prod-1", [Permission.VIEW_PRODUCT_COST]);
    expect(result).toEqual(fakeHistory);
  });
});

describe("updateProductCost", () => {
  it("throws ForbiddenError when user lacks edit_product_cost", async () => {
    await expect(
      updateProductCost(
        "prod-1",
        { currentCost: 5.0, costEffectiveDate: "2026-01-01" },
        [Permission.VIEW_PRODUCT_COST],
        "user-1"
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("creates a cost history row when updating cost", async () => {
    mockDb.product.findFirst.mockResolvedValue(fakeProduct);
    mockDb.product.update.mockResolvedValue({ ...fakeProduct, currentCost: "5.0000" });
    mockDb.productCostHistory.create.mockResolvedValue({ id: "h1" });

    await updateProductCost(
      "prod-1",
      { currentCost: 5.0, costEffectiveDate: "2026-01-01" },
      [Permission.EDIT_PRODUCT_COST],
      "user-1"
    );

    expect(mockDb.productCostHistory.create).toHaveBeenCalledOnce();
    expect(mockDb.productCostHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cost: 5.0, productId: "prod-1" }),
      })
    );
  });
});
