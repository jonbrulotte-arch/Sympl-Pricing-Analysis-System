import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { stripCostFields } from "@/server/authorization/check-cost-visibility";
import { logAction, AuditAction } from "./audit-log.service";
import type { CreateCustomerSkuInput, UpdateCustomerSkuInput } from "@/server/validation/customer-sku.schema";

export async function listCustomerSkus(
  customerId: string,
  userId: string,
  userPermissions: string[]
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const skus = await db.customerSku.findMany({
    where: { customerId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      product: { include: { category: true } },
      priceHistory: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return skus.map((sku) => ({
    ...sku,
    product: stripCostFields(sku.product as Record<string, unknown>, userPermissions),
  }));
}

export async function getCustomerSkuById(
  customerId: string,
  skuId: string,
  userId: string,
  userPermissions: string[]
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const sku = await db.customerSku.findFirst({
    where: { id: skuId, customerId, deletedAt: null },
    include: {
      product: { include: { category: true } },
      priceHistory: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!sku) throw new NotFoundError("CustomerSku");

  return {
    ...sku,
    product: stripCostFields(sku.product as Record<string, unknown>, userPermissions),
  };
}

export async function createCustomerSku(
  customerId: string,
  input: CreateCustomerSkuInput,
  userId: string,
  userPermissions: string[],
  actorId: string
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const existing = await db.customerSku.findFirst({
    where: { customerId, productId: input.productId, deletedAt: null },
  });
  if (existing) throw new ConflictError("This product is already assigned to this customer");

  const sku = await db.customerSku.create({
    data: {
      customerId,
      productId: input.productId,
      customerSkuCode: input.customerSkuCode ?? null,
      sellingPrice: input.sellingPrice ?? null,
      packageQuantity: input.packageQuantity ?? 1,
      minimumMarginOverride: input.minimumMarginOverride ?? null,
      shippingTermsOverride: input.shippingTermsOverride ?? null,
      useShippingDimensions: input.useShippingDimensions ?? false,
      notes: input.notes ?? null,
    },
  });

  if (input.sellingPrice != null) {
    await db.customerPriceHistory.create({
      data: {
        customerSkuId: sku.id,
        sellingPrice: input.sellingPrice,
        effectiveDate: new Date(),
        recordedById: actorId,
      },
    });
  }

  await logAction({
    userId: actorId,
    action: AuditAction.PRICE_CHANGED,
    entityType: "CustomerSku",
    entityId: sku.id,
    afterValue: { customerId, productId: input.productId, sellingPrice: input.sellingPrice },
  });

  return sku;
}

export async function updateCustomerSku(
  customerId: string,
  skuId: string,
  input: UpdateCustomerSkuInput,
  userId: string,
  userPermissions: string[],
  actorId: string
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const existing = await db.customerSku.findFirst({
    where: { id: skuId, customerId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("CustomerSku");

  const updated = await db.customerSku.update({
    where: { id: skuId },
    data: {
      ...(input.customerSkuCode !== undefined && { customerSkuCode: input.customerSkuCode }),
      ...(input.sellingPrice !== undefined && { sellingPrice: input.sellingPrice }),
      ...(input.packageQuantity !== undefined && { packageQuantity: input.packageQuantity }),
      ...(input.minimumMarginOverride !== undefined && {
        minimumMarginOverride: input.minimumMarginOverride,
      }),
      ...(input.shippingTermsOverride !== undefined && {
        shippingTermsOverride: input.shippingTermsOverride,
      }),
      ...(input.useShippingDimensions !== undefined && {
        useShippingDimensions: input.useShippingDimensions,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  });

  const priceChanged =
    input.sellingPrice !== undefined &&
    input.sellingPrice !== (existing.sellingPrice ? Number(existing.sellingPrice) : null);

  if (priceChanged && input.sellingPrice != null) {
    await db.customerPriceHistory.create({
      data: {
        customerSkuId: skuId,
        sellingPrice: input.sellingPrice,
        effectiveDate: new Date(),
        recordedById: actorId,
      },
    });

    await logAction({
      userId: actorId,
      action: AuditAction.PRICE_CHANGED,
      entityType: "CustomerSku",
      entityId: skuId,
      beforeValue: { sellingPrice: existing.sellingPrice?.toString() },
      afterValue: { sellingPrice: input.sellingPrice },
    });
  } else {
    await logAction({
      userId: actorId,
      action: AuditAction.SKU_OVERRIDE_CHANGED,
      entityType: "CustomerSku",
      entityId: skuId,
      afterValue: input,
    });
  }

  return updated;
}

export async function deleteCustomerSku(
  customerId: string,
  skuId: string,
  userId: string,
  userPermissions: string[],
  actorId: string
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const existing = await db.customerSku.findFirst({
    where: { id: skuId, customerId, deletedAt: null },
  });
  if (!existing) throw new NotFoundError("CustomerSku");

  await db.customerSku.update({ where: { id: skuId }, data: { deletedAt: new Date() } });

  await logAction({
    userId: actorId,
    action: AuditAction.SKU_OVERRIDE_CHANGED,
    entityType: "CustomerSku",
    entityId: skuId,
    beforeValue: { productId: existing.productId },
  });
}
