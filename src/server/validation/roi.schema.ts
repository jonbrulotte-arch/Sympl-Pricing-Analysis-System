import { z } from "zod";

export const roiGridQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum([
      "customerName",
      "productSku",
      "productName",
      "sellingPrice",
      "currentCost",
      "contributionMarginPercent",
      "contributionProfit",
      "netRevenue",
      "alertStatus",
      "reviewStatus",
      "lastCalculatedAt",
    ])
    .default("customerName"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  search: z.string().optional(),
  customerId: z.string().uuid().optional(),
  alertStatus: z.enum(["OK", "WARNING", "HIGH", "CRITICAL"]).optional(),
  reviewStatus: z.enum(["PENDING", "UNDER_REVIEW", "APPROVED", "ESCALATED"]).optional(),
  categoryId: z.string().uuid().optional(),
});

export type RoiGridQuery = z.infer<typeof roiGridQuerySchema>;

export const bulkActionSchema = z.object({
  action: z.enum(["recalculate", "refresh-quotes", "assign-analyst", "export"]),
  customerSkuIds: z.array(z.string().uuid()).min(1).max(500),
  assigneeId: z.string().uuid().optional(),
});

export type BulkActionInput = z.infer<typeof bulkActionSchema>;
