import { z } from "zod";

export const createCustomerSkuSchema = z.object({
  productId: z.string().uuid(),
  customerSkuCode: z.string().max(100).optional(),
  sellingPrice: z.number().positive().optional(),
  packageQuantity: z.number().int().positive().default(1),
  minimumMarginOverride: z.number().min(0).max(100).optional(),
  shippingTermsOverride: z.enum(["PREPAID", "COLLECT"]).optional(),
  useShippingDimensions: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export const updateCustomerSkuSchema = createCustomerSkuSchema
  .omit({ productId: true })
  .partial();

export type CreateCustomerSkuInput = z.infer<typeof createCustomerSkuSchema>;
export type UpdateCustomerSkuInput = z.infer<typeof updateCustomerSkuSchema>;
