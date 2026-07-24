import { z } from "zod";

export const createSavedViewSchema = z.object({
  name: z.string().min(1).max(100),
  isDefault: z.boolean().default(false),
  config: z.object({
    columns: z.array(z.string()).optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
    sortBy: z.string().optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
  }),
});

export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;

export const updateSavedViewSchema = createSavedViewSchema.partial();
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>;
