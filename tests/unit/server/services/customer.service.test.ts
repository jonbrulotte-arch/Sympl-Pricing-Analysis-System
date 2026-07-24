import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    customer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customerAssignment: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/authorization/check-customer-access", () => ({
  checkCustomerAccess: vi.fn().mockResolvedValue(true),
  getAssignedCustomerIds: vi.fn().mockResolvedValue(["c1", "c2"]),
}));

import { db } from "@/lib/db";
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/server/services/customer.service";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";

const mockDb = db as unknown as {
  customer: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const mockCheckAccess = checkCustomerAccess as ReturnType<typeof vi.fn>;

const ACTOR = "actor-1";
const GLOBAL_PERMS = ["global_customer_access"];
const LIMITED_PERMS = ["view_customers"];

beforeEach(() => vi.clearAllMocks());

describe("listCustomers", () => {
  it("returns all customers when user has global access", async () => {
    const customers = [{ id: "c1", name: "Acme" }];
    mockDb.customer.findMany.mockResolvedValue(customers);

    const result = await listCustomers(ACTOR, GLOBAL_PERMS);

    expect(result).toBe(customers);
    expect(mockDb.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    );
  });

  it("filters to assigned customers when user lacks global access", async () => {
    mockDb.customer.findMany.mockResolvedValue([]);

    await listCustomers(ACTOR, LIMITED_PERMS);

    expect(mockDb.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["c1", "c2"] }, deletedAt: null },
      })
    );
  });
});

describe("getCustomerById", () => {
  it("returns customer when access is allowed", async () => {
    const customer = { id: "c1", name: "Acme", assignments: [] };
    mockDb.customer.findFirst.mockResolvedValue(customer);

    const result = await getCustomerById("c1", ACTOR, GLOBAL_PERMS);
    expect(result).toBe(customer);
  });

  it("throws ForbiddenError when access is denied", async () => {
    mockCheckAccess.mockResolvedValueOnce(false);

    await expect(getCustomerById("c1", ACTOR, LIMITED_PERMS)).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when customer is deleted", async () => {
    mockDb.customer.findFirst.mockResolvedValue(null);

    await expect(getCustomerById("c1", ACTOR, GLOBAL_PERMS)).rejects.toThrow(NotFoundError);
  });
});

describe("createCustomer", () => {
  const input = {
    name: "New Corp",
    code: "NEW",
    status: "ACTIVE" as const,
    currency: "USD",
    timezone: "America/New_York",
    shippingTerms: "PREPAID" as const,
    isResidential: false,
  };

  it("creates customer and logs the action", async () => {
    mockDb.customer.findUnique.mockResolvedValue(null);
    const created = { id: "c-new", ...input };
    mockDb.customer.create.mockResolvedValue(created);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await createCustomer(input, ACTOR);

    expect(result).toBe(created);
    expect(mockDb.auditLog.create).toHaveBeenCalled();
  });

  it("throws ConflictError when code already exists", async () => {
    mockDb.customer.findUnique.mockResolvedValue({ id: "existing" });

    await expect(createCustomer(input, ACTOR)).rejects.toThrow(ConflictError);
  });
});

describe("updateCustomer", () => {
  it("updates customer and logs the action", async () => {
    const existing = { id: "c1", name: "Old", status: "ACTIVE" };
    const updated = { id: "c1", name: "New", status: "ACTIVE" };
    mockDb.customer.findFirst.mockResolvedValue(existing);
    mockDb.customer.update.mockResolvedValue(updated);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await updateCustomer("c1", { name: "New" }, ACTOR, GLOBAL_PERMS, ACTOR);
    expect(result).toBe(updated);
  });

  it("throws ForbiddenError when access is denied", async () => {
    mockCheckAccess.mockResolvedValueOnce(false);

    await expect(updateCustomer("c1", { name: "X" }, ACTOR, LIMITED_PERMS, ACTOR)).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when customer not found", async () => {
    mockDb.customer.findFirst.mockResolvedValue(null);

    await expect(updateCustomer("missing", { name: "X" }, ACTOR, GLOBAL_PERMS, ACTOR)).rejects.toThrow(NotFoundError);
  });
});

describe("deleteCustomer", () => {
  it("soft-deletes customer and logs the action", async () => {
    mockDb.customer.findFirst.mockResolvedValue({ id: "c1" });
    mockDb.customer.update.mockResolvedValue({});
    mockDb.auditLog.create.mockResolvedValue({});

    await deleteCustomer("c1", ACTOR);

    expect(mockDb.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } })
    );
  });

  it("throws NotFoundError when customer not found", async () => {
    mockDb.customer.findFirst.mockResolvedValue(null);

    await expect(deleteCustomer("missing", ACTOR)).rejects.toThrow(NotFoundError);
  });
});
