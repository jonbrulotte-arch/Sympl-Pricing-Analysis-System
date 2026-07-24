import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    customer: { count: vi.fn() },
    customerSku: { count: vi.fn() },
    alert: { count: vi.fn(), findMany: vi.fn() },
    calculationResult: { aggregate: vi.fn() },
    customerAssignment: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getDashboardStats } from "@/server/services/dashboard.service";
import { Permission } from "@/server/authorization/permissions";

const mockDb = db as unknown as {
  customer: { count: ReturnType<typeof vi.fn> };
  customerSku: { count: ReturnType<typeof vi.fn> };
  alert: { count: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  calculationResult: { aggregate: ReturnType<typeof vi.fn> };
  customerAssignment: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.customer.count.mockResolvedValue(3);
  mockDb.customerSku.count.mockImplementation((args: { where?: { alertStatus?: string } }) => {
    if (!args?.where?.alertStatus) return Promise.resolve(100);
    const map: Record<string, number> = { OK: 70, WARNING: 15, HIGH: 10, CRITICAL: 5 };
    return Promise.resolve(map[args.where.alertStatus] ?? 0);
  });
  mockDb.alert.count.mockImplementation((args: { where?: { severity?: string } }) => {
    if (!args?.where?.severity) return Promise.resolve(12);
    const map: Record<string, number> = { CRITICAL: 3, HIGH: 5, WARNING: 3, INFO: 1 };
    return Promise.resolve(map[args.where.severity] ?? 0);
  });
  mockDb.alert.findMany.mockResolvedValue([
    {
      id: "a1",
      alertType: "BELOW_CRITICAL_MARGIN",
      severity: "CRITICAL",
      message: "Margin below 25%",
      triggeredAt: new Date(),
      customerSku: {
        customer: { name: "Acme Corp" },
        product: { sku: "SKU-001" },
      },
    },
  ]);
  mockDb.calculationResult.aggregate.mockResolvedValue({
    _avg: { contributionMarginPercent: 45.5 },
  });
  mockDb.customerAssignment.findMany.mockResolvedValue([{ customerId: "cust-1" }]);
});

describe("getDashboardStats", () => {
  it("returns all stats for global access user", async () => {
    const stats = await getDashboardStats("admin-1", [Permission.GLOBAL_CUSTOMER_ACCESS]);

    expect(stats.totalCustomers).toBe(3);
    expect(stats.totalSkus).toBe(100);
    expect(stats.skusByAlertStatus.OK).toBe(70);
    expect(stats.skusByAlertStatus.CRITICAL).toBe(5);
    expect(stats.openAlerts.CRITICAL).toBe(3);
    expect(stats.openAlerts.HIGH).toBe(5);
    expect(stats.averageMargin).toBeCloseTo(45.5);
    expect(stats.recentCriticalAlerts).toHaveLength(1);
    expect(stats.recentCriticalAlerts[0].customerName).toBe("Acme Corp");
  });

  it("filters by assigned customers for non-global user", async () => {
    await getDashboardStats("analyst-1", []);

    expect(mockDb.customerAssignment.findMany).toHaveBeenCalledWith({
      where: { userId: "analyst-1" },
      select: { customerId: true },
    });
    expect(mockDb.customerSku.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customerId: { in: ["cust-1"] },
        }),
      })
    );
  });

  it("handles null average margin", async () => {
    mockDb.calculationResult.aggregate.mockResolvedValue({
      _avg: { contributionMarginPercent: null },
    });

    const stats = await getDashboardStats("admin-1", [Permission.GLOBAL_CUSTOMER_ACCESS]);
    expect(stats.averageMargin).toBeNull();
  });
});
