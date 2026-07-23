import { db } from "@/lib/db";
import { logAction, AuditAction } from "./audit-log.service";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { checkCustomerAccess, getAssignedCustomerIds } from "@/server/authorization/check-customer-access";
import { Permission } from "@/server/authorization/permissions";
import type { CreateCustomerInput, UpdateCustomerInput } from "@/server/validation/customer.schema";

export async function listCustomers(userId: string, userPermissions: string[]) {
  const hasGlobalAccess = userPermissions.includes(Permission.GLOBAL_CUSTOMER_ACCESS);

  if (hasGlobalAccess) {
    return db.customer.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
  }

  const assignedIds = await getAssignedCustomerIds(userId);
  return db.customer.findMany({
    where: { id: { in: assignedIds }, deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function getCustomerById(
  id: string,
  userId: string,
  userPermissions: string[]
) {
  const allowed = await checkCustomerAccess(userId, id, userPermissions);
  if (!allowed) throw new ForbiddenError("You do not have access to this customer");

  const customer = await db.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      assignments: {
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
  });
  if (!customer) throw new NotFoundError("Customer");
  return customer;
}

export async function createCustomer(input: CreateCustomerInput, actorId: string) {
  const existing = await db.customer.findUnique({ where: { code: input.code } });
  if (existing) throw new ConflictError("A customer with this code already exists");

  const customer = await db.customer.create({ data: input });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_CREATED,
    entityType: "Customer",
    entityId: customer.id,
    afterValue: { name: customer.name, code: customer.code },
  });

  return customer;
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
  userId: string,
  userPermissions: string[],
  actorId: string
) {
  const allowed = await checkCustomerAccess(userId, id, userPermissions);
  if (!allowed) throw new ForbiddenError("You do not have access to this customer");

  const existing = await db.customer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Customer");

  const customer = await db.customer.update({ where: { id }, data: input });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_UPDATED,
    entityType: "Customer",
    entityId: id,
    beforeValue: { name: existing.name, status: existing.status },
    afterValue: { name: customer.name, status: customer.status },
  });

  return customer;
}

export async function deleteCustomer(id: string, actorId: string) {
  const existing = await db.customer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Customer");

  await db.customer.update({ where: { id }, data: { deletedAt: new Date() } });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_DELETED,
    entityType: "Customer",
    entityId: id,
  });
}
