import { z } from "zod";

const PERCENTAGE_TYPES = [
  "PERCENT_OF_SELLING_PRICE",
  "PERCENT_OF_NET_REVENUE",
  "PERCENT_OF_COST",
] as const;

const FIXED_TYPES = [
  "FIXED_PER_UNIT",
  "FIXED_PER_ORDER",
  "FIXED_PER_SHIPMENT",
  "FIXED_PER_SKU",
] as const;

export const createAllocationSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().optional(),
    calculationType: z.enum([
      "PERCENT_OF_SELLING_PRICE",
      "PERCENT_OF_NET_REVENUE",
      "PERCENT_OF_COST",
      "FIXED_PER_UNIT",
      "FIXED_PER_ORDER",
      "FIXED_PER_SHIPMENT",
      "FIXED_PER_SKU",
      "CUSTOM",
    ]),
    rate: z.number().min(0).max(1).optional(),
    amount: z.number().positive().optional(),
    priority: z.number().int().default(0),
    isActive: z.boolean().default(true),
    isIncludedInMargin: z.boolean().default(true),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if ((PERCENTAGE_TYPES as readonly string[]).includes(data.calculationType) && data.rate == null) {
      ctx.addIssue({ code: "custom", message: "rate is required for percentage-based allocation types", path: ["rate"] });
    }
    if ((FIXED_TYPES as readonly string[]).includes(data.calculationType) && data.amount == null) {
      ctx.addIssue({ code: "custom", message: "amount is required for fixed allocation types", path: ["amount"] });
    }
    if (data.calculationType === "CUSTOM" && !data.notes) {
      ctx.addIssue({ code: "custom", message: "notes is required for CUSTOM allocation type", path: ["notes"] });
    }
  });

export const updateAllocationSchema = createAllocationSchema.partial();

export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
export type UpdateAllocationInput = z.infer<typeof updateAllocationSchema>;
