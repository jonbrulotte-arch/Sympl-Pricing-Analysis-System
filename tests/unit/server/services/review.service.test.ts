import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    customerSku: { findFirst: vi.fn(), update: vi.fn() },
    customerAssignment: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { performReviewAction } from "@/server/services/review.service";
import { Permission } from "@/server/authorization/permissions";

const mockDb = db as unknown as {
  customerSku: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  customerAssignment: { findUnique: ReturnType<typeof vi.fn> };
  notification: { create: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const managerPerms = [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS, Permission.MANAGE_CUSTOMER_SKUS];
const analystPerms = [Permission.VIEW_CUSTOMERS, Permission.GLOBAL_CUSTOMER_ACCESS];

function makeSku(reviewStatus: string, assignedAnalystId: string | null = null) {
  return { id: "sku-1", reviewStatus, assignedAnalystId };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.customerAssignment.findUnique.mockResolvedValue({ userId: "user-1", customerId: "cust-1" });
  mockDb.customerSku.update.mockResolvedValue({});
  mockDb.auditLog.create.mockResolvedValue({});
  mockDb.notification.create.mockResolvedValue({});
});

describe("performReviewAction", () => {
  it("transitions PENDING → UNDER_REVIEW on 'request'", async () => {
    mockDb.customerSku.findFirst.mockResolvedValue(makeSku("PENDING"));
    const result = await performReviewAction("sku-1", "cust-1", "request", "user-1", analystPerms);
    expect(result.reviewStatus).toBe("UNDER_REVIEW");
    expect(mockDb.customerSku.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reviewStatus: "UNDER_REVIEW" } })
    );
  });

  it("transitions UNDER_REVIEW → APPROVED on 'approve'", async () => {
    mockDb.customerSku.findFirst.mockResolvedValue(makeSku("UNDER_REVIEW"));
    const result = await performReviewAction("sku-1", "cust-1", "approve", "mgr-1", managerPerms);
    expect(result.reviewStatus).toBe("APPROVED");
  });

  it("transitions UNDER_REVIEW → ESCALATED on 'escalate'", async () => {
    mockDb.customerSku.findFirst.mockResolvedValue(makeSku("UNDER_REVIEW"));
    const result = await performReviewAction("sku-1", "cust-1", "escalate", "mgr-1", managerPerms);
    expect(result.reviewStatus).toBe("ESCALATED");
  });

  it("transitions APPROVED → PENDING on 'reset'", async () => {
    mockDb.customerSku.findFirst.mockResolvedValue(makeSku("APPROVED"));
    const result = await performReviewAction("sku-1", "cust-1", "reset", "mgr-1", managerPerms);
    expect(result.reviewStatus).toBe("PENDING");
  });

  it("throws 422 for invalid transition (PENDING → approve)", async () => {
    mockDb.customerSku.findFirst.mockResolvedValue(makeSku("PENDING"));
    await expect(
      performReviewAction("sku-1", "cust-1", "approve", "mgr-1", managerPerms)
    ).rejects.toThrow("Cannot 'approve' a SKU in 'PENDING' status");
  });

  it("throws 403 when analyst tries to approve without manage_customer_skus", async () => {
    mockDb.customerSku.findFirst.mockResolvedValue(makeSku("UNDER_REVIEW"));
    await expect(
      performReviewAction("sku-1", "cust-1", "approve", "user-1", analystPerms)
    ).rejects.toThrow("manage_customer_skus required");
  });

  it("throws 403 when user has no customer access", async () => {
    mockDb.customerAssignment.findUnique.mockResolvedValue(null);
    mockDb.customerSku.findFirst.mockResolvedValue(makeSku("PENDING"));
    await expect(
      performReviewAction("sku-1", "cust-1", "request", "user-1", [Permission.VIEW_CUSTOMERS])
    ).rejects.toThrow("Access to this customer is denied");
  });

  it("throws 404 when SKU not found", async () => {
    mockDb.customerSku.findFirst.mockResolvedValue(null);
    await expect(
      performReviewAction("sku-999", "cust-1", "request", "user-1", analystPerms)
    ).rejects.toThrow("CustomerSku not found");
  });

  it("notifies assigned analyst when review is requested", async () => {
    mockDb.customerSku.findFirst.mockResolvedValue(makeSku("PENDING", "analyst-1"));
    await performReviewAction("sku-1", "cust-1", "request", "user-1", analystPerms);
    expect(mockDb.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "analyst-1",
          type: "REVIEW_REQUESTED",
        }),
      })
    );
  });

  it("does not notify when actor is the assigned analyst", async () => {
    mockDb.customerSku.findFirst.mockResolvedValue(makeSku("PENDING", "user-1"));
    await performReviewAction("sku-1", "cust-1", "request", "user-1", analystPerms);
    expect(mockDb.notification.create).not.toHaveBeenCalled();
  });
});
