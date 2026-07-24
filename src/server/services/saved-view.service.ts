import { db } from "@/lib/db";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import type { CreateSavedViewInput, UpdateSavedViewInput } from "@/server/validation/saved-view.schema";

export async function listSavedViews(userId: string) {
  return db.savedView.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function createSavedView(userId: string, input: CreateSavedViewInput) {
  if (input.isDefault) {
    await db.savedView.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return db.savedView.create({
    data: {
      userId,
      name: input.name,
      isDefault: input.isDefault ?? false,
      config: input.config as object,
    },
  });
}

export async function updateSavedView(
  viewId: string,
  userId: string,
  input: UpdateSavedViewInput
) {
  const existing = await db.savedView.findUnique({ where: { id: viewId } });
  if (!existing) throw new NotFoundError("SavedView");
  if (existing.userId !== userId) throw new ForbiddenError("Not your view");

  if (input.isDefault) {
    await db.savedView.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return db.savedView.update({
    where: { id: viewId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
      ...(input.config !== undefined && { config: input.config as object }),
    },
  });
}

export async function deleteSavedView(viewId: string, userId: string) {
  const existing = await db.savedView.findUnique({ where: { id: viewId } });
  if (!existing) throw new NotFoundError("SavedView");
  if (existing.userId !== userId) throw new ForbiddenError("Not your view");

  await db.savedView.delete({ where: { id: viewId } });
}
