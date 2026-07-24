import type { PgBoss } from "pg-boss";
import { recalculateSkuHandler } from "./recalculate-sku.handler";
import { recalculateBatchHandler } from "./recalculate-batch.handler";
import { shippingQuoteRefreshHandler } from "./shipping-quote.handler";

export async function registerHandlers(boss: PgBoss) {
  await boss.work("recalculate-sku", { localConcurrency: 10 }, recalculateSkuHandler);
  await boss.work("recalculate-batch", { localConcurrency: 2 }, recalculateBatchHandler);
  await boss.work("shipping-quote-refresh", { localConcurrency: 3 }, shippingQuoteRefreshHandler);
}
