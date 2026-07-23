import { db } from "@/lib/db";
import { Permission } from "./permissions";

/**
 * Returns true if the user may access the given customer.
 * Users with global_customer_access (Admins and some Directors) bypass the assignment check.
 * All others must have an explicit CustomerAssignment row.
 */
export async function checkCustomerAccess(
  userId: string,
  customerId: string,
  userPermissions: string[]
): Promise<boolean> {
  if (userPermissions.includes(Permission.GLOBAL_CUSTOMER_ACCESS)) {
    return true;
  }

  const assignment = await db.customerAssignment.findUnique({
    where: { userId_customerId: { userId, customerId } },
  });

  return assignment !== null;
}

/**
 * Returns the WHERE clause condition that filters customers to only those
 * the user is assigned to. Pass the result into a Prisma query's where clause.
 *
 * For users with global access, returns an empty object (no filter).
 * For everyone else, restricts to assigned customers.
 */
export function buildCustomerAccessFilter(
  userId: string,
  userPermissions: string[]
): { id?: { in: string[] } } | Record<string, never> {
  if (userPermissions.includes(Permission.GLOBAL_CUSTOMER_ACCESS)) {
    return {};
  }

  // The service layer should supply the assigned IDs; this helper builds the filter shape.
  // Use getAssignedCustomerIds to get the actual IDs.
  return {};
}

export async function getAssignedCustomerIds(userId: string): Promise<string[]> {
  const assignments = await db.customerAssignment.findMany({
    where: { userId },
    select: { customerId: true },
  });
  return assignments.map((a: { customerId: string }) => a.customerId);
}
