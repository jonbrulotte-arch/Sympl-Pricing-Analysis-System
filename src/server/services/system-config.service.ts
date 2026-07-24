import { db } from "@/lib/db";
import { encryptToCompound, decryptFromCompound } from "@/lib/encryption";
import { logAction, AuditAction } from "./audit-log.service";

export async function getConfigValue(key: string): Promise<string | null> {
  const config = await db.systemConfig.findUnique({ where: { key } });
  if (!config) return null;
  if (config.isEncrypted) {
    return decryptFromCompound(config.value);
  }
  return config.value;
}

export async function setConfigValue(
  key: string,
  value: string,
  isEncrypted: boolean,
  updatedById: string,
  description?: string
): Promise<void> {
  const storedValue = isEncrypted ? encryptToCompound(value) : value;

  await db.systemConfig.upsert({
    where: { key },
    update: {
      value: storedValue,
      isEncrypted,
      description: description ?? undefined,
      updatedById,
    },
    create: {
      key,
      value: storedValue,
      isEncrypted,
      description: description ?? undefined,
      updatedById,
    },
  });

  await logAction({
    userId: updatedById,
    action: AuditAction.CONFIG_CHANGED,
    entityType: "SystemConfig",
    entityId: key,
    afterValue: { key, isEncrypted, description },
  });
}

export async function getConfigValues(
  prefix: string
): Promise<Record<string, string>> {
  const configs = await db.systemConfig.findMany({
    where: { key: { startsWith: prefix } },
  });

  const result: Record<string, string> = {};
  for (const config of configs) {
    const val = config.isEncrypted
      ? decryptFromCompound(config.value)
      : config.value;
    result[config.key] = val;
  }
  return result;
}

export async function listConfigKeys(): Promise<
  Array<{
    key: string;
    isEncrypted: boolean;
    description: string | null;
    updatedAt: Date;
  }>
> {
  return db.systemConfig.findMany({
    select: {
      key: true,
      isEncrypted: true,
      description: true,
      updatedAt: true,
    },
    orderBy: { key: "asc" },
  });
}
