import { describe, it, expect } from "vitest";
import { hasPermission, hasAnyPermission } from "@/server/authorization/check-permission";
import { Permission } from "@/server/authorization/permissions";

describe("hasPermission", () => {
  it("returns true when user has the required permission", () => {
    expect(hasPermission([Permission.VIEW_CUSTOMERS], Permission.VIEW_CUSTOMERS)).toBe(true);
  });

  it("returns false when user lacks the required permission", () => {
    expect(hasPermission([Permission.VIEW_CUSTOMERS], Permission.MANAGE_CUSTOMERS)).toBe(false);
  });

  it("returns true when user has all required permissions (array)", () => {
    expect(
      hasPermission(
        [Permission.VIEW_CUSTOMERS, Permission.MANAGE_CUSTOMERS],
        [Permission.VIEW_CUSTOMERS, Permission.MANAGE_CUSTOMERS]
      )
    ).toBe(true);
  });

  it("returns false when user lacks one of the required permissions (array)", () => {
    expect(
      hasPermission(
        [Permission.VIEW_CUSTOMERS],
        [Permission.VIEW_CUSTOMERS, Permission.MANAGE_CUSTOMERS]
      )
    ).toBe(false);
  });

  it("returns false for empty permissions list", () => {
    expect(hasPermission([], Permission.VIEW_CUSTOMERS)).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("returns true when user has at least one required permission", () => {
    expect(
      hasAnyPermission(
        [Permission.VIEW_CUSTOMERS],
        [Permission.VIEW_CUSTOMERS, Permission.MANAGE_CUSTOMERS]
      )
    ).toBe(true);
  });

  it("returns false when user has none of the required permissions", () => {
    expect(
      hasAnyPermission(
        [Permission.VIEW_PRODUCTS],
        [Permission.VIEW_CUSTOMERS, Permission.MANAGE_CUSTOMERS]
      )
    ).toBe(false);
  });
});
