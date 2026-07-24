import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    customerSku: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    customerAssignment: {
      findMany: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { getRoiGridData } from "@/server/services/roi-grid.service";
import { Permission } from "@/server/authorization/permissions";

const mockDb = db as unknown as {
  customerSku: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  customerAssignment: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const baseSku = {
  id: "sku-1",
  customerId: "cust-1",
  productId: "prod-1",
  customerSkuCode: "CSK-001",
  sellingPrice: "10.00",
  packageQuantity: 1,
  alertStatus: "OK",
  reviewStatus: "PENDING",
  assignedAnalystId: null,
  lastCalculatedAt: new Date(),
  lastQuotedAt: null,
  customer: { id: "cust-1", name: "Acme Corp", code: "ACME" },
  product: {
    id: "prod-1",
    sku: "SKU-001",
    name: "Widget A",
    currentCost: "4.00",
    category: { name: "Hardware" },
  },
  assignedAnalyst: null,
  calculationResults: [
    {
      contributionMarginPercent: "60.00",
      contributionProfit: "6.00",
      netRevenue: "10.00",
      totalVariableCost: "4.00",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.customerSku.findMany.mockResolvedValue([baseSku]);
  mockDb.customerSku.count.mockResolvedValue(1);
  mockDb.customerAssignment.findMany.mockResolvedValue([{ customerId: "cust-1" }]);
});

describe("getRoiGridData", () => {
  const defaultParams = {
    page: 1,
    pageSize: 20,
    sortBy: "customerName" as const,
    sortDir: "asc" as const,
  };

  it("returns paginated results with correct total", async () => {
    const result = await getRoiGridData("user-1", [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS], defaultParams);
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it("includes margin fields when user has view_calculated_margin", async () => {
    const result = await getRoiGridData(
      "user-1",
      [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS, Permission.VIEW_CALCULATED_MARGIN],
      defaultParams
    );
    expect(result.data[0].contributionMarginPercent).toBeCloseTo(60);
    expect(result.data[0].contributionProfit).toBeCloseTo(6);
  });

  it("excludes margin fields when user lacks view_calculated_margin", async () => {
    const result = await getRoiGridData(
      "user-1",
      [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS],
      defaultParams
    );
    expect(result.data[0].contributionMarginPercent).toBeUndefined();
    expect(result.data[0].contributionProfit).toBeUndefined();
  });

  it("includes cost fields when user has view_product_cost", async () => {
    const result = await getRoiGridData(
      "user-1",
      [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS, Permission.VIEW_PRODUCT_COST],
      defaultParams
    );
    expect(result.data[0].currentCost).toBeCloseTo(4);
  });

  it("excludes cost fields when user lacks view_product_cost", async () => {
    const result = await getRoiGridData(
      "user-1",
      [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS],
      defaultParams
    );
    expect(result.data[0].currentCost).toBeUndefined();
  });

  it("applies customer isolation for non-global users", async () => {
    await getRoiGridData("user-1", [Permission.VIEW_CUSTOMERS], defaultParams);
    expect(mockDb.customerAssignment.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { customerId: true },
    });
    expect(mockDb.customerSku.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: { in: ["cust-1"] },
        }),
      })
    );
  });

  it("skips customer isolation for global access users", async () => {
    await getRoiGridData(
      "user-1",
      [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS],
      defaultParams
    );
    expect(mockDb.customerAssignment.findMany).not.toHaveBeenCalled();
  });

  it("passes alertStatus filter to query", async () => {
    await getRoiGridData(
      "user-1",
      [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS],
      { ...defaultParams, alertStatus: "CRITICAL" }
    );
    expect(mockDb.customerSku.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ alertStatus: "CRITICAL" }),
      })
    );
  });

  it("passes search filter to query", async () => {
    await getRoiGridData(
      "user-1",
      [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS],
      { ...defaultParams, search: "widget" }
    );
    expect(mockDb.customerSku.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ product: { name: { contains: "widget", mode: "insensitive" } } }),
          ]),
        }),
      })
    );
  });
});
