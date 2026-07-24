import { db } from "@/lib/db";
import { NotFoundError, ConflictError, ForbiddenError } from "@/lib/errors";
import { stripCostFields, canViewProductCost } from "@/server/authorization/check-cost-visibility";
import { Permission } from "@/server/authorization/permissions";
import { logAction, AuditAction } from "./audit-log.service";
import type { CreateProductInput, UpdateProductInput, UpdateProductCostInput } from "@/server/validation/product.schema";

export async function listProducts(userPermissions: string[]) {
  const products = await db.product.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: { category: true },
  });
  return products.map((p) => stripCostFields(p as Record<string, unknown>, userPermissions));
}

export async function getProductById(id: string, userPermissions: string[]) {
  const product = await db.product.findFirst({
    where: { id, deletedAt: null },
    include: { category: true },
  });
  if (!product) throw new NotFoundError("Product");
  return stripCostFields(product as Record<string, unknown>, userPermissions);
}

export async function createProduct(input: CreateProductInput, actorId: string) {
  const existing = await db.product.findUnique({ where: { sku: input.sku } });
  if (existing) throw new ConflictError(`Product with SKU "${input.sku}" already exists`);

  const product = await db.product.create({
    data: {
      sku: input.sku,
      name: input.name,
      brand: input.brand ?? null,
      upc: input.upc ?? null,
      categoryId: input.categoryId ?? null,
      description: input.description ?? null,
      unitOfMeasure: input.unitOfMeasure ?? null,
      isActive: input.isActive ?? true,
      length: input.length ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      weight: input.weight ?? null,
      shippingLength: input.shippingLength ?? null,
      shippingWidth: input.shippingWidth ?? null,
      shippingHeight: input.shippingHeight ?? null,
      shippingWeight: input.shippingWeight ?? null,
    },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_CREATED,
    entityType: "Product",
    entityId: product.id,
    afterValue: { sku: product.sku, name: product.name },
  });

  return product;
}

export async function updateProduct(id: string, input: UpdateProductInput, actorId: string) {
  const existing = await db.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Product");

  const updated = await db.product.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.brand !== undefined && { brand: input.brand }),
      ...(input.upc !== undefined && { upc: input.upc }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.unitOfMeasure !== undefined && { unitOfMeasure: input.unitOfMeasure }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.length !== undefined && { length: input.length }),
      ...(input.width !== undefined && { width: input.width }),
      ...(input.height !== undefined && { height: input.height }),
      ...(input.weight !== undefined && { weight: input.weight }),
      ...(input.shippingLength !== undefined && { shippingLength: input.shippingLength }),
      ...(input.shippingWidth !== undefined && { shippingWidth: input.shippingWidth }),
      ...(input.shippingHeight !== undefined && { shippingHeight: input.shippingHeight }),
      ...(input.shippingWeight !== undefined && { shippingWeight: input.shippingWeight }),
    },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_UPDATED,
    entityType: "Product",
    entityId: id,
    beforeValue: { name: existing.name, isActive: existing.isActive },
    afterValue: { name: updated.name, isActive: updated.isActive },
  });

  return updated;
}

export async function updateProductCost(
  id: string,
  input: UpdateProductCostInput,
  userPermissions: string[],
  actorId: string
) {
  if (!userPermissions.includes(Permission.EDIT_PRODUCT_COST)) {
    throw new ForbiddenError("edit_product_cost permission required");
  }

  const existing = await db.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Product");

  const updated = await db.product.update({
    where: { id },
    data: {
      currentCost: input.currentCost,
      futureCost: input.futureCost ?? null,
      costEffectiveDate: input.costEffectiveDate ? new Date(input.costEffectiveDate) : null,
      futureCostEffectiveDate: input.futureCostEffectiveDate
        ? new Date(input.futureCostEffectiveDate)
        : null,
      costSource: input.costSource ?? null,
    },
  });

  await db.productCostHistory.create({
    data: {
      productId: id,
      cost: input.currentCost,
      effectiveDate: input.costEffectiveDate ? new Date(input.costEffectiveDate) : new Date(),
      source: input.costSource ?? null,
      recordedById: actorId,
    },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.COST_CHANGED,
    entityType: "Product",
    entityId: id,
    beforeValue: { currentCost: existing.currentCost?.toString() },
    afterValue: { currentCost: input.currentCost },
  });

  return updated;
}

export async function getProductCostHistory(id: string, userPermissions: string[]) {
  if (!canViewProductCost(userPermissions)) {
    throw new ForbiddenError("view_product_cost permission required");
  }

  const product = await db.product.findFirst({ where: { id, deletedAt: null } });
  if (!product) throw new NotFoundError("Product");

  return db.productCostHistory.findMany({
    where: { productId: id },
    orderBy: { createdAt: "desc" },
    include: { recordedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function deleteProduct(id: string, actorId: string) {
  const existing = await db.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new NotFoundError("Product");

  await db.product.update({ where: { id }, data: { deletedAt: new Date() } });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_DELETED,
    entityType: "Product",
    entityId: id,
    beforeValue: { sku: existing.sku, name: existing.name },
  });
}
