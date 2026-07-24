import { z } from "zod";

export const systemConfigSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.string().min(0),
  isEncrypted: z.boolean().default(false),
  description: z.string().optional(),
});

export const requestQuoteSchema = z.object({
  carrier: z.enum(["UPS", "USPS"]).optional(),
});

export const dunnageConfigSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  dunnagePercent: z.coerce.number().min(0).max(100),
  isActive: z.boolean().default(true),
});
