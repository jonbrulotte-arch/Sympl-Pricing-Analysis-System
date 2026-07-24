import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: { create: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { logAction, AuditAction } from "@/server/services/audit-log.service";

const mockDb = db as unknown as {
  auditLog: { create: ReturnType<typeof vi.fn> };
};

beforeEach(() => vi.clearAllMocks());

describe("logAction", () => {
  it("creates an audit log entry with required fields", async () => {
    mockDb.auditLog.create.mockResolvedValue({ id: "log1" });

    await logAction({
      userId: "u1",
      action: AuditAction.CUSTOMER_CREATED,
      entityType: "Customer",
      entityId: "c1",
    });

    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        action: "CUSTOMER_CREATED",
        entityType: "Customer",
        entityId: "c1",
      }),
    });
  });

  it("stores before and after values when provided", async () => {
    mockDb.auditLog.create.mockResolvedValue({ id: "log2" });

    await logAction({
      userId: "u1",
      action: AuditAction.CUSTOMER_UPDATED,
      entityType: "Customer",
      entityId: "c1",
      beforeValue: { name: "Old" },
      afterValue: { name: "New" },
    });

    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        beforeValue: { name: "Old" },
        afterValue: { name: "New" },
      }),
    });
  });

  it("sets nullable fields to null when not provided", async () => {
    mockDb.auditLog.create.mockResolvedValue({ id: "log3" });

    await logAction({
      action: AuditAction.IMPORT_STARTED,
      entityType: "Import",
      entityId: "imp1",
    });

    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        sourceIp: null,
        correlationId: null,
        importBatchId: null,
        jobId: null,
      }),
    });
  });

  it("passes optional metadata fields when provided", async () => {
    mockDb.auditLog.create.mockResolvedValue({ id: "log4" });

    await logAction({
      userId: "u1",
      action: AuditAction.CALCULATION_TRIGGERED,
      entityType: "CustomerSku",
      entityId: "sku1",
      sourceIp: "10.0.0.1",
      correlationId: "corr-123",
      importBatchId: "batch-1",
      jobId: "job-1",
    });

    expect(mockDb.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceIp: "10.0.0.1",
        correlationId: "corr-123",
        importBatchId: "batch-1",
        jobId: "job-1",
      }),
    });
  });
});

describe("AuditAction constants", () => {
  it("contains expected action names", () => {
    expect(AuditAction.USER_LOGIN).toBe("USER_LOGIN");
    expect(AuditAction.CUSTOMER_CREATED).toBe("CUSTOMER_CREATED");
    expect(AuditAction.REPORT_GENERATED).toBe("REPORT_GENERATED");
    expect(AuditAction.ALERT_CREATED).toBe("ALERT_CREATED");
  });
});
