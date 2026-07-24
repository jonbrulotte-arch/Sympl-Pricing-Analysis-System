import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { checkCustomerAccess, getAssignedCustomerIds } from "@/server/authorization/check-customer-access";
import { Permission } from "@/server/authorization/permissions";
import { logAction, AuditAction } from "./audit-log.service";
import type { AlertType, AlertSeverity } from "@/generated/prisma/client";

const MARGIN_ALERT_TYPES = new Set<AlertType>([
  "BELOW_CRITICAL_MARGIN",
  "BELOW_MINIMUM_MARGIN",
  "BELOW_WARNING_MARGIN",
  "NEGATIVE_PROFIT",
]);

/**
 * Creates a new OPEN alert or updates triggeredAt if one already exists.
 * Deduplication: if OPEN alert of same type+sku exists, skip creation.
 * If RESOLVED/SUPPRESSED exists, create a new OPEN one (condition recurred).
 */
export async function createOrUpdateAlert(
  customerSkuId: string,
  alertType: AlertType,
  severity: AlertSeverity,
  message?: string
): Promise<void> {
  const existing = await db.alert.findFirst({
    where: {
      customerSkuId,
      alertType,
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
  });

  if (existing) {
    // Update triggeredAt to indicate condition still active
    await db.alert.update({
      where: { id: existing.id },
      data: { triggeredAt: new Date() },
    });
    return;
  }

  const alert = await db.alert.create({
    data: {
      customerSkuId,
      alertType,
      severity,
      status: "OPEN",
      message: message ?? null,
      triggeredAt: new Date(),
    },
  });

  await db.alertHistory.create({
    data: {
      alertId: alert.id,
      fromStatus: null,
      toStatus: "OPEN",
      note: message ?? null,
    },
  });

  await logAction({
    action: AuditAction.ALERT_CREATED,
    entityType: "Alert",
    entityId: alert.id,
    afterValue: { customerSkuId, alertType, severity },
  });
}

/**
 * Auto-resolves OPEN/ACKNOWLEDGED margin alerts when recalculation returns OK.
 * SUPPRESSED alerts are NOT auto-resolved.
 */
export async function autoResolveMarginAlerts(customerSkuId: string): Promise<void> {
  const alertsToResolve = await db.alert.findMany({
    where: {
      customerSkuId,
      alertType: { in: Array.from(MARGIN_ALERT_TYPES) },
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
    },
  });

  for (const alert of alertsToResolve) {
    await db.alert.update({
      where: { id: alert.id },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: null },
    });

    await db.alertHistory.create({
      data: {
        alertId: alert.id,
        fromStatus: alert.status,
        toStatus: "RESOLVED",
        note: "Auto-resolved: margin returned to OK",
      },
    });
  }
}

export async function listAlerts(
  customerId: string,
  skuId: string,
  userId: string,
  userPermissions: string[]
) {
  if (!userPermissions.includes(Permission.VIEW_ALERTS)) {
    throw new ForbiddenError("view_alerts permission required");
  }

  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  return db.alert.findMany({
    where: { customerSkuId: skuId },
    orderBy: [{ status: "asc" }, { triggeredAt: "desc" }],
    include: {
      history: { orderBy: { createdAt: "asc" }, include: { changedBy: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
}

export async function acknowledgeAlert(
  alertId: string,
  customerId: string,
  userId: string,
  userPermissions: string[],
  note?: string
) {
  if (!userPermissions.includes(Permission.MANAGE_ALERTS)) {
    throw new ForbiddenError("manage_alerts permission required");
  }

  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const alert = await db.alert.findUnique({ where: { id: alertId } });
  if (!alert) throw new NotFoundError("Alert");
  if (alert.status !== "OPEN") {
    throw new Error(`Alert is already ${alert.status}`);
  }

  await db.alert.update({
    where: { id: alertId },
    data: { status: "ACKNOWLEDGED", acknowledgedAt: new Date(), acknowledgedById: userId },
  });

  await db.alertHistory.create({
    data: { alertId, fromStatus: "OPEN", toStatus: "ACKNOWLEDGED", changedById: userId, note: note ?? null },
  });

  await logAction({
    userId,
    action: AuditAction.ALERT_STATUS_CHANGED,
    entityType: "Alert",
    entityId: alertId,
    beforeValue: { status: "OPEN" },
    afterValue: { status: "ACKNOWLEDGED" },
  });
}

export async function suppressAlert(
  alertId: string,
  customerId: string,
  userId: string,
  userPermissions: string[],
  reason: string
) {
  if (!userPermissions.includes(Permission.MANAGE_ALERTS)) {
    throw new ForbiddenError("manage_alerts permission required");
  }

  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const alert = await db.alert.findUnique({ where: { id: alertId } });
  if (!alert) throw new NotFoundError("Alert");
  if (alert.status !== "OPEN") {
    throw new Error(`Alert must be OPEN to suppress`);
  }

  await db.alert.update({
    where: { id: alertId },
    data: { status: "SUPPRESSED", suppressedAt: new Date(), suppressedById: userId, suppressedReason: reason },
  });

  await db.alertHistory.create({
    data: { alertId, fromStatus: "OPEN", toStatus: "SUPPRESSED", changedById: userId, note: reason },
  });

  await logAction({
    userId,
    action: AuditAction.ALERT_STATUS_CHANGED,
    entityType: "Alert",
    entityId: alertId,
    beforeValue: { status: "OPEN" },
    afterValue: { status: "SUPPRESSED", reason },
  });
}

export async function resolveAlert(
  alertId: string,
  customerId: string,
  userId: string,
  userPermissions: string[],
  note?: string
) {
  if (!userPermissions.includes(Permission.MANAGE_ALERTS)) {
    throw new ForbiddenError("manage_alerts permission required");
  }

  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const alert = await db.alert.findUnique({ where: { id: alertId } });
  if (!alert) throw new NotFoundError("Alert");
  if (alert.status === "RESOLVED") {
    throw new Error("Alert is already resolved");
  }

  await db.alert.update({
    where: { id: alertId },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId },
  });

  await db.alertHistory.create({
    data: { alertId, fromStatus: alert.status, toStatus: "RESOLVED", changedById: userId, note: note ?? null },
  });

  await logAction({
    userId,
    action: AuditAction.ALERT_STATUS_CHANGED,
    entityType: "Alert",
    entityId: alertId,
    beforeValue: { status: alert.status },
    afterValue: { status: "RESOLVED" },
  });
}

export interface GlobalAlertParams {
  page: number;
  pageSize: number;
  severity?: string;
  status?: string;
  alertType?: string;
  customerId?: string;
}

export async function listGlobalAlerts(
  userId: string,
  userPermissions: string[],
  params: GlobalAlertParams
) {
  if (!userPermissions.includes(Permission.VIEW_ALERTS)) {
    throw new ForbiddenError("view_alerts permission required");
  }

  const { page, pageSize, severity, status, alertType, customerId } = params;

  const where: Record<string, unknown> = {};

  if (!userPermissions.includes(Permission.GLOBAL_CUSTOMER_ACCESS)) {
    const assignedIds = await getAssignedCustomerIds(userId);
    where.customerSku = { customerId: { in: assignedIds } };
  }

  if (severity) where.severity = severity;
  if (status) where.status = status;
  if (alertType) where.alertType = alertType;
  if (customerId) {
    where.customerSku = { ...(where.customerSku as object ?? {}), customerId };
  }

  const [alerts, total] = await Promise.all([
    db.alert.findMany({
      where,
      orderBy: [{ severity: "asc" }, { triggeredAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customerSku: {
          select: {
            id: true,
            customer: { select: { id: true, name: true, code: true } },
            product: { select: { sku: true, name: true } },
          },
        },
        history: {
          orderBy: { createdAt: "asc" },
          include: { changedBy: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    }),
    db.alert.count({ where }),
  ]);

  return { data: alerts, total, page, pageSize };
}

export async function getAlertWithAccess(
  alertId: string,
  userId: string,
  userPermissions: string[]
) {
  const alert = await db.alert.findUnique({
    where: { id: alertId },
    include: { customerSku: { select: { customerId: true } } },
  });
  if (!alert) throw new NotFoundError("Alert");

  const hasAccess = await checkCustomerAccess(userId, alert.customerSku.customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  return alert;
}
