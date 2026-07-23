import { db } from "@/lib/db";

interface AuditLogParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  sourceIp?: string;
  correlationId?: string;
  importBatchId?: string;
  jobId?: string;
}

export async function logAction(params: AuditLogParams): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeValue: params.beforeValue !== undefined
        ? (params.beforeValue as Parameters<typeof db.auditLog.create>[0]["data"]["beforeValue"])
        : undefined,
      afterValue: params.afterValue !== undefined
        ? (params.afterValue as Parameters<typeof db.auditLog.create>[0]["data"]["afterValue"])
        : undefined,
      sourceIp: params.sourceIp ?? null,
      correlationId: params.correlationId ?? null,
      importBatchId: params.importBatchId ?? null,
      jobId: params.jobId ?? null,
    },
  });
}

// Well-known action constants to avoid typos across the codebase
export const AuditAction = {
  USER_LOGIN: "USER_LOGIN",
  USER_LOGIN_FAILED: "USER_LOGIN_FAILED",
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  ROLE_ASSIGNED: "ROLE_ASSIGNED",
  PERMISSION_GRANTED: "PERMISSION_GRANTED",
  CUSTOMER_CREATED: "CUSTOMER_CREATED",
  CUSTOMER_UPDATED: "CUSTOMER_UPDATED",
  CUSTOMER_DELETED: "CUSTOMER_DELETED",
  CUSTOMER_ASSIGNED: "CUSTOMER_ASSIGNED",
  CUSTOMER_UNASSIGNED: "CUSTOMER_UNASSIGNED",
  PRICE_CHANGED: "PRICE_CHANGED",
  COST_CHANGED: "COST_CHANGED",
  ALLOCATION_CHANGED: "ALLOCATION_CHANGED",
  MARGIN_REQUIREMENT_CHANGED: "MARGIN_REQUIREMENT_CHANGED",
  SKU_OVERRIDE_CHANGED: "SKU_OVERRIDE_CHANGED",
  IMPORT_STARTED: "IMPORT_STARTED",
  IMPORT_COMMITTED: "IMPORT_COMMITTED",
  EXPORT_GENERATED: "EXPORT_GENERATED",
  SHIPPING_QUOTE_REQUESTED: "SHIPPING_QUOTE_REQUESTED",
  CALCULATION_TRIGGERED: "CALCULATION_TRIGGERED",
  ALERT_STATUS_CHANGED: "ALERT_STATUS_CHANGED",
  REPORT_GENERATED: "REPORT_GENERATED",
  BACKUP_STARTED: "BACKUP_STARTED",
  CONFIG_CHANGED: "CONFIG_CHANGED",
} as const;
