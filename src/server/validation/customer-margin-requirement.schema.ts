import { z } from "zod";

export const upsertMarginRequirementSchema = z
  .object({
    minimumMarginPercent: z.number().min(0).max(100),
    warningThresholdPercent: z.number().min(0).max(100),
    criticalThresholdPercent: z.number().min(0).max(100),
    calculationMethod: z.enum(["CONTRIBUTION_MARGIN", "GROSS_MARGIN"]).default("CONTRIBUTION_MARGIN"),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.criticalThresholdPercent >= data.warningThresholdPercent) {
      ctx.addIssue({
        code: "custom",
        message: "criticalThresholdPercent must be less than warningThresholdPercent",
        path: ["criticalThresholdPercent"],
      });
    }
    if (data.warningThresholdPercent >= data.minimumMarginPercent) {
      ctx.addIssue({
        code: "custom",
        message: "warningThresholdPercent must be less than minimumMarginPercent",
        path: ["warningThresholdPercent"],
      });
    }
  });

export type UpsertMarginRequirementInput = z.infer<typeof upsertMarginRequirementSchema>;
