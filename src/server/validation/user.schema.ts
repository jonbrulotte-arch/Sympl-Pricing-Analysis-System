import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  roleId: z.string().uuid(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  roleId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  mustResetPassword: z.boolean().optional(),
});

export const assignCustomerSchema = z.object({
  customerId: z.string().uuid(),
  role: z.enum(["OWNER", "MANAGER", "ANALYST", "VIEWER"]).default("ANALYST"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AssignCustomerInput = z.infer<typeof assignCustomerSchema>;
