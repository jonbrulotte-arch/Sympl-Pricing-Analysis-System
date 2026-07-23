import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { logAction, AuditAction } from "./audit-log.service";
import type { CreateContactInput, UpdateContactInput } from "@/server/validation/customer-contact.schema";

export async function listContacts(customerId: string, userId: string, userPermissions: string[]) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  return db.customerContact.findMany({
    where: { customerId },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });
}

export async function createContact(
  customerId: string,
  input: CreateContactInput,
  userId: string,
  userPermissions: string[],
  actorId: string
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const contact = await db.customerContact.create({
    data: {
      customerId,
      name: input.name,
      title: input.title ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      isPrimary: input.isPrimary ?? false,
    },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_UPDATED,
    entityType: "CustomerContact",
    entityId: contact.id,
    afterValue: { customerId, name: contact.name },
  });

  return contact;
}

export async function updateContact(
  customerId: string,
  contactId: string,
  input: UpdateContactInput,
  userId: string,
  userPermissions: string[],
  actorId: string
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const existing = await db.customerContact.findFirst({ where: { id: contactId, customerId } });
  if (!existing) throw new NotFoundError("CustomerContact");

  const updated = await db.customerContact.update({
    where: { id: contactId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
    },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_UPDATED,
    entityType: "CustomerContact",
    entityId: contactId,
    beforeValue: { name: existing.name },
    afterValue: { name: updated.name },
  });

  return updated;
}

export async function deleteContact(
  customerId: string,
  contactId: string,
  userId: string,
  userPermissions: string[],
  actorId: string
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const existing = await db.customerContact.findFirst({ where: { id: contactId, customerId } });
  if (!existing) throw new NotFoundError("CustomerContact");

  await db.customerContact.delete({ where: { id: contactId } });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_UPDATED,
    entityType: "CustomerContact",
    entityId: contactId,
    beforeValue: { name: existing.name },
  });
}
