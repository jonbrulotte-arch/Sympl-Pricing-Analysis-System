import { z } from "zod";

export const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  brand: z.string().max(100).optional(),
  upc: z.string().max(20).optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().optional(),
  unitOfMeasure: z.string().max(50).optional(),
  isActive: z.boolean().default(true),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  shippingLength: z.number().positive().optional(),
  shippingWidth: z.number().positive().optional(),
  shippingHeight: z.number().positive().optional(),
  shippingWeight: z.number().positive().optional(),
});

export const updateProductSchema = createProductSchema.partial().omit({ sku: true });

export const updateProductCostSchema = z.object({
  currentCost: z.number().positive(),
  futureCost: z.number().positive().optional(),
  costEffectiveDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  futureCostEffectiveDate: z
    .string().datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .optional(),
  costSource: z.string().max(100).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateProductCostInput = z.infer<typeof updateProductCostSchema>;
