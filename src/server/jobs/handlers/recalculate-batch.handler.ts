import type { Job } from "pg-boss";
import { enqueueRecalculateSku } from "@/server/jobs/queue";

interface RecalculateBatchPayload {
  customerSkuIds: string[];
  initiatedBy: string;
}

export async function recalculateBatchHandler(job: Job<RecalculateBatchPayload>[]) {
  for (const { data } of job) {
    for (const customerSkuId of data.customerSkuIds) {
      await enqueueRecalculateSku(customerSkuId, data.initiatedBy);
    }
  }
}
