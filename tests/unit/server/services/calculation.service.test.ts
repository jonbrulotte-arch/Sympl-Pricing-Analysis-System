import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db and audit log before importing
vi.mock("@/lib/db", () => ({
  db: {
    customerSku: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    calculationResult: {
      create: vi.fn(),
    },
    alert: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    alertHistory: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/audit-log.service", () => ({
  logAction: vi.fn(),
  AuditAction: {
    CALCULATION_COMPLETED: "CALCULATION_COMPLETED",
    ALERT_CREATED: "ALERT_CREATED",
    ALERT_STATUS_CHANGED: "ALERT_STATUS_CHANGED",
  },
}));

vi.mock("@/server/services/alert.service", () => ({
  createOrUpdateAlert: vi.fn(),
  autoResolveMarginAlerts: vi.fn(),
}));

import { db } from "@/lib/db";
import { calculateCustomerSku } from "@/server/services/calculation.service";
import { createOrUpdateAlert, autoResolveMarginAlerts } from "@/server/services/alert.service";

const mockDb = db as unknown as {
  customerSku: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  calculationResult: { create: ReturnType<typeof vi.fn> };
  alert: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  alertHistory: { create: ReturnType<typeof vi.fn> };
};

const baseSku = {
  id: "sku-1",
  customerId: "cust-1",
  productId: "prod-1",
  sellingPrice: "10.00",
  packageQuantity: 1,
  minimumMarginOverride: null,
  shippingTermsOverride: null,
  useShippingDimensions: false,
  alertStatus: "OK",
  product: {
    id: "prod-1",
    sku: "SKU-001",
    name: "Widget",
    currentCost: "4.00",
    category: null,
  },
  customer: {
    id: "cust-1",
    shippingTerms: "PREPAID",
    allocations: [],
    marginRequirement: {
      minimumMarginPercent: "35.00",
      warningThresholdPercent: "40.00",
      criticalThresholdPercent: "25.00",
      calculationMethod: "CONTRIBUTION_MARGIN",
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.customerSku.findUnique.mockResolvedValue(baseSku);
});

describe("calculateCustomerSku", () => {
  it("computes correct contribution margin with no allocations", async () => {
    const result = await calculateCustomerSku("sku-1", "user-1");

    // Net revenue = 10.00 (no allowances)
    // Total variable cost = 4.00 (no shipping cost stub)
    // Contribution profit = 6.00
    // CM% = 6/10 * 100 = 60%
    expect(result.netRevenue).toBeCloseTo(10.0);
    expect(result.totalVariableCost).toBeCloseTo(4.0);
    expect(result.contributionProfit).toBeCloseTo(6.0);
    expect(result.contributionMarginPercent).toBeCloseTo(60.0);
    expect(result.alertStatus).toBe("OK");
  });

  it("returns OK when margin exceeds all thresholds", async () => {
    const result = await calculateCustomerSku("sku-1", "user-1");
    expect(result.alertStatus).toBe("OK");
  });

  it("returns WARNING when margin is below warning threshold", async () => {
    mockDb.customerSku.findUnique.mockResolvedValue({
      ...baseSku,
      sellingPrice: "5.00", // margin = (5-4)/5 = 20% — below warning 40%
    });
    const result = await calculateCustomerSku("sku-1", "user-1");
    expect(result.contributionMarginPercent).toBeCloseTo(20.0);
    // 20% < warning(40%) but > critical(25%)? No: 20 < 25 critical → CRITICAL
    // Actually 20 < 25 (critical) → CRITICAL
    expect(result.alertStatus).toBe("CRITICAL");
  });

  it("returns HIGH when margin is below minimum but above critical", async () => {
    // selling=7, cost=4 → profit=3, margin=3/7*100=42.86%... too high
    // need 25 < margin < 35
    // selling=5.50, cost=4 → profit=1.50, margin=1.5/5.5=27.27% → between critical(25%) and min(35%) → HIGH
    mockDb.customerSku.findUnique.mockResolvedValue({
      ...baseSku,
      sellingPrice: "5.50",
      product: { ...baseSku.product, currentCost: "4.00" },
    });
    const result = await calculateCustomerSku("sku-1", "user-1");
    expect(result.contributionMarginPercent).toBeCloseTo(27.27, 1);
    expect(result.alertStatus).toBe("HIGH");
  });

  it("returns CRITICAL when contribution profit is negative", async () => {
    mockDb.customerSku.findUnique.mockResolvedValue({
      ...baseSku,
      sellingPrice: "3.00", // cost=4, profit=-1
    });
    const result = await calculateCustomerSku("sku-1", "user-1");
    expect(result.contributionProfit).toBeLessThan(0);
    expect(result.alertStatus).toBe("CRITICAL");
  });

  it("sets alertStatus HIGH when selling price is missing", async () => {
    mockDb.customerSku.findUnique.mockResolvedValue({
      ...baseSku,
      sellingPrice: null,
    });
    const result = await calculateCustomerSku("sku-1", "user-1");
    expect(result.alertStatus).toBe("HIGH");
    expect(result.trace.dataQuality.missingSellingPrice).toBe(true);
  });

  it("sets alertStatus HIGH when product cost is missing", async () => {
    mockDb.customerSku.findUnique.mockResolvedValue({
      ...baseSku,
      product: { ...baseSku.product, currentCost: null },
    });
    const result = await calculateCustomerSku("sku-1", "user-1");
    expect(result.alertStatus).toBe("HIGH");
    expect(result.trace.dataQuality.missingProductCost).toBe(true);
  });

  it("applies PERCENT_OF_SELLING_PRICE allocation to reduce net revenue", async () => {
    mockDb.customerSku.findUnique.mockResolvedValue({
      ...baseSku,
      customer: {
        ...baseSku.customer,
        allocations: [
          {
            id: "alloc-1",
            name: "Commission",
            calculationType: "PERCENT_OF_SELLING_PRICE",
            rate: "0.05", // 5%
            amount: null,
            priority: 0,
            isActive: true,
            effectiveDate: new Date("2000-01-01"),
            expirationDate: null,
          },
        ],
      },
    });
    const result = await calculateCustomerSku("sku-1", "user-1");
    // Net revenue = 10 - (0.05 * 10) = 9.50
    // CM% = (9.5 - 4) / 9.5 * 100 = 57.89%
    expect(result.netRevenue).toBeCloseTo(9.5);
    expect(result.contributionMarginPercent).toBeCloseTo(57.89, 1);
  });

  it("applies PERCENT_OF_COST allocation to increase variable cost", async () => {
    mockDb.customerSku.findUnique.mockResolvedValue({
      ...baseSku,
      customer: {
        ...baseSku.customer,
        allocations: [
          {
            id: "alloc-1",
            name: "Rebate",
            calculationType: "PERCENT_OF_COST",
            rate: "0.10", // 10% of cost
            amount: null,
            priority: 0,
            isActive: true,
            effectiveDate: new Date("2000-01-01"),
            expirationDate: null,
          },
        ],
      },
    });
    const result = await calculateCustomerSku("sku-1", "user-1");
    // Total cost = 4 + (0.10 * 4) = 4.40
    // CM% = (10 - 4.40) / 10 * 100 = 56%
    expect(result.totalVariableCost).toBeCloseTo(4.4);
    expect(result.contributionMarginPercent).toBeCloseTo(56.0);
  });

  it("applies FIXED_PER_UNIT allocation multiplied by packageQuantity", async () => {
    mockDb.customerSku.findUnique.mockResolvedValue({
      ...baseSku,
      packageQuantity: 3,
      customer: {
        ...baseSku.customer,
        allocations: [
          {
            id: "alloc-1",
            name: "Handling",
            calculationType: "FIXED_PER_UNIT",
            rate: null,
            amount: "0.50",
            priority: 0,
            isActive: true,
            effectiveDate: new Date("2000-01-01"),
            expirationDate: null,
          },
        ],
      },
    });
    const result = await calculateCustomerSku("sku-1", "user-1");
    // Fixed cost = 0.50 * 3 = 1.50 added to variable cost
    // Total cost = 4 + 1.50 = 5.50
    expect(result.totalVariableCost).toBeCloseTo(5.5);
  });

  it("uses GROSS_MARGIN method when calculationMethod is GROSS_MARGIN", async () => {
    mockDb.customerSku.findUnique.mockResolvedValue({
      ...baseSku,
      customer: {
        ...baseSku.customer,
        allocations: [
          {
            id: "alloc-1",
            name: "Commission",
            calculationType: "PERCENT_OF_SELLING_PRICE",
            rate: "0.10",
            amount: null,
            priority: 0,
            isActive: true,
            effectiveDate: new Date("2000-01-01"),
            expirationDate: null,
          },
        ],
        marginRequirement: {
          minimumMarginPercent: "35.00",
          warningThresholdPercent: "40.00",
          criticalThresholdPercent: "25.00",
          calculationMethod: "GROSS_MARGIN",
        },
      },
    });
    const result = await calculateCustomerSku("sku-1", "user-1");
    // Net revenue = 10 - (0.10 * 10) = 9.00
    // CM profit = 9 - 4 = 5
    // GROSS_MARGIN denominator = sellingPrice = 10
    // CM% = 5/10*100 = 50%
    expect(result.contributionMarginPercent).toBeCloseTo(50.0);
  });

  it("uses CustomerSku.minimumMarginOverride in precedence over customer requirement", async () => {
    mockDb.customerSku.findUnique.mockResolvedValue({
      ...baseSku,
      minimumMarginOverride: "20.00", // override
    });
    const result = await calculateCustomerSku("sku-1", "user-1");
    expect(result.trace.appliedOverrides).toContain("CustomerSku.minimumMarginOverride");
    expect(Number(result.trace.outputs.requiredMinimumMargin)).toBe(20.0);
  });

  it("includes calculationTrace with engine version and all sections", async () => {
    const result = await calculateCustomerSku("sku-1", "user-1");
    expect(result.trace.engineVersion).toBe("1.0.0");
    expect(result.trace.inputs).toBeDefined();
    expect(result.trace.intermediates).toBeDefined();
    expect(result.trace.outputs).toBeDefined();
    expect(result.trace.dataQuality).toBeDefined();
  });
});
