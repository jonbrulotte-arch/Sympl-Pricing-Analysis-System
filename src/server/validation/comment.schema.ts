import { z } from "zod";

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  parentCommentId: z.string().uuid().optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
