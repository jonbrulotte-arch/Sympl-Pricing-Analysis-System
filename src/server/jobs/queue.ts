import { PgBoss } from "pg-boss";

const globalForBoss = globalThis as unknown as { boss?: PgBoss };

export const boss =
  globalForBoss.boss ??
  new PgBoss({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForBoss.boss = boss;
}

export async function enqueueRecalculateSku(customerSkuId: string, initiatedBy: string) {
  await boss.send(
    "recalculate-sku",
    { customerSkuId, initiatedBy },
    { singletonKey: customerSkuId }
  );
}

export async function enqueueRecalculateBatch(customerSkuIds: string[], initiatedBy: string) {
  await boss.send("recalculate-batch", { customerSkuIds, initiatedBy });
}
