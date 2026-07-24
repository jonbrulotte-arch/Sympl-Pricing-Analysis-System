import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { logAction, AuditAction } from "@/server/services/audit-log.service";
import { resolveDimensions, calculateDimensionalWeight } from "./dimension-resolver";
import { getDunnagePercent } from "./dunnage.service";
import { getProvider } from "./provider-factory";
import { getConfigValue } from "@/server/services/system-config.service";
import type { ShippingQuote, DimensionSource } from "@/generated/prisma/client";

const DEFAULT_QUOTE_TTL_DAYS = 7;

export async function requestQuote(
  customerSkuId: string,
  initiatedBy?: string
): Promise<ShippingQuote | null> {
  const sku = await db.customerSku.findUnique({
    where: { id: customerSkuId },
    include: {
      product: { include: { category: true } },
      customer: true,
    },
  });

  if (!sku) throw new NotFoundError("CustomerSku");

  const dunnagePercent = sku.product.category
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

  const resolved = resolveDimensions(
    productDims,
    sku.useShippingDimensions,
    dunnagePercent
  );

  if (!resolved.dimensions) {
    return null;
  }

  const origin = sku.customer.defaultOriginPostalCode ?? "00000";
  const destination = sku.customer.defaultDestinationPostalCode ?? "00000";
  const carrier = "UPS" as const;

  const provider = await getProvider(carrier);
  const rateResponse = await provider.getRate({
    originPostalCode: origin,
    destinationPostalCode: destination,
    length: resolved.dimensions.length,
    width: resolved.dimensions.width,
    height: resolved.dimensions.height,
    weight: resolved.dimensions.weight,
    carrier,
  });

  const ttlStr = await getConfigValue("shipping.quoteTtlDays");
  const ttlDays = ttlStr ? parseInt(ttlStr, 10) : DEFAULT_QUOTE_TTL_DAYS;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);

  const quote = await db.shippingQuote.create({
    data: {
      customerSkuId,
      carrier,
      serviceCode: rateResponse.serviceCode,
      rateAmount: rateResponse.rateAmount,
      currency: rateResponse.currency,
      billedWeight: rateResponse.billedWeight,
      dimensionalWeight: rateResponse.dimensionalWeight,
      divisorUsed: rateResponse.divisorUsed,
      dimensionSource: resolved.source as DimensionSource,
      quoteExpiresAt: expiresAt,
      rawResponse: rateResponse.rawResponse as object,
    },
  });

  await selectBestQuote(customerSkuId);

  await db.customerSku.update({
    where: { id: customerSkuId },
    data: { lastQuotedAt: new Date() },
  });

  if (initiatedBy) {
    await logAction({
      userId: initiatedBy,
      action: AuditAction.SHIPPING_QUOTE_REQUESTED,
      entityType: "ShippingQuote",
      entityId: quote.id,
      afterValue: {
        customerSkuId,
        carrier,
        rateAmount: rateResponse.rateAmount,
        dimensionSource: resolved.source,
      },
    });
  }

  return quote;
}

export async function requestQuoteSafe(
  customerSkuId: string,
  initiatedBy?: string
): Promise<ShippingQuote | null> {
  try {
    return await requestQuote(customerSkuId, initiatedBy);
  } catch (error) {
    console.error(
      `Failed to request shipping quote for ${customerSkuId}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function getSelectedQuote(
  customerSkuId: string
): Promise<{
  id: string;
  rateAmount: number;
  dimensionSource: string;
  dunnageApplied: boolean;
} | null> {
  const quote = await db.shippingQuote.findFirst({
    where: {
      customerSkuId,
      isSelected: true,
      quoteExpiresAt: { gt: new Date() },
    },
  });

  if (!quote) return null;

  return {
    id: quote.id,
    rateAmount: Number(quote.rateAmount),
    dimensionSource: quote.dimensionSource,
    dunnageApplied: quote.dimensionSource === "DUNNAGE_FALLBACK",
  };
}

export async function selectBestQuote(
  customerSkuId: string
): Promise<void> {
  await db.shippingQuote.updateMany({
    where: { customerSkuId, isSelected: true },
    data: { isSelected: false },
  });

  const bestQuote = await db.shippingQuote.findFirst({
    where: {
      customerSkuId,
      quoteExpiresAt: { gt: new Date() },
    },
    orderBy: { rateAmount: "asc" },
  });

  if (bestQuote) {
    await db.shippingQuote.update({
      where: { id: bestQuote.id },
      data: { isSelected: true },
    });
  }
}

export async function getQuotesForSku(
  customerSkuId: string
): Promise<ShippingQuote[]> {
  return db.shippingQuote.findMany({
    where: { customerSkuId },
    orderBy: { createdAt: "desc" },
  });
}
