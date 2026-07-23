import { z } from "zod";
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT } from "@/lib/constants";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION_MAX_LIMIT)
    .default(PAGINATION_DEFAULT_LIMIT),
});

export const sortOrderSchema = z.enum(["asc", "desc"]).default("asc");

export const uuidSchema = z.string().uuid();

export type PaginationInput = z.infer<typeof paginationSchema>;
