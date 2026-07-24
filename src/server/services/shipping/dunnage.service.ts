import { db } from "@/lib/db";
import { logAction, AuditAction } from "@/server/services/audit-log.service";
import type { DunnageConfig } from "@/generated/prisma/client";

export async function getDunnagePercent(
  categoryId: string | null
): Promise<number> {
  if (categoryId != null) {
    const categoryConfig = await db.dunnageConfig.findFirst({
      where: { categoryId, isActive: true },
    });
    if (categoryConfig) {
      return Number(categoryConfig.dunnagePercent);
    }
  }

  // Global fallback (categoryId = null)
  const globalConfig = await db.dunnageConfig.findFirst({
    where: { categoryId: null, isActive: true },
  });
  if (globalConfig) {
    return Number(globalConfig.dunnagePercent);
  }

  return 0;
}

export async function listDunnageConfigs(): Promise<DunnageConfig[]> {
  return db.dunnageConfig.findMany({
    include: { category: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function upsertDunnageConfig(
  categoryId: string | null,
  dunnagePercent: number,
  isActive: boolean,
  updatedById: string
): Promise<DunnageConfig> {
  const existing = await db.dunnageConfig.findFirst({
    where: { categoryId },
  });

  let result: DunnageConfig;
  if (existing) {
    result = await db.dunnageConfig.update({
      where: { id: existing.id },
      data: { dunnagePercent, isActive },
    });
  } else {
    result = await db.dunnageConfig.create({
      data: { categoryId, dunnagePercent, isActive },
    });
  }

  await logAction({
    userId: updatedById,
    action: AuditAction.CONFIG_CHANGED,
    entityType: "DunnageConfig",
    entityId: result.id,
    afterValue: { categoryId, dunnagePercent, isActive },
  });

  return result;
}
