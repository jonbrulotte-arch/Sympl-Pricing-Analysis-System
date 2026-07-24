import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    customerAllocation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/authorization/check-customer-access", () => ({
  checkCustomerAccess: vi.fn().mockResolvedValue(true),
}));

import { db } from "@/lib/db";
import {
  listAllocations,
  createAllocation,
  updateAllocation,
  deleteAllocation,
} from "@/server/services/customer-allocation.service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";

const mockDb = db as unknown as {
  customerAllocation: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const mockCheckAccess = checkCustomerAccess as ReturnType<typeof vi.fn>;
const CID = "c1";
const UID = "u1";
const PERMS = ["manage_allocations"];

beforeEach(() => vi.clearAllMocks());

describe("listAllocations", () => {
  it("returns active allocations sorted by priority", async () => {
    const allocs = [{ id: "a1", name: "Freight" }];
    mockDb.customerAllocation.findMany.mockResolvedValue(allocs);

    const result = await listAllocations(CID, UID, PERMS);
    expect(result).toBe(allocs);
    expect(mockDb.customerAllocation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: CID, isActive: true } })
    );
  });

  it("throws ForbiddenError when access denied", async () => {
    mockCheckAccess.mockResolvedValueOnce(false);
    await expect(listAllocations(CID, UID, PERMS)).rejects.toThrow(ForbiddenError);
  });
});

describe("createAllocation", () => {
  const input = {
    name: "Rebate",
    calculationType: "PERCENT_OF_SELLING_PRICE" as const,
    rate: 0.05,
    effectiveDate: "2024-01-01",
    priority: 0,
    isActive: true,
    isIncludedInMargin: true,
  };

  it("creates allocation and logs the action", async () => {
    const created = { id: "a-new", ...input, customerId: CID };
    mockDb.customerAllocation.create.mockResolvedValue(created);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await createAllocation(CID, input, UID, PERMS, UID);
    expect(result).toBe(created);
    expect(mockDb.auditLog.create).toHaveBeenCalled();
  });

  it("throws ForbiddenError when access denied", async () => {
    mockCheckAccess.mockResolvedValueOnce(false);
    await expect(createAllocation(CID, input, UID, PERMS, UID)).rejects.toThrow(ForbiddenError);
  });
});

describe("updateAllocation", () => {
  it("updates allocation and logs the action", async () => {
    const existing = { id: "a1", name: "Old", isActive: true, customerId: CID };
    const updated = { id: "a1", name: "Updated", isActive: true };
    mockDb.customerAllocation.findFirst.mockResolvedValue(existing);
    mockDb.customerAllocation.update.mockResolvedValue(updated);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await updateAllocation(CID, "a1", { name: "Updated" }, UID, PERMS, UID);
    expect(result).toBe(updated);
  });

  it("throws NotFoundError when allocation not found", async () => {
    mockDb.customerAllocation.findFirst.mockResolvedValue(null);
    await expect(updateAllocation(CID, "missing", { name: "X" }, UID, PERMS, UID)).rejects.toThrow(NotFoundError);
  });
});

describe("deleteAllocation", () => {
  it("deletes allocation and logs the action", async () => {
    mockDb.customerAllocation.findFirst.mockResolvedValue({ id: "a1", name: "Freight", customerId: CID });
    mockDb.customerAllocation.delete.mockResolvedValue({});
    mockDb.auditLog.create.mockResolvedValue({});

    await deleteAllocation(CID, "a1", UID, PERMS, UID);
    expect(mockDb.customerAllocation.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
  });

  it("throws NotFoundError when allocation not found", async () => {
    mockDb.customerAllocation.findFirst.mockResolvedValue(null);
    await expect(deleteAllocation(CID, "missing", UID, PERMS, UID)).rejects.toThrow(NotFoundError);
  });
});
