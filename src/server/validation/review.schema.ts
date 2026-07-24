import { z } from "zod";

export const reviewActionSchema = z.object({
  action: z.enum(["request", "approve", "escalate", "reset"]),
  note: z.string().max(2000).optional(),
});

export type ReviewActionInput = z.infer<typeof reviewActionSchema>;
