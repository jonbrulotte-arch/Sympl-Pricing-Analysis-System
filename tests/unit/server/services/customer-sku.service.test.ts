import { describe, it, expect, vi, beforeEach } from "vitest";
import { Permission } from "@/server/authorization/permissions";

vi.mock("@/lib/db", () => ({
  db: {
    customerSku: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customerPriceHistory: {
      create: vi.fn(),
    },
    customerAssignment: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/audit-log.service", () => ({
  logAction: vi.fn(),
  AuditAction: {
    PRICE_CHANGED: "PRICE_CHANGED",
    SKU_OVERRIDE_CHANGED: "SKU_OVERRIDE_CHANGED",
  },
}));

import { db } from "@/lib/db";
import { listCustomerSkus, createCustomerSku } from "@/server/services/customer-sku.service";
import { ForbiddenError } from "@/lib/errors";

const mockDb = db as unknown as {
  customerSku: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  customerPriceHistory: {
    create: ReturnType<typeof vi.fn>;
  };
  customerAssignment: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const CUSTOMER_ID = "customer-1";
const USER_ID = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listCustomerSkus", () => {
  it("throws ForbiddenError when user is not assigned and lacks global access", async () => {
    // No global_customer_access, so assignment lookup happens
    mockDb.customerAssignment.findUnique.mockResolvedValue(null);

    await expect(
      listCustomerSkus(CUSTOMER_ID, USER_ID, [Permission.VIEW_CUSTOMERS])
    ).rejects.toThrow(ForbiddenError);
  });

  it("returns skus for users with global_customer_access", async () => {
    const fakeSkus = [
      {
        id: "sku-1",
        customerId: CUSTOMER_ID,
        product: { id: "p1", sku: "SKU-001", name: "Widget", currentCost: "4.2", deletedAt: null },
        priceHistory: [],
        sellingPrice: "10.00",
        packageQuantity: 1,
        alertStatus: "OK",
        reviewStatus: "PENDING",
      },
    ];
    mockDb.customerSku.findMany.mockResolvedValue(fakeSkus);

    const results = await listCustomerSkus(CUSTOMER_ID, USER_ID, [
      Permission.GLOBAL_CUSTOMER_ACCESS,
      Permission.VIEW_CUSTOMERS,
    ]);
    expect(results).toHaveLength(1);
  });

  it("strips cost fields from nested product for users without view_product_cost", async () => {
    const fakeSkus = [
      {
        id: "sku-1",
        customerId: CUSTOMER_ID,
        product: { id: "p1", sku: "SKU-001", name: "Widget", currentCost: "4.2000" },
        priceHistory: [],
        sellingPrice: "10.00",
        packageQuantity: 1,
        alertStatus: "OK",
        reviewStatus: "PENDING",
      },
    ];
    mockDb.customerSku.findMany.mockResolvedValue(fakeSkus);

    const results = await listCustomerSkus(CUSTOMER_ID, USER_ID, [
      Permission.GLOBAL_CUSTOMER_ACCESS,
      Permission.VIEW_CUSTOMERS,
      // No view_product_cost
    ]);
    expect(results[0].product).not.toHaveProperty("currentCost");
  });
});

describe("createCustomerSku", () => {
  it("creates a CustomerPriceHistory row when sellingPrice is provided", async () => {
    mockDb.customerAssignment.findUnique.mockResolvedValue({ userId: USER_ID, customerId: CUSTOMER_ID });
    mockDb.customerSku.findFirst.mockResolvedValue(null); // no conflict
    const fakeSku = {
      id: "sku-new",
      customerId: CUSTOMER_ID,
      productId: "prod-1",
      sellingPrice: "10.00",
      packageQuantity: 1,
    };
    mockDb.customerSku.create.mockResolvedValue(fakeSku);
    mockDb.customerPriceHistory.create.mockResolvedValue({ id: "ph-1" });

    await createCustomerSku(
      CUSTOMER_ID,
      { productId: "prod-1", sellingPrice: 10.0, packageQuantity: 1, useShippingDimensions: false },
      USER_ID,
      [Permission.MANAGE_CUSTOMER_SKUS],
      USER_ID
    );

    expect(mockDb.customerPriceHistory.create).toHaveBeenCalledOnce();
    expect(mockDb.customerPriceHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sellingPrice: 10.0, customerSkuId: "sku-new" }),
      })
    );
  });

  it("does not create PriceHistory when no sellingPrice provided", async () => {
    mockDb.customerAssignment.findUnique.mockResolvedValue({ userId: USER_ID, customerId: CUSTOMER_ID });
    mockDb.customerSku.findFirst.mockResolvedValue(null);
    const fakeSku = {
      id: "sku-new",
      customerId: CUSTOMER_ID,
      productId: "prod-1",
      sellingPrice: null,
      packageQuantity: 1,
    };
    mockDb.customerSku.create.mockResolvedValue(fakeSku);

    await createCustomerSku(
      CUSTOMER_ID,
      { productId: "prod-1", packageQuantity: 1, useShippingDimensions: false },
      USER_ID,
      [Permission.MANAGE_CUSTOMER_SKUS],
      USER_ID
    );

    expect(mockDb.customerPriceHistory.create).not.toHaveBeenCalled();
  });
});
