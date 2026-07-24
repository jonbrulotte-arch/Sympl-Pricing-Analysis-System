import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customerAssignment: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  assignCustomerToUser,
  removeCustomerFromUser,
} from "@/server/services/user.service";
import { NotFoundError, ConflictError } from "@/lib/errors";

const mockDb = db as unknown as {
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  customerAssignment: {
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

const ACTOR_ID = "actor-1";

describe("listUsers", () => {
  it("returns users ordered by last name, excluding deleted", async () => {
    const users = [{ id: "u1", email: "a@test.com", firstName: "A", lastName: "B", isActive: true }];
    mockDb.user.findMany.mockResolvedValue(users);

    const result = await listUsers();

    expect(mockDb.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        orderBy: { lastName: "asc" },
      })
    );
    expect(result).toBe(users);
  });
});

describe("getUserById", () => {
  it("returns user with assignments and permissions", async () => {
    const user = { id: "u1", role: null, assignments: [], userPermissions: [] };
    mockDb.user.findFirst.mockResolvedValue(user);

    const result = await getUserById("u1");
    expect(result).toBe(user);
    expect(mockDb.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1", deletedAt: null } })
    );
  });

  it("throws NotFoundError when user does not exist", async () => {
    mockDb.user.findFirst.mockResolvedValue(null);

    await expect(getUserById("missing")).rejects.toThrow(NotFoundError);
  });
});

describe("createUser", () => {
  const input = {
    email: "new@test.com",
    password: "secret123",
    firstName: "Jane",
    lastName: "Doe",
    roleId: "role-1",
  };

  it("creates user with hashed password and logs the action", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    const createdUser = {
      id: "u2",
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: { name: "ADMIN" },
    };
    mockDb.user.create.mockResolvedValue(createdUser);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await createUser(input, ACTOR_ID);

    expect(mockDb.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: input.email,
          passwordHash: "hashed-password",
          roleId: input.roleId,
        }),
      })
    );
    expect(mockDb.auditLog.create).toHaveBeenCalled();
    expect(result).toBe(createdUser);
  });

  it("throws ConflictError when email already exists", async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: "existing" });

    await expect(createUser(input, ACTOR_ID)).rejects.toThrow(ConflictError);
    expect(mockDb.user.create).not.toHaveBeenCalled();
  });
});

describe("updateUser", () => {
  it("updates user and logs the action", async () => {
    const existingUser = { id: "u1", email: "a@test.com", isActive: true };
    const updatedUser = { id: "u1", email: "a@test.com", isActive: false, role: { name: "ANALYST" } };
    mockDb.user.findFirst.mockResolvedValue(existingUser);
    mockDb.user.update.mockResolvedValue(updatedUser);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await updateUser("u1", { isActive: false }, ACTOR_ID);

    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" }, data: { isActive: false } })
    );
    expect(mockDb.auditLog.create).toHaveBeenCalled();
    expect(result).toBe(updatedUser);
  });

  it("throws NotFoundError when user does not exist", async () => {
    mockDb.user.findFirst.mockResolvedValue(null);

    await expect(updateUser("missing", { firstName: "X" }, ACTOR_ID)).rejects.toThrow(NotFoundError);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });
});

describe("deactivateUser", () => {
  it("sets isActive to false and logs the action", async () => {
    mockDb.user.findFirst.mockResolvedValue({ id: "u1", isActive: true });
    mockDb.user.update.mockResolvedValue({});
    mockDb.auditLog.create.mockResolvedValue({});

    await deactivateUser("u1", ACTOR_ID);

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { isActive: false },
    });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "USER_DEACTIVATED" }),
      })
    );
  });

  it("throws NotFoundError when user does not exist", async () => {
    mockDb.user.findFirst.mockResolvedValue(null);

    await expect(deactivateUser("missing", ACTOR_ID)).rejects.toThrow(NotFoundError);
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });
});

describe("assignCustomerToUser", () => {
  it("upserts the assignment and logs the action", async () => {
    mockDb.customerAssignment.upsert.mockResolvedValue({});
    mockDb.auditLog.create.mockResolvedValue({});

    await assignCustomerToUser("u1", "c1", "ANALYST", ACTOR_ID);

    expect(mockDb.customerAssignment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_customerId: { userId: "u1", customerId: "c1" } },
        create: expect.objectContaining({ userId: "u1", customerId: "c1", role: "ANALYST" }),
        update: { role: "ANALYST" },
      })
    );
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CUSTOMER_ASSIGNED" }),
      })
    );
  });

  it("allows updating the role on an existing assignment", async () => {
    mockDb.customerAssignment.upsert.mockResolvedValue({});
    mockDb.auditLog.create.mockResolvedValue({});

    await assignCustomerToUser("u1", "c1", "OWNER", ACTOR_ID);

    expect(mockDb.customerAssignment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { role: "OWNER" } })
    );
  });
});

describe("removeCustomerFromUser", () => {
  it("deletes the assignment and logs the action", async () => {
    mockDb.customerAssignment.deleteMany.mockResolvedValue({ count: 1 });
    mockDb.auditLog.create.mockResolvedValue({});

    await removeCustomerFromUser("u1", "c1", ACTOR_ID);

    expect(mockDb.customerAssignment.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", customerId: "c1" },
    });
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CUSTOMER_UNASSIGNED" }),
      })
    );
  });
});
