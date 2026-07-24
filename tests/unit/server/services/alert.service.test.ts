import { describe, it, expect, vi, beforeEach } from "vitest";
import { Permission } from "@/server/authorization/permissions";

vi.mock("@/lib/db", () => ({
  db: {
    alert: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    alertHistory: {
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
    ALERT_CREATED: "ALERT_CREATED",
    ALERT_STATUS_CHANGED: "ALERT_STATUS_CHANGED",
  },
}));

import { db } from "@/lib/db";
import {
  createOrUpdateAlert,
  autoResolveMarginAlerts,
  acknowledgeAlert,
  suppressAlert,
} from "@/server/services/alert.service";
import { ForbiddenError } from "@/lib/errors";

const mockDb = db as unknown as {
  alert: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  alertHistory: { create: ReturnType<typeof vi.fn> };
  customerAssignment: { findUnique: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createOrUpdateAlert", () => {
  it("creates a new OPEN alert when none exists", async () => {
    mockDb.alert.findFirst.mockResolvedValue(null);
    mockDb.alert.create.mockResolvedValue({ id: "alert-1" });
    mockDb.alertHistory.create.mockResolvedValue({});

    await createOrUpdateAlert("sku-1", "BELOW_MINIMUM_MARGIN", "HIGH", "Below min");

    expect(mockDb.alert.create).toHaveBeenCalledOnce();
    expect(mockDb.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerSkuId: "sku-1",
          alertType: "BELOW_MINIMUM_MARGIN",
          severity: "HIGH",
          status: "OPEN",
        }),
      })
    );
    expect(mockDb.alertHistory.create).toHaveBeenCalledOnce();
  });

  it("updates triggeredAt when OPEN alert already exists (deduplication)", async () => {
    mockDb.alert.findFirst.mockResolvedValue({ id: "alert-1", status: "OPEN" });
    mockDb.alert.update.mockResolvedValue({});

    await createOrUpdateAlert("sku-1", "BELOW_MINIMUM_MARGIN", "HIGH");

    expect(mockDb.alert.create).not.toHaveBeenCalled();
    expect(mockDb.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alert-1" },
        data: expect.objectContaining({ triggeredAt: expect.any(Date) }),
      })
    );
  });

  it("creates a new alert when previous was RESOLVED (condition recurred)", async () => {
    // findFirst with status OPEN/ACKNOWLEDGED returns null → condition recurred
    mockDb.alert.findFirst.mockResolvedValue(null);
    mockDb.alert.create.mockResolvedValue({ id: "alert-2" });
    mockDb.alertHistory.create.mockResolvedValue({});

    await createOrUpdateAlert("sku-1", "BELOW_MINIMUM_MARGIN", "HIGH");

    expect(mockDb.alert.create).toHaveBeenCalledOnce();
  });
});

describe("autoResolveMarginAlerts", () => {
  it("resolves all OPEN and ACKNOWLEDGED margin alerts", async () => {
    mockDb.alert.findMany.mockResolvedValue([
      { id: "a1", status: "OPEN" },
      { id: "a2", status: "ACKNOWLEDGED" },
    ]);
    mockDb.alert.update.mockResolvedValue({});
    mockDb.alertHistory.create.mockResolvedValue({});

    await autoResolveMarginAlerts("sku-1");

    expect(mockDb.alert.update).toHaveBeenCalledTimes(2);
    expect(mockDb.alertHistory.create).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no margin alerts are open", async () => {
    mockDb.alert.findMany.mockResolvedValue([]);
    await autoResolveMarginAlerts("sku-1");
    expect(mockDb.alert.update).not.toHaveBeenCalled();
  });
});

describe("acknowledgeAlert", () => {
  it("throws ForbiddenError when user lacks manage_alerts", async () => {
    mockDb.customerAssignment.findUnique.mockResolvedValue({ userId: "u1", customerId: "c1" });
    await expect(
      acknowledgeAlert("alert-1", "c1", "u1", [Permission.VIEW_ALERTS])
    ).rejects.toThrow(ForbiddenError);
  });

  it("transitions OPEN alert to ACKNOWLEDGED", async () => {
    mockDb.customerAssignment.findUnique.mockResolvedValue({ userId: "u1", customerId: "c1" });
    mockDb.alert.findUnique.mockResolvedValue({ id: "alert-1", status: "OPEN" });
    mockDb.alert.update.mockResolvedValue({});
    mockDb.alertHistory.create.mockResolvedValue({});

    await acknowledgeAlert("alert-1", "c1", "u1", [
      Permission.MANAGE_ALERTS,
      Permission.GLOBAL_CUSTOMER_ACCESS,
    ]);

    expect(mockDb.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alert-1" },
        data: expect.objectContaining({ status: "ACKNOWLEDGED" }),
      })
    );
  });
});

describe("suppressAlert", () => {
  it("throws ForbiddenError when user lacks manage_alerts", async () => {
    await expect(
      suppressAlert("alert-1", "c1", "u1", [Permission.VIEW_ALERTS], "reason")
    ).rejects.toThrow(ForbiddenError);
  });

  it("transitions OPEN alert to SUPPRESSED with reason", async () => {
    mockDb.customerAssignment.findUnique.mockResolvedValue({ userId: "u1", customerId: "c1" });
    mockDb.alert.findUnique.mockResolvedValue({ id: "alert-1", status: "OPEN" });
    mockDb.alert.update.mockResolvedValue({});
    mockDb.alertHistory.create.mockResolvedValue({});

    await suppressAlert("alert-1", "c1", "u1", [
      Permission.MANAGE_ALERTS,
      Permission.GLOBAL_CUSTOMER_ACCESS,
    ], "Price negotiation in progress");

    expect(mockDb.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUPPRESSED",
          suppressedReason: "Price negotiation in progress",
        }),
      })
    );
  });
});
