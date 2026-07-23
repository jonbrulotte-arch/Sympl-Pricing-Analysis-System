import type { Job } from "pg-boss";
import { runCalculationAndPersist } from "@/server/services/calculation.service";

interface RecalculateSkuPayload {
  customerSkuId: string;
  initiatedBy: string;
}

export async function recalculateSkuHandler(job: Job<RecalculateSkuPayload>[]) {
  for (const { data } of job) {
    await runCalculationAndPersist(data.customerSkuId, data.initiatedBy);
  }
}
