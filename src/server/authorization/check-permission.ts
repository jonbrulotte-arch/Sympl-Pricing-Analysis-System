import type { PermissionCode } from "./permissions";

export function hasPermission(
  userPermissions: string[],
  required: PermissionCode | PermissionCode[]
): boolean {
  const required_ = Array.isArray(required) ? required : [required];
  return required_.every((p) => userPermissions.includes(p));
}

export function hasAnyPermission(
  userPermissions: string[],
  required: PermissionCode[]
): boolean {
  return required.some((p) => userPermissions.includes(p));
}
