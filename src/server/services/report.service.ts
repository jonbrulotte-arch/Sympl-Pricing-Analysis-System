import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { Permission } from "@/server/authorization/permissions";
import { getAssignedCustomerIds } from "@/server/authorization/check-customer-access";
import { canViewProductCost } from "@/server/authorization/check-cost-visibility";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { ForbiddenError } from "@/lib/errors";
import { logAction, AuditAction } from "./audit-log.service";

function headerStyle(ws: ExcelJS.Worksheet, cols: number) {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols } };
}

export async function generatePortfolioMarginReport(
  userId: string,
  permissions: string[]
): Promise<Buffer> {
  const hasGlobalAccess = permissions.includes(Permission.GLOBAL_CUSTOMER_ACCESS);
  const showCost = canViewProductCost(permissions);
  const showMargin = permissions.includes(Permission.VIEW_CALCULATED_MARGIN);

  const where: Record<string, unknown> = { deletedAt: null };
  if (!hasGlobalAccess) {
    const assignedIds = await getAssignedCustomerIds(userId);
    where.customerId = { in: assignedIds };
  }

  const skus = await db.customerSku.findMany({
    where,
    orderBy: [{ customer: { name: "asc" } }, { product: { sku: "asc" } }],
    include: {
      customer: { select: { name: true, code: true } },
      product: {
        select: {
          sku: true, name: true, currentCost: true,
          category: { select: { name: true } },
        },
      },
      calculationResults: {
        orderBy: { calculatedAt: "desc" },
        take: 1,
        select: { contributionMarginPercent: true, contributionProfit: true, calculatedAt: true },
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sympl PAS";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Portfolio Margin");

  const cols: Partial<ExcelJS.Column>[] = [
    { header: "Customer", key: "customer", width: 28 },
    { header: "Code", key: "code", width: 10 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Product Name", key: "productName", width: 34 },
    { header: "Category", key: "category", width: 20 },
    { header: "Selling Price", key: "sellingPrice", width: 16, style: { numFmt: "$#,##0.0000" } },
    { header: "Pkg Qty", key: "packageQty", width: 10 },
  ];

  if (showCost) {
    cols.push({ header: "Current Cost", key: "currentCost", width: 16, style: { numFmt: "$#,##0.0000" } });
  }
  if (showMargin) {
    cols.push(
      { header: "Margin %", key: "marginPct", width: 12, style: { numFmt: "0.00%" } },
      { header: "Contribution Profit", key: "contribProfit", width: 20, style: { numFmt: "$#,##0.0000" } }
    );
  }

  cols.push(
    { header: "Alert Status", key: "alertStatus", width: 14 },
    { header: "Review Status", key: "reviewStatus", width: 16 },
    { header: "Last Calculated", key: "lastCalc", width: 20 }
  );

  ws.columns = cols;
  headerStyle(ws, cols.length);

  for (const sku of skus) {
    const calc = sku.calculationResults[0] ?? null;
    const row: Record<string, unknown> = {
      customer: sku.customer.name,
      code: sku.customer.code,
      sku: sku.product.sku,
      productName: sku.product.name,
      category: sku.product.category?.name ?? "",
      sellingPrice: sku.sellingPrice ? Number(sku.sellingPrice) : null,
      packageQty: sku.packageQuantity,
      alertStatus: sku.alertStatus,
      reviewStatus: sku.reviewStatus.replace(/_/g, " "),
      lastCalc: calc ? new Date(calc.calculatedAt).toISOString().split("T")[0] : "",
    };

    if (showCost) {
      row.currentCost = sku.product.currentCost ? Number(sku.product.currentCost) : null;
    }
    if (showMargin && calc) {
      row.marginPct = Number(calc.contributionMarginPercent) / 100;
      row.contribProfit = Number(calc.contributionProfit);
    }

    ws.addRow(row);
  }

  await logAction({
    userId,
    action: AuditAction.REPORT_GENERATED,
    entityType: "Report",
    entityId: "portfolio-margin",
    afterValue: { rowCount: skus.length },
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateAlertSummaryReport(
  userId: string,
  permissions: string[]
): Promise<Buffer> {
  const hasGlobalAccess = permissions.includes(Permission.GLOBAL_CUSTOMER_ACCESS);

  const skuFilter: Record<string, unknown> = {};
  if (!hasGlobalAccess) {
    const assignedIds = await getAssignedCustomerIds(userId);
    skuFilter.customerId = { in: assignedIds };
  }

  const SEVERITY_ORDER = ["CRITICAL", "HIGH", "WARNING", "INFO"] as const;

  const alerts = await db.alert.findMany({
    where: { customerSku: skuFilter },
    orderBy: [{ triggeredAt: "desc" }],
    include: {
      customerSku: {
        select: {
          product: { select: { sku: true, name: true } },
          customer: { select: { name: true, code: true } },
        },
      },
      acknowledgedBy: { select: { firstName: true, lastName: true } },
    },
  });

  // Sort: CRITICAL first, then severity order
  const severityRank = (s: string) => SEVERITY_ORDER.indexOf(s as typeof SEVERITY_ORDER[number]);
  alerts.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sympl PAS";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Alert Summary");
  const cols: Partial<ExcelJS.Column>[] = [
    { header: "Severity", key: "severity", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Alert Type", key: "alertType", width: 24 },
    { header: "Customer", key: "customer", width: 28 },
    { header: "Code", key: "code", width: 10 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Product", key: "product", width: 30 },
    { header: "Message", key: "message", width: 50 },
    { header: "Triggered At", key: "triggeredAt", width: 20 },
    { header: "Acknowledged By", key: "ackedBy", width: 22 },
    { header: "Acknowledged At", key: "ackedAt", width: 20 },
  ];
  ws.columns = cols;
  headerStyle(ws, cols.length);

  for (const alert of alerts) {
    ws.addRow({
      severity: alert.severity,
      status: alert.status,
      alertType: alert.alertType.replace(/_/g, " "),
      customer: alert.customerSku.customer.name,
      code: alert.customerSku.customer.code,
      sku: alert.customerSku.product.sku,
      product: alert.customerSku.product.name,
      message: alert.message ?? "",
      triggeredAt: new Date(alert.triggeredAt).toISOString().replace("T", " ").slice(0, 19),
      ackedBy: alert.acknowledgedBy
        ? `${alert.acknowledgedBy.firstName} ${alert.acknowledgedBy.lastName}`
        : "",
      ackedAt: alert.acknowledgedAt
        ? new Date(alert.acknowledgedAt).toISOString().replace("T", " ").slice(0, 19)
        : "",
    });
  }

  await logAction({
    userId,
    action: AuditAction.REPORT_GENERATED,
    entityType: "Report",
    entityId: "alert-summary",
    afterValue: { rowCount: alerts.length },
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generatePriceHistoryReport(
  customerId: string,
  userId: string,
  permissions: string[]
): Promise<Buffer> {
  const hasAccess = await checkCustomerAccess(userId, customerId, permissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const rows = await db.customerPriceHistory.findMany({
    where: { customerSku: { customerId } },
    orderBy: { createdAt: "desc" },
    include: {
      customerSku: {
        select: {
          product: { select: { sku: true, name: true } },
          customer: { select: { name: true, code: true } },
        },
      },
      recordedBy: { select: { firstName: true, lastName: true } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sympl PAS";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Price History");
  const cols: Partial<ExcelJS.Column>[] = [
    { header: "Customer", key: "customer", width: 28 },
    { header: "Code", key: "code", width: 10 },
    { header: "SKU", key: "sku", width: 18 },
    { header: "Product Name", key: "product", width: 34 },
    { header: "Selling Price", key: "sellingPrice", width: 16, style: { numFmt: "$#,##0.0000" } },
    { header: "Effective Date", key: "effectiveDate", width: 16 },
    { header: "Recorded By", key: "recordedBy", width: 22 },
    { header: "Recorded At", key: "recordedAt", width: 20 },
  ];
  ws.columns = cols;
  headerStyle(ws, cols.length);

  for (const row of rows) {
    ws.addRow({
      customer: row.customerSku.customer.name,
      code: row.customerSku.customer.code,
      sku: row.customerSku.product.sku,
      product: row.customerSku.product.name,
      sellingPrice: Number(row.sellingPrice),
      effectiveDate: new Date(row.effectiveDate).toISOString().split("T")[0],
      recordedBy: `${row.recordedBy.firstName} ${row.recordedBy.lastName}`,
      recordedAt: new Date(row.createdAt).toISOString().replace("T", " ").slice(0, 19),
    });
  }

  await logAction({
    userId,
    action: AuditAction.REPORT_GENERATED,
    entityType: "Report",
    entityId: `price-history:${customerId}`,
    afterValue: { customerId, rowCount: rows.length },
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
