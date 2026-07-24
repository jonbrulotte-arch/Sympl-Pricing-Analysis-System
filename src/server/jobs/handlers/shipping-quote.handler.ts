import type { Job } from "pg-boss";
import { requestQuoteSafe } from "@/server/services/shipping/shipping.service";
import { enqueueRecalculateSku } from "@/server/jobs/queue";

interface ShippingQuotePayload {
  customerSkuIds: string[];
  initiatedBy: string;
}

export async function shippingQuoteRefreshHandler(job: Job<ShippingQuotePayload>[]) {
  for (const { data } of job) {
    for (const customerSkuId of data.customerSkuIds) {
      await requestQuoteSafe(customerSkuId, data.initiatedBy);
      await enqueueRecalculateSku(customerSkuId, data.initiatedBy);
    }
  }
}
