import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    customerContact: {
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
  listContacts,
  createContact,
  updateContact,
  deleteContact,
} from "@/server/services/customer-contact.service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";

const mockDb = db as unknown as {
  customerContact: {
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
const PERMS = ["manage_customers"];

beforeEach(() => vi.clearAllMocks());

describe("listContacts", () => {
  it("returns contacts sorted by isPrimary then name", async () => {
    const contacts = [{ id: "ct1", name: "Jane" }];
    mockDb.customerContact.findMany.mockResolvedValue(contacts);

    const result = await listContacts(CID, UID, PERMS);
    expect(result).toBe(contacts);
  });

  it("throws ForbiddenError when access denied", async () => {
    mockCheckAccess.mockResolvedValueOnce(false);
    await expect(listContacts(CID, UID, PERMS)).rejects.toThrow(ForbiddenError);
  });
});

describe("createContact", () => {
  it("creates contact and logs the action", async () => {
    const created = { id: "ct-new", name: "Bob", customerId: CID };
    mockDb.customerContact.create.mockResolvedValue(created);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await createContact(CID, { name: "Bob", isPrimary: false }, UID, PERMS, UID);
    expect(result).toBe(created);
    expect(mockDb.auditLog.create).toHaveBeenCalled();
  });

  it("throws ForbiddenError when access denied", async () => {
    mockCheckAccess.mockResolvedValueOnce(false);
    await expect(createContact(CID, { name: "X", isPrimary: false }, UID, PERMS, UID)).rejects.toThrow(ForbiddenError);
  });
});

describe("updateContact", () => {
  it("updates contact and logs the action", async () => {
    mockDb.customerContact.findFirst.mockResolvedValue({ id: "ct1", name: "Old", customerId: CID });
    mockDb.customerContact.update.mockResolvedValue({ id: "ct1", name: "New" });
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await updateContact(CID, "ct1", { name: "New" }, UID, PERMS, UID);
    expect(result.name).toBe("New");
  });

  it("throws NotFoundError when contact not found", async () => {
    mockDb.customerContact.findFirst.mockResolvedValue(null);
    await expect(updateContact(CID, "missing", { name: "X" }, UID, PERMS, UID)).rejects.toThrow(NotFoundError);
  });
});

describe("deleteContact", () => {
  it("deletes contact and logs the action", async () => {
    mockDb.customerContact.findFirst.mockResolvedValue({ id: "ct1", name: "Jane", customerId: CID });
    mockDb.customerContact.delete.mockResolvedValue({});
    mockDb.auditLog.create.mockResolvedValue({});

    await deleteContact(CID, "ct1", UID, PERMS, UID);
    expect(mockDb.customerContact.delete).toHaveBeenCalledWith({ where: { id: "ct1" } });
  });

  it("throws NotFoundError when contact not found", async () => {
    mockDb.customerContact.findFirst.mockResolvedValue(null);
    await expect(deleteContact(CID, "missing", UID, PERMS, UID)).rejects.toThrow(NotFoundError);
  });
});
