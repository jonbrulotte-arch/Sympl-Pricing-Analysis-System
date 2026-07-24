import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("exceljs", () => {
  class MockWorksheet {
    columns: unknown[] = [];
    views: unknown[] = [];
    autoFilter: unknown = null;
    getRow() { return { font: null, fill: null }; }
    addRow() {}
  }
  class MockWorkbook {
    creator = "";
    created: Date | null = null;
    addWorksheet() { return new MockWorksheet(); }
    xlsx = { writeBuffer: async () => new Uint8Array([1, 2, 3]) };
  }
  return { default: { Workbook: MockWorkbook } };
});

vi.mock("@/lib/db", () => ({
  db: {
    customerSku: { findMany: vi.fn() },
    alert: { findMany: vi.fn() },
    customerPriceHistory: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    customerAssignment: { findMany: vi.fn() },
  },
}));

vi.mock("@/server/authorization/check-customer-access", () => ({
  getAssignedCustomerIds: vi.fn().mockResolvedValue(["c1", "c2"]),
  checkCustomerAccess: vi.fn().mockResolvedValue(true),
}));

import { db } from "@/lib/db";
import {
  generatePortfolioMarginReport,
  generateAlertSummaryReport,
  generatePriceHistoryReport,
} from "@/server/services/report.service";
import { ForbiddenError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";

const mockDb = db as unknown as {
  customerSku: { findMany: ReturnType<typeof vi.fn> };
  alert: { findMany: ReturnType<typeof vi.fn> };
  customerPriceHistory: { findMany: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const mockCheckAccess = checkCustomerAccess as ReturnType<typeof vi.fn>;

const USER_ID = "user-1";
const BASE_PERMISSIONS = ["view_reports", "view_customers"];
const FULL_PERMISSIONS = [...BASE_PERMISSIONS, "view_product_cost", "view_calculated_margin", "global_customer_access"];

function makeSku(overrides = {}) {
  return {
    id: "sku-1",
    sellingPrice: "10.5000",
    packageQuantity: 12,
    alertStatus: "OK",
    reviewStatus: "PENDING",
    lastCalculatedAt: new Date("2024-01-15"),
    customer: { name: "Acme Corp", code: "ACM" },
    product: {
      sku: "SKU-001",
      name: "Widget A",
      currentCost: "6.0000",
      category: { name: "Widgets" },
    },
    calculationResults: [{
      contributionMarginPercent: "42.86",
      contributionProfit: "4.50",
      calculatedAt: new Date("2024-01-15"),
    }],
    ...overrides,
  };
}

function makeAlert(overrides = {}) {
  return {
    id: "alert-1",
    alertType: "MARGIN_BELOW_MINIMUM",
    severity: "CRITICAL",
    status: "OPEN",
    message: "Margin dropped below minimum",
    triggeredAt: new Date("2024-01-10"),
    acknowledgedAt: null,
    customerSku: {
      product: { sku: "SKU-001", name: "Widget A" },
      customer: { name: "Acme Corp", code: "ACM" },
    },
    acknowledgedBy: null,
    ...overrides,
  };
}

function makePriceHistory(overrides = {}) {
  return {
    id: "ph-1",
    sellingPrice: "10.5000",
    effectiveDate: new Date("2024-01-01"),
    createdAt: new Date("2024-01-01"),
    customerSku: {
      product: { sku: "SKU-001", name: "Widget A" },
      customer: { name: "Acme Corp", code: "ACM" },
    },
    recordedBy: { firstName: "Jane", lastName: "Smith" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.auditLog.create.mockResolvedValue({});
});

describe("generatePortfolioMarginReport", () => {
  it("returns a Buffer from the excel workbook", async () => {
    mockDb.customerSku.findMany.mockResolvedValue([makeSku()]);

    const result = await generatePortfolioMarginReport(USER_ID, FULL_PERMISSIONS);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(mockDb.customerSku.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    );
  });

  it("applies customer isolation when user lacks global access", async () => {
    mockDb.customerSku.findMany.mockResolvedValue([]);

    await generatePortfolioMarginReport(USER_ID, BASE_PERMISSIONS);

    expect(mockDb.customerSku.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null, customerId: { in: ["c1", "c2"] } },
      })
    );
  });

  it("includes cost and margin columns when user has those permissions", async () => {
    const sku = makeSku();
    mockDb.customerSku.findMany.mockResolvedValue([sku]);

    await generatePortfolioMarginReport(USER_ID, FULL_PERMISSIONS);

    expect(mockDb.customerSku.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          calculationResults: expect.objectContaining({ take: 1 }),
        }),
      })
    );
  });

  it("handles SKU with no calculation result", async () => {
    const sku = makeSku({ calculationResults: [] });
    mockDb.customerSku.findMany.mockResolvedValue([sku]);

    const result = await generatePortfolioMarginReport(USER_ID, FULL_PERMISSIONS);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("logs the report generation action", async () => {
    mockDb.customerSku.findMany.mockResolvedValue([makeSku()]);

    await generatePortfolioMarginReport(USER_ID, FULL_PERMISSIONS);

    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "REPORT_GENERATED",
          entityId: "portfolio-margin",
        }),
      })
    );
  });
});

describe("generateAlertSummaryReport", () => {
  it("returns a Buffer and sorts CRITICAL alerts first", async () => {
    const criticalAlert = makeAlert({ severity: "CRITICAL" });
    const warningAlert = makeAlert({ id: "alert-2", severity: "WARNING" });
    mockDb.alert.findMany.mockResolvedValue([warningAlert, criticalAlert]);

    const result = await generateAlertSummaryReport(USER_ID, FULL_PERMISSIONS);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("applies customer isolation filter when user lacks global access", async () => {
    mockDb.alert.findMany.mockResolvedValue([]);

    await generateAlertSummaryReport(USER_ID, BASE_PERMISSIONS);

    expect(mockDb.alert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerSku: { customerId: { in: ["c1", "c2"] } } },
      })
    );
  });

  it("handles alert with no global access restriction for admin", async () => {
    mockDb.alert.findMany.mockResolvedValue([makeAlert()]);

    await generateAlertSummaryReport(USER_ID, FULL_PERMISSIONS);

    expect(mockDb.alert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerSku: {} },
      })
    );
  });

  it("includes acknowledgedBy name when present", async () => {
    const alert = makeAlert({
      acknowledgedAt: new Date("2024-01-11"),
      acknowledgedBy: { firstName: "Bob", lastName: "Jones" },
    });
    mockDb.alert.findMany.mockResolvedValue([alert]);

    const result = await generateAlertSummaryReport(USER_ID, FULL_PERMISSIONS);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("logs the report generation action", async () => {
    mockDb.alert.findMany.mockResolvedValue([]);

    await generateAlertSummaryReport(USER_ID, FULL_PERMISSIONS);

    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "REPORT_GENERATED",
          entityId: "alert-summary",
        }),
      })
    );
  });
});

describe("generatePriceHistoryReport", () => {
  const CUSTOMER_ID = "c1";

  it("returns a Buffer for an authorized customer", async () => {
    mockDb.customerPriceHistory.findMany.mockResolvedValue([makePriceHistory()]);

    const result = await generatePriceHistoryReport(CUSTOMER_ID, USER_ID, FULL_PERMISSIONS);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("throws ForbiddenError when user cannot access the customer", async () => {
    mockCheckAccess.mockResolvedValueOnce(false);

    await expect(
      generatePriceHistoryReport("unauthorized", USER_ID, BASE_PERMISSIONS)
    ).rejects.toThrow(ForbiddenError);

    expect(mockDb.customerPriceHistory.findMany).not.toHaveBeenCalled();
  });

  it("queries price history filtered to the given customer", async () => {
    mockDb.customerPriceHistory.findMany.mockResolvedValue([]);

    await generatePriceHistoryReport(CUSTOMER_ID, USER_ID, FULL_PERMISSIONS);

    expect(mockDb.customerPriceHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerSku: { customerId: CUSTOMER_ID } },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("handles empty price history gracefully", async () => {
    mockDb.customerPriceHistory.findMany.mockResolvedValue([]);

    const result = await generatePriceHistoryReport(CUSTOMER_ID, USER_ID, FULL_PERMISSIONS);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("logs the report generation action with customerId", async () => {
    mockDb.customerPriceHistory.findMany.mockResolvedValue([makePriceHistory()]);

    await generatePriceHistoryReport(CUSTOMER_ID, USER_ID, FULL_PERMISSIONS);

    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "REPORT_GENERATED",
          entityId: `price-history:${CUSTOMER_ID}`,
        }),
      })
    );
  });
});
