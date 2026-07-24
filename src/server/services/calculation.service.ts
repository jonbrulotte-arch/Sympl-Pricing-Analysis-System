import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { logAction, AuditAction } from "./audit-log.service";
import { createOrUpdateAlert, autoResolveMarginAlerts } from "./alert.service";
import { getSelectedQuote } from "./shipping/shipping.service";
import { getDunnagePercent } from "./shipping/dunnage.service";
import { resolveDimensions } from "./shipping/dimension-resolver";
import type { AlertType, AlertSeverity } from "@/generated/prisma/client";

export const ENGINE_VERSION = "1.1.0";

interface AllocationInput {
  name: string;
  type: string;
  rate: string | null;
  amount: string | null;
  computedAmount: number;
}

interface CalculationTrace {
  engineVersion: string;
  calculatedAt: string;
  initiatedBy: string;
  inputs: {
    sellingPrice: string | null;
    productCost: string | null;
    shippingCost: string;
    shippingQuoteId: string | null;
    allocations: AllocationInput[];
    shippingTerms: string;
    packageQuantity: number;
  };
  intermediates: {
    revenueBasedAllowances: string;
    netRevenue: string;
    totalVariableCost: string;
    contributionProfit: string;
  };
  outputs: {
    contributionMarginPercent: string;
    requiredMinimumMargin: string;
    varianceFromRequired: string;
    alertStatus: string;
  };
  appliedOverrides: string[];
  dataQuality: {
    missingSellingPrice: boolean;
    missingProductCost: boolean;
    dimensionSource: string;
    dunnageApplied: boolean;
  };
}

export type CalculationOutput = {
  contributionMarginPercent: number;
  contributionProfit: number;
  netRevenue: number;
  totalVariableCost: number;
  alertStatus: "OK" | "WARNING" | "HIGH" | "CRITICAL";
  trace: CalculationTrace;
};

/**
 * Returns today's UTC date for allocation effective-date comparisons.
 */
function today(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function calculateCustomerSku(
  customerSkuId: string,
  initiatedBy: string
): Promise<CalculationOutput> {
  const sku = await db.customerSku.findUnique({
    where: { id: customerSkuId },
    include: {
      product: { include: { category: true } },
      customer: {
        include: {
          allocations: {
            where: {
              isActive: true,
              effectiveDate: { lte: today() },
            },
            orderBy: { priority: "asc" },
          },
          marginRequirement: true,
        },
      },
    },
  });

  if (!sku) throw new NotFoundError("CustomerSku");

  const now = new Date();
  const appliedOverrides: string[] = [];

  // ── Inputs ──────────────────────────────────────────────────────────────

  const sellingPrice = sku.sellingPrice != null ? Number(sku.sellingPrice) : null;
  const productCost = sku.product.currentCost != null ? Number(sku.product.currentCost) : null;
  const packageQty = sku.packageQuantity ?? 1;

  // Shipping terms: SKU override wins over customer default
  const effectiveShippingTerms = sku.shippingTermsOverride ?? sku.customer.shippingTerms;

  // Resolve shipping cost from cached quote
  let shippingCost = 0;
  let shippingQuoteId: string | null = null;
  let dimensionSource: string = "NONE";
  let dunnageApplied = false;

  const selectedQuote = await getSelectedQuote(customerSkuId);
  if (selectedQuote) {
    shippingCost = selectedQuote.rateAmount;
    shippingQuoteId = selectedQuote.id;
    dimensionSource = selectedQuote.dimensionSource;
    dunnageApplied = selectedQuote.dunnageApplied;
  } else {
    const categoryDunnagePercent = sku.product.categoryId
      ? await getDunnagePercent(sku.product.categoryId)
      : await getDunnagePercent(null);
    const productDims = {
      length: sku.product.length ? Number(sku.product.length) : null,
      width: sku.product.width ? Number(sku.product.width) : null,
      height: sku.product.height ? Number(sku.product.height) : null,
      weight: sku.product.weight ? Number(sku.product.weight) : null,
      shippingLength: sku.product.shippingLength ? Number(sku.product.shippingLength) : null,
      shippingWidth: sku.product.shippingWidth ? Number(sku.product.shippingWidth) : null,
      shippingHeight: sku.product.shippingHeight ? Number(sku.product.shippingHeight) : null,
      shippingWeight: sku.product.shippingWeight ? Number(sku.product.shippingWeight) : null,
    };
    const resolved = resolveDimensions(productDims, sku.useShippingDimensions, categoryDunnagePercent);
    dimensionSource = resolved.source;
    dunnageApplied = resolved.dunnageApplied;
  }

  // Filter expired allocations
  const activeAllocations = sku.customer.allocations.filter((a) => {
    if (a.expirationDate && a.expirationDate <= today()) return false;
    return true;
  });

  // ── Data quality checks ──────────────────────────────────────────────────

  const missingSellingPrice = sellingPrice == null;
  const missingProductCost = productCost == null;

  // ── Revenue-based allowances (reduce net revenue) ────────────────────────

  const revenueAllocationTypes = new Set([
    "PERCENT_OF_SELLING_PRICE",
    "PERCENT_OF_NET_REVENUE",
  ]);

  const allocationInputs: AllocationInput[] = [];
  let revenueBasedAllowances = 0;

  for (const alloc of activeAllocations) {
    let computedAmount = 0;

    if (alloc.calculationType === "PERCENT_OF_SELLING_PRICE" && sellingPrice != null) {
      computedAmount = Number(alloc.rate ?? 0) * sellingPrice;
    } else if (alloc.calculationType === "PERCENT_OF_NET_REVENUE") {
      // Placeholder: net revenue not yet known; will be resolved in second pass
      // For simplicity and correctness, treat PERCENT_OF_NET_REVENUE as 0 in first pass
      // (circular dependency — same approach as most pricing engines)
      computedAmount = 0;
    }

    if (revenueAllocationTypes.has(alloc.calculationType)) {
      revenueBasedAllowances += computedAmount;
    }

    allocationInputs.push({
      name: alloc.name,
      type: alloc.calculationType,
      rate: alloc.rate?.toString() ?? null,
      amount: alloc.amount?.toString() ?? null,
      computedAmount,
    });
  }

  const netRevenue = sellingPrice != null ? sellingPrice - revenueBasedAllowances : 0;

  // Second pass: PERCENT_OF_NET_REVENUE now that we have netRevenue
  for (let i = 0; i < activeAllocations.length; i++) {
    const alloc = activeAllocations[i];
    if (alloc.calculationType === "PERCENT_OF_NET_REVENUE" && netRevenue > 0) {
      const computedAmount = Number(alloc.rate ?? 0) * netRevenue;
      allocationInputs[i].computedAmount = computedAmount;
      revenueBasedAllowances += computedAmount;
    }
  }

  const finalNetRevenue = sellingPrice != null ? sellingPrice - revenueBasedAllowances : 0;

  // ── Variable costs ───────────────────────────────────────────────────────

  let totalVariableCost = 0;

  // Product cost
  if (productCost != null) {
    totalVariableCost += productCost;
  }

  // Seller-paid shipping
  if (effectiveShippingTerms === "PREPAID") {
    totalVariableCost += shippingCost;
  }

  // Allocation-based costs (non-revenue-reducing)
  for (let i = 0; i < activeAllocations.length; i++) {
    const alloc = activeAllocations[i];
    let costAmount = 0;

    switch (alloc.calculationType) {
      case "PERCENT_OF_COST":
        costAmount = productCost != null ? Number(alloc.rate ?? 0) * productCost : 0;
        break;
      case "FIXED_PER_UNIT":
        costAmount = Number(alloc.amount ?? 0) * packageQty;
        break;
      case "FIXED_PER_ORDER":
      case "FIXED_PER_SHIPMENT":
      case "FIXED_PER_SKU":
        costAmount = Number(alloc.amount ?? 0);
        break;
      default:
        break;
    }

    if (!revenueAllocationTypes.has(alloc.calculationType)) {
      totalVariableCost += costAmount;
      allocationInputs[i].computedAmount = costAmount;
    }
  }

  // ── Profit & margin ──────────────────────────────────────────────────────

  const contributionProfit = finalNetRevenue - totalVariableCost;

  // Precedence: SKU override > customer margin requirement
  let requiredMinimumMargin = 35; // system default
  let marginMethod: string = "CONTRIBUTION_MARGIN";

  if (sku.minimumMarginOverride != null) {
    requiredMinimumMargin = Number(sku.minimumMarginOverride);
    appliedOverrides.push("CustomerSku.minimumMarginOverride");
  } else if (sku.customer.marginRequirement) {
    requiredMinimumMargin = Number(sku.customer.marginRequirement.minimumMarginPercent);
    marginMethod = sku.customer.marginRequirement.calculationMethod;
  }

  const denominator =
    marginMethod === "GROSS_MARGIN" && sellingPrice != null
      ? sellingPrice
      : finalNetRevenue;

  const contributionMarginPercent =
    denominator !== 0 ? (contributionProfit / denominator) * 100 : 0;

  const varianceFromRequired = contributionMarginPercent - requiredMinimumMargin;

  // ── Alert status ─────────────────────────────────────────────────────────

  let alertStatus: "OK" | "WARNING" | "HIGH" | "CRITICAL" = "OK";

  if (missingSellingPrice || missingProductCost) {
    alertStatus = "HIGH";
  } else if (contributionProfit < 0) {
    alertStatus = "CRITICAL";
  } else if (sku.customer.marginRequirement) {
    const mr = sku.customer.marginRequirement;
    const critical = Number(mr.criticalThresholdPercent);
    const minimum = Number(mr.minimumMarginPercent);
    const warning = Number(mr.warningThresholdPercent);

    if (contributionMarginPercent < critical) {
      alertStatus = "CRITICAL";
    } else if (contributionMarginPercent < minimum) {
      alertStatus = "HIGH";
    } else if (contributionMarginPercent < warning) {
      alertStatus = "WARNING";
    }
  }

  // ── Build trace ──────────────────────────────────────────────────────────

  const trace: CalculationTrace = {
    engineVersion: ENGINE_VERSION,
    calculatedAt: now.toISOString(),
    initiatedBy,
    inputs: {
      sellingPrice: sellingPrice?.toFixed(4) ?? null,
      productCost: productCost?.toFixed(4) ?? null,
      shippingCost: shippingCost.toFixed(4),
      shippingQuoteId,
      allocations: allocationInputs,
      shippingTerms: effectiveShippingTerms,
      packageQuantity: packageQty,
    },
    intermediates: {
      revenueBasedAllowances: revenueBasedAllowances.toFixed(4),
      netRevenue: finalNetRevenue.toFixed(4),
      totalVariableCost: totalVariableCost.toFixed(4),
      contributionProfit: contributionProfit.toFixed(4),
    },
    outputs: {
      contributionMarginPercent: contributionMarginPercent.toFixed(2),
      requiredMinimumMargin: requiredMinimumMargin.toFixed(2),
      varianceFromRequired: varianceFromRequired.toFixed(2),
      alertStatus,
    },
    appliedOverrides,
    dataQuality: {
      missingSellingPrice,
      missingProductCost,
      dimensionSource,
      dunnageApplied,
    },
  };

  return {
    contributionMarginPercent,
    contributionProfit,
    netRevenue: finalNetRevenue,
    totalVariableCost,
    alertStatus,
    trace,
  };
}

export async function runCalculationAndPersist(
  customerSkuId: string,
  initiatedBy: string
): Promise<void> {
  const result = await calculateCustomerSku(customerSkuId, initiatedBy);

  // Persist CalculationResult
  await db.calculationResult.create({
    data: {
      customerSkuId,
      contributionMarginPercent: result.contributionMarginPercent,
      contributionProfit: result.contributionProfit,
      netRevenue: result.netRevenue,
      totalVariableCost: result.totalVariableCost,
      alertStatus: result.alertStatus,
      calculationTrace: result.trace as object,
      calculatedAt: new Date(result.trace.calculatedAt),
      initiatedBy,
    },
  });

  // Update CustomerSku
  await db.customerSku.update({
    where: { id: customerSkuId },
    data: {
      alertStatus: result.alertStatus,
      lastCalculatedAt: new Date(),
    },
  });

  // Generate / resolve alerts
  await processAlerts(customerSkuId, result, initiatedBy);

  await logAction({
    userId: initiatedBy,
    action: AuditAction.CALCULATION_COMPLETED,
    entityType: "CustomerSku",
    entityId: customerSkuId,
    afterValue: {
      contributionMarginPercent: result.trace.outputs.contributionMarginPercent,
      alertStatus: result.alertStatus,
    },
  });
}

async function processAlerts(
  customerSkuId: string,
  result: CalculationOutput,
  initiatedBy: string
): Promise<void> {
  if (result.alertStatus === "OK") {
    await autoResolveMarginAlerts(customerSkuId);
  }

  const { trace } = result;
  const dataQuality = trace.dataQuality;

  // Shipping data quality alerts (fire regardless of OK status)
  if (trace.inputs.shippingTerms === "PREPAID" && dataQuality.dimensionSource === "NONE") {
    await createOrUpdateAlert(customerSkuId, "NO_SHIPPING_QUOTE", "WARNING",
      "PREPAID shipping terms but no dimensions available for quoting");
  }
  if (dataQuality.dunnageApplied) {
    await createOrUpdateAlert(customerSkuId, "DIMENSION_FALLBACK_USED", "INFO",
      "Shipping quote used dunnage-estimated dimensions");
  }

  if (result.alertStatus === "OK") return;

  // Data quality alerts
  if (dataQuality.missingSellingPrice) {
    await createOrUpdateAlert(customerSkuId, "MISSING_SELLING_PRICE", "HIGH", "CustomerSku has no selling price");
  }
  if (dataQuality.missingProductCost) {
    await createOrUpdateAlert(customerSkuId, "MISSING_PRODUCT_COST", "HIGH", "Product has no current cost");
  }

  // Margin alerts (only if we have enough data to calculate)
  if (!dataQuality.missingSellingPrice && !dataQuality.missingProductCost) {
    const cm = Number(trace.outputs.contributionMarginPercent);
    const required = Number(trace.outputs.requiredMinimumMargin);

    if (result.contributionProfit < 0) {
      await createOrUpdateAlert(customerSkuId, "NEGATIVE_PROFIT", "CRITICAL", `Contribution profit is negative`);
    }

    // Check thresholds from the margin requirement
    const sku = await db.customerSku.findUnique({
      where: { id: customerSkuId },
      include: { customer: { include: { marginRequirement: true } } },
    });
    const mr = sku?.customer.marginRequirement;
    if (mr) {
      const critical = Number(mr.criticalThresholdPercent);
      const minimum = Number(mr.minimumMarginPercent);
      const warning = Number(mr.warningThresholdPercent);

      if (cm < critical) {
        await createOrUpdateAlert(customerSkuId, "BELOW_CRITICAL_MARGIN", "CRITICAL",
          `Margin ${cm.toFixed(2)}% is below critical threshold ${critical.toFixed(2)}%`);
      } else if (cm < minimum) {
        await createOrUpdateAlert(customerSkuId, "BELOW_MINIMUM_MARGIN", "HIGH",
          `Margin ${cm.toFixed(2)}% is below minimum ${minimum.toFixed(2)}%`);
      } else if (cm < warning) {
        await createOrUpdateAlert(customerSkuId, "BELOW_WARNING_MARGIN", "WARNING",
          `Margin ${cm.toFixed(2)}% is below warning threshold ${warning.toFixed(2)}%`);
      }
    } else {
      // No margin requirement set — use system default
      if (cm < required) {
        await createOrUpdateAlert(customerSkuId, "BELOW_MINIMUM_MARGIN", "HIGH",
          `Margin ${cm.toFixed(2)}% is below system default ${required.toFixed(2)}%`);
      }
    }
  }

  void initiatedBy; // used for audit only
}
