import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { logAction, AuditAction } from "./audit-log.service";
import type { CreateAllocationInput, UpdateAllocationInput } from "@/server/validation/customer-allocation.schema";

export async function listAllocations(customerId: string, userId: string, userPermissions: string[]) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  return db.customerAllocation.findMany({
    where: { customerId, isActive: true },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
  });
}

export async function createAllocation(
  customerId: string,
  input: CreateAllocationInput,
  userId: string,
  userPermissions: string[],
  actorId: string
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const allocation = await db.customerAllocation.create({
    data: {
      customerId,
      name: input.name,
      description: input.description ?? null,
      calculationType: input.calculationType,
      rate: input.rate ?? null,
      amount: input.amount ?? null,
      priority: input.priority ?? 0,
      isActive: input.isActive ?? true,
      isIncludedInMargin: input.isIncludedInMargin ?? true,
      effectiveDate: new Date(input.effectiveDate),
      expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
      notes: input.notes ?? null,
    },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.ALLOCATION_CHANGED,
    entityType: "CustomerAllocation",
    entityId: allocation.id,
    afterValue: { customerId, name: allocation.name, calculationType: allocation.calculationType },
  });

  return allocation;
}

export async function updateAllocation(
  customerId: string,
  allocId: string,
  input: UpdateAllocationInput,
  userId: string,
  userPermissions: string[],
  actorId: string
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const existing = await db.customerAllocation.findFirst({ where: { id: allocId, customerId } });
  if (!existing) throw new NotFoundError("CustomerAllocation");

  const updated = await db.customerAllocation.update({
    where: { id: allocId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.calculationType !== undefined && { calculationType: input.calculationType }),
      ...(input.rate !== undefined && { rate: input.rate }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.isIncludedInMargin !== undefined && { isIncludedInMargin: input.isIncludedInMargin }),
      ...(input.effectiveDate !== undefined && { effectiveDate: new Date(input.effectiveDate) }),
      ...(input.expirationDate !== undefined && {
        expirationDate: input.expirationDate ? new Date(input.expirationDate) : null,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.ALLOCATION_CHANGED,
    entityType: "CustomerAllocation",
    entityId: allocId,
    beforeValue: { name: existing.name, isActive: existing.isActive },
    afterValue: { name: updated.name, isActive: updated.isActive },
  });

  return updated;
}

export async function deleteAllocation(
  customerId: string,
  allocId: string,
  userId: string,
  userPermissions: string[],
  actorId: string
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const existing = await db.customerAllocation.findFirst({ where: { id: allocId, customerId } });
  if (!existing) throw new NotFoundError("CustomerAllocation");

  await db.customerAllocation.delete({ where: { id: allocId } });

  await logAction({
    userId: actorId,
    action: AuditAction.ALLOCATION_CHANGED,
    entityType: "CustomerAllocation",
    entityId: allocId,
    beforeValue: { name: existing.name },
  });
}
