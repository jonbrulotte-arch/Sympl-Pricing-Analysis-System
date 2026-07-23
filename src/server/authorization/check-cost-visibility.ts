import { Permission } from "./permissions";

const COST_FIELDS = [
  "currentCost",
  "futureCost",
  "costEffectiveDate",
  "futureCostEffectiveDate",
  "costSource",
  "productCost",
  "costHistory",
] as const;

/**
 * Strips confidential cost fields from a product/SKU record if the
 * user does not have the view_product_cost permission.
 * Applied at the service layer before any data is returned from the API.
 */
export function stripCostFields<T extends Record<string, unknown>>(
  data: T,
  userPermissions: string[]
): Omit<T, (typeof COST_FIELDS)[number]> {
  if (userPermissions.includes(Permission.VIEW_PRODUCT_COST)) {
    return data;
  }

  const sanitized = { ...data };
  for (const field of COST_FIELDS) {
    delete sanitized[field as keyof typeof sanitized];
  }
  return sanitized as Omit<T, (typeof COST_FIELDS)[number]>;
}

export function canViewProductCost(userPermissions: string[]): boolean {
  return userPermissions.includes(Permission.VIEW_PRODUCT_COST);
}
