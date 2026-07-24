import { db } from "@/lib/db";
import { NotFoundError, ConflictError } from "@/lib/errors";
import { logAction, AuditAction } from "./audit-log.service";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/server/validation/category.schema";

export async function listCategories() {
  return db.productCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      children: {
        orderBy: { name: "asc" },
        include: { children: { orderBy: { name: "asc" } } },
      },
    },
    where: { parentId: null },
  });
}

export async function getCategoryById(id: string) {
  const category = await db.productCategory.findUnique({
    where: { id },
    include: { children: { orderBy: { name: "asc" } }, parent: true },
  });
  if (!category) throw new NotFoundError("ProductCategory");
  return category;
}

export async function createCategory(input: CreateCategoryInput, actorId: string) {
  const existing = await db.productCategory.findFirst({
    where: { name: input.name, parentId: input.parentId ?? null },
  });
  if (existing) throw new ConflictError(`Category "${input.name}" already exists under this parent`);

  const category = await db.productCategory.create({
    data: {
      name: input.name,
      parentId: input.parentId ?? null,
      dunnagePercent: input.dunnagePercent ?? 0,
    },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.CUSTOMER_CREATED,
    entityType: "ProductCategory",
    entityId: category.id,
    afterValue: category,
  });

  return category;
}

export async function updateCategory(id: string, input: UpdateCategoryInput, actorId: string) {
  const existing = await getCategoryById(id);

  const updated = await db.productCategory.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.parentId !== undefined && { parentId: input.parentId }),
      ...(input.dunnagePercent !== undefined && { dunnagePercent: input.dunnagePercent }),
    },
  });

  await logAction({
    userId: actorId,
    action: AuditAction.CONFIG_CHANGED,
    entityType: "ProductCategory",
    entityId: id,
    beforeValue: existing,
    afterValue: updated,
  });

  return updated;
}
