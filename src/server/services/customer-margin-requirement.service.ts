import { db } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { logAction, AuditAction } from "./audit-log.service";
import type { UpsertMarginRequirementInput } from "@/server/validation/customer-margin-requirement.schema";

export async function getMarginRequirement(
  customerId: string,
  userId: string,
  userPermissions: string[]
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  return db.customerMarginRequirement.findUnique({ where: { customerId } });
}

export async function upsertMarginRequirement(
  customerId: string,
  input: UpsertMarginRequirementInput,
  userId: string,
  userPermissions: string[],
  actorId: string
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const existing = await db.customerMarginRequirement.findUnique({ where: { customerId } });

  const record = await db.customerMarginRequirement.upsert({
    where: { customerId },
    create: {
      customerId,
      minimumMarginPercent: input.minimumMarginPercent,
      warningThresholdPercent: input.warningThresholdPercent,
      criticalThresholdPercent: input.criticalThresholdPercent,
      calculationMethod: input.calculationMethod ?? "CONTRIBUTION_MARGIN",
      notes: input.notes ?? null,
    },
    update: {
      minimumMarginPercent: input.minimumMarginPercent,
      warningThresholdPercent: input.warningThresholdPercent,
      criticalThresholdPercent: input.criticalThresholdPercent,
      calculationMethod: input.calculationMethod ?? "CONTRIBUTION_MARGIN",
      notes: input.notes ?? null,
    },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.MARGIN_REQUIREMENT_CHANGED,
    entityType: "CustomerMarginRequirement",
    entityId: record.id,
    beforeValue: existing
      ? {
          minimumMarginPercent: existing.minimumMarginPercent?.toString(),
          warningThresholdPercent: existing.warningThresholdPercent?.toString(),
        }
      : null,
    afterValue: {
      minimumMarginPercent: input.minimumMarginPercent,
      warningThresholdPercent: input.warningThresholdPercent,
      criticalThresholdPercent: input.criticalThresholdPercent,
    },
  });

  return record;
}
