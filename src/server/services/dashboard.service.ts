import { db } from "@/lib/db";
import { Permission } from "@/server/authorization/permissions";
import { getAssignedCustomerIds } from "@/server/authorization/check-customer-access";
import type { AlertLifecycleStatus, AlertSeverity } from "@/generated/prisma/client";

export interface DashboardStats {
  totalCustomers: number;
  totalSkus: number;
  skusByAlertStatus: { OK: number; WARNING: number; HIGH: number; CRITICAL: number };
  openAlerts: { CRITICAL: number; HIGH: number; WARNING: number; INFO: number };
  averageMargin: number | null;
  recentCriticalAlerts: {
    id: string;
    alertType: string;
    severity: string;
    message: string | null;
    triggeredAt: string;
    customerName: string;
    productSku: string;
  }[];
}

export async function getDashboardStats(
  userId: string,
  permissions: string[]
): Promise<DashboardStats> {
  const hasGlobalAccess = permissions.includes(Permission.GLOBAL_CUSTOMER_ACCESS);

  let customerFilter: { id?: { in: string[] } } = {};
  let skuFilter: { deletedAt: null; customerId?: { in: string[] } } = { deletedAt: null };
  const alertStatus: AlertLifecycleStatus = "OPEN";
  let alertSkuFilter: { customerId: { in: string[] } } | undefined;

  if (!hasGlobalAccess) {
    const assignedIds = await getAssignedCustomerIds(userId);
    customerFilter = { id: { in: assignedIds } };
    skuFilter = { deletedAt: null, customerId: { in: assignedIds } };
    alertSkuFilter = { customerId: { in: assignedIds } };
  }

  const alertWhere = (severity: AlertSeverity) => ({
    status: alertStatus,
    severity,
    ...(alertSkuFilter ? { customerSku: alertSkuFilter } : {}),
  });

  const recentAlertWhere = {
    status: alertStatus,
    severity: { in: ["CRITICAL", "HIGH"] as AlertSeverity[] },
    ...(alertSkuFilter ? { customerSku: alertSkuFilter } : {}),
  };

  const [
    totalCustomers,
    totalSkus,
    okCount,
    warningCount,
    highCount,
    criticalCount,
    criticalAlertCount,
    highAlertCount,
    warningAlertCount,
    infoAlertCount,
    avgCalc,
    recentAlerts,
  ] = await Promise.all([
    db.customer.count({ where: { deletedAt: null, ...customerFilter } }),
    db.customerSku.count({ where: skuFilter }),
    db.customerSku.count({ where: { ...skuFilter, alertStatus: "OK" } }),
    db.customerSku.count({ where: { ...skuFilter, alertStatus: "WARNING" } }),
    db.customerSku.count({ where: { ...skuFilter, alertStatus: "HIGH" } }),
    db.customerSku.count({ where: { ...skuFilter, alertStatus: "CRITICAL" } }),
    db.alert.count({ where: alertWhere("CRITICAL") }),
    db.alert.count({ where: alertWhere("HIGH") }),
    db.alert.count({ where: alertWhere("WARNING") }),
    db.alert.count({ where: alertWhere("INFO") }),
    db.calculationResult.aggregate({
      _avg: { contributionMarginPercent: true },
      where: hasGlobalAccess
        ? {}
        : { customerSku: { customerId: { in: (customerFilter.id as { in: string[] })?.in ?? [] } } },
    }),
    db.alert.findMany({
      where: recentAlertWhere,
      orderBy: { triggeredAt: "desc" },
      take: 10,
      include: {
        customerSku: {
          select: {
            customer: { select: { name: true } },
            product: { select: { sku: true } },
          },
        },
      },
    }),
  ]);

  return {
    totalCustomers,
    totalSkus,
    skusByAlertStatus: {
      OK: okCount,
      WARNING: warningCount,
      HIGH: highCount,
      CRITICAL: criticalCount,
    },
    openAlerts: {
      CRITICAL: criticalAlertCount,
      HIGH: highAlertCount,
      WARNING: warningAlertCount,
      INFO: infoAlertCount,
    },
    averageMargin: avgCalc._avg.contributionMarginPercent
      ? Number(avgCalc._avg.contributionMarginPercent)
      : null,
    recentCriticalAlerts: recentAlerts.map((a) => ({
      id: a.id,
      alertType: a.alertType,
      severity: a.severity,
      message: a.message,
      triggeredAt: a.triggeredAt.toISOString(),
      customerName: a.customerSku.customer.name,
      productSku: a.customerSku.product.sku,
    })),
  };
}
