import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).default("ACTIVE"),
  description: z.string().optional(),
  currency: z.string().length(3).default("USD"),
  timezone: z.string().default("America/New_York"),
  shippingTerms: z.enum(["PREPAID", "COLLECT"]).default("PREPAID"),
  defaultOriginPostalCode: z.string().optional(),
  defaultDestinationPostalCode: z.string().optional(),
  isResidential: z.boolean().default(false),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
