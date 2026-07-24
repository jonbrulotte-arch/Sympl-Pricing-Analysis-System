import { db } from "@/lib/db";
import { Permission } from "@/server/authorization/permissions";
import { getAssignedCustomerIds } from "@/server/authorization/check-customer-access";
import {
  canViewProductCost,
  canViewShippingCost,
} from "@/server/authorization/check-cost-visibility";
import type { RoiGridQuery } from "@/server/validation/roi.schema";

export interface RoiGridRow {
  id: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  productId: string;
  productSku: string;
  productName: string;
  categoryName: string | null;
  customerSkuCode: string | null;
  sellingPrice: number | null;
  currentCost?: number | null;
  packageQuantity: number;
  alertStatus: string;
  reviewStatus: string;
  assignedAnalystId: string | null;
  assignedAnalystName: string | null;
  lastCalculatedAt: string | null;
  lastQuotedAt: string | null;
  contributionMarginPercent?: number | null;
  contributionProfit?: number | null;
  netRevenue?: number | null;
  totalVariableCost?: number | null;
  shippingCost?: number | null;
}

export interface RoiGridResult {
  data: RoiGridRow[];
  total: number;
  page: number;
  pageSize: number;
}

const SORT_FIELD_MAP: Record<string, string> = {
  customerName: "customer.name",
  productSku: "product.sku",
  productName: "product.name",
  sellingPrice: "sellingPrice",
  currentCost: "product.currentCost",
  alertStatus: "alertStatus",
  reviewStatus: "reviewStatus",
  lastCalculatedAt: "lastCalculatedAt",
};

export async function getRoiGridData(
  userId: string,
  permissions: string[],
  params: RoiGridQuery
): Promise<RoiGridResult> {
  const { page, pageSize, sortBy, sortDir, search, customerId, alertStatus, reviewStatus, categoryId } = params;

  const where: Record<string, unknown> = { deletedAt: null };

  if (!permissions.includes(Permission.GLOBAL_CUSTOMER_ACCESS)) {
    const assignedIds = await getAssignedCustomerIds(userId);
    where.customerId = { in: assignedIds };
  }

  if (customerId) where.customerId = customerId;
  if (alertStatus) where.alertStatus = alertStatus;
  if (reviewStatus) where.reviewStatus = reviewStatus;
  if (categoryId) where.product = { categoryId };

  if (search) {
    where.OR = [
      { product: { name: { contains: search, mode: "insensitive" } } },
      { product: { sku: { contains: search, mode: "insensitive" } } },
      { customer: { name: { contains: search, mode: "insensitive" } } },
      { customerSkuCode: { contains: search, mode: "insensitive" } },
    ];
  }

  let orderBy: Record<string, unknown>;
  if (sortBy === "customerName") {
    orderBy = { customer: { name: sortDir } };
  } else if (sortBy === "productSku") {
    orderBy = { product: { sku: sortDir } };
  } else if (sortBy === "productName") {
    orderBy = { product: { name: sortDir } };
  } else if (sortBy === "currentCost") {
    orderBy = { product: { currentCost: sortDir } };
  } else {
    orderBy = { [sortBy]: sortDir };
  }

  const [skus, total] = await Promise.all([
    db.customerSku.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true, code: true } },
        product: { select: { id: true, sku: true, name: true, currentCost: true, category: { select: { name: true } } } },
        assignedAnalyst: { select: { id: true, firstName: true, lastName: true } },
        calculationResults: {
          orderBy: { calculatedAt: "desc" },
          take: 1,
          select: {
            contributionMarginPercent: true,
            contributionProfit: true,
            netRevenue: true,
            totalVariableCost: true,
          },
        },
      },
    }),
    db.customerSku.count({ where }),
  ]);

  const showCost = canViewProductCost(permissions);
  const showMargin = permissions.includes(Permission.VIEW_CALCULATED_MARGIN);
  const showShipping = canViewShippingCost(permissions);

  const data: RoiGridRow[] = skus.map((sku) => {
    const calc = sku.calculationResults[0] ?? null;
    const analyst = sku.assignedAnalyst;

    const row: RoiGridRow = {
      id: sku.id,
      customerId: sku.customer.id,
      customerName: sku.customer.name,
      customerCode: sku.customer.code,
      productId: sku.product.id,
      productSku: sku.product.sku,
      productName: sku.product.name,
      categoryName: sku.product.category?.name ?? null,
      customerSkuCode: sku.customerSkuCode,
      sellingPrice: sku.sellingPrice ? Number(sku.sellingPrice) : null,
      packageQuantity: sku.packageQuantity,
      alertStatus: sku.alertStatus,
      reviewStatus: sku.reviewStatus,
      assignedAnalystId: analyst?.id ?? null,
      assignedAnalystName: analyst ? `${analyst.firstName} ${analyst.lastName}` : null,
      lastCalculatedAt: sku.lastCalculatedAt?.toISOString() ?? null,
      lastQuotedAt: sku.lastQuotedAt?.toISOString() ?? null,
    };

    if (showCost) {
      row.currentCost = sku.product.currentCost ? Number(sku.product.currentCost) : null;
    }

    if (showMargin && calc) {
      row.contributionMarginPercent = Number(calc.contributionMarginPercent);
      row.contributionProfit = Number(calc.contributionProfit);
      row.netRevenue = Number(calc.netRevenue);
      row.totalVariableCost = Number(calc.totalVariableCost);
    }

    return row;
  });

  return { data, total, page, pageSize };
}
