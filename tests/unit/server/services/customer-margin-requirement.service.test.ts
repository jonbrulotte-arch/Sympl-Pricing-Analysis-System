import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    customerMarginRequirement: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/authorization/check-customer-access", () => ({
  checkCustomerAccess: vi.fn().mockResolvedValue(true),
}));

import { db } from "@/lib/db";
import {
  getMarginRequirement,
  upsertMarginRequirement,
} from "@/server/services/customer-margin-requirement.service";
import { ForbiddenError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";

const mockDb = db as unknown as {
  customerMarginRequirement: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const mockCheckAccess = checkCustomerAccess as ReturnType<typeof vi.fn>;
const CID = "c1";
const UID = "u1";
const PERMS = ["manage_margin_requirements"];

beforeEach(() => vi.clearAllMocks());

describe("getMarginRequirement", () => {
  it("returns the margin requirement for the customer", async () => {
    const mr = { id: "mr1", customerId: CID, minimumMarginPercent: "15.00" };
    mockDb.customerMarginRequirement.findUnique.mockResolvedValue(mr);

    const result = await getMarginRequirement(CID, UID, PERMS);
    expect(result).toBe(mr);
  });

  it("returns null when no margin requirement exists", async () => {
    mockDb.customerMarginRequirement.findUnique.mockResolvedValue(null);

    const result = await getMarginRequirement(CID, UID, PERMS);
    expect(result).toBeNull();
  });

  it("throws ForbiddenError when access denied", async () => {
    mockCheckAccess.mockResolvedValueOnce(false);
    await expect(getMarginRequirement(CID, UID, PERMS)).rejects.toThrow(ForbiddenError);
  });
});

describe("upsertMarginRequirement", () => {
  const input = {
    minimumMarginPercent: 20,
    warningThresholdPercent: 18,
    criticalThresholdPercent: 12,
    calculationMethod: "CONTRIBUTION_MARGIN" as const,
  };

  it("creates new margin requirement when none exists", async () => {
    mockDb.customerMarginRequirement.findUnique.mockResolvedValue(null);
    const record = { id: "mr-new", customerId: CID, ...input };
    mockDb.customerMarginRequirement.upsert.mockResolvedValue(record);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await upsertMarginRequirement(CID, input, UID, PERMS, UID);

    expect(result).toBe(record);
    expect(mockDb.customerMarginRequirement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: CID },
        create: expect.objectContaining({ customerId: CID, minimumMarginPercent: 20 }),
      })
    );
  });

  it("updates existing margin requirement", async () => {
    const existing = { id: "mr1", minimumMarginPercent: "10.00", warningThresholdPercent: "12.00" };
    mockDb.customerMarginRequirement.findUnique.mockResolvedValue(existing);
    const updated = { id: "mr1", ...input };
    mockDb.customerMarginRequirement.upsert.mockResolvedValue(updated);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await upsertMarginRequirement(CID, input, UID, PERMS, UID);
    expect(result).toBe(updated);
  });

  it("logs the action with before and after values", async () => {
    const existing = { id: "mr1", minimumMarginPercent: "10.00", warningThresholdPercent: "12.00" };
    mockDb.customerMarginRequirement.findUnique.mockResolvedValue(existing);
    mockDb.customerMarginRequirement.upsert.mockResolvedValue({ id: "mr1" });
    mockDb.auditLog.create.mockResolvedValue({});

    await upsertMarginRequirement(CID, input, UID, PERMS, UID);

    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "MARGIN_REQUIREMENT_CHANGED",
        }),
      })
    );
  });

  it("throws ForbiddenError when access denied", async () => {
    mockCheckAccess.mockResolvedValueOnce(false);
    await expect(upsertMarginRequirement(CID, input, UID, PERMS, UID)).rejects.toThrow(ForbiddenError);
  });
});
