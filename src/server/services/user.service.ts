import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { logAction, AuditAction } from "./audit-log.service";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type { CreateUserInput, UpdateUserInput } from "@/server/validation/user.schema";

export async function listUsers() {
  return db.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
    },
    orderBy: { lastName: "asc" },
  });
}

export async function getUserById(id: string) {
  const user = await db.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      role: true,
      assignments: {
        include: { customer: { select: { id: true, name: true, code: true } } },
      },
      userPermissions: { include: { permission: true } },
    },
  });
  if (!user) throw new NotFoundError("User");
  return user;
}

export async function createUser(input: CreateUserInput, actorId: string) {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError("A user with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await db.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      roleId: input.roleId,
    },
    include: { role: true },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.USER_CREATED,
    entityType: "User",
    entityId: user.id,
    afterValue: { email: user.email, role: user.role.name },
  });

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput, actorId: string) {
  const user = await db.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError("User");

  const updated = await db.user.update({
    where: { id },
    data: input,
    include: { role: true },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.USER_UPDATED,
    entityType: "User",
    entityId: id,
    beforeValue: { email: user.email, isActive: user.isActive },
    afterValue: { email: updated.email, isActive: updated.isActive },
  });

  return updated;
}

export async function deactivateUser(id: string, actorId: string) {
  const user = await db.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw new NotFoundError("User");

  await db.user.update({ where: { id }, data: { isActive: false } });

  await logAction({
    userId: actorId,
    action: AuditAction.USER_DEACTIVATED,
    entityType: "User",
    entityId: id,
  });
}

export async function assignCustomerToUser(
  userId: string,
  customerId: string,
  role: "OWNER" | "MANAGER" | "ANALYST" | "VIEWER",
  actorId: string
) {
  await db.customerAssignment.upsert({
    where: { userId_customerId: { userId, customerId } },
    create: { userId, customerId, assignedById: actorId, role },
    update: { role },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_ASSIGNED,
    entityType: "CustomerAssignment",
    entityId: `${userId}:${customerId}`,
    afterValue: { userId, customerId, role },
  });
}

export async function removeCustomerFromUser(
  userId: string,
  customerId: string,
  actorId: string
) {
  await db.customerAssignment.deleteMany({ where: { userId, customerId } });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_UNASSIGNED,
    entityType: "CustomerAssignment",
    entityId: `${userId}:${customerId}`,
  });
}
