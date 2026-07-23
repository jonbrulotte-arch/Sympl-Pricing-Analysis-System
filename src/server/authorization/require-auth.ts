import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError, toApiError } from "@/lib/errors";
import type { PermissionCode } from "./permissions";
import { hasPermission } from "./check-permission";

export interface AuthenticatedSession {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
}

/**
 * Extracts and validates the session from a Route Handler request.
 * Throws UnauthorizedError if not authenticated.
 */
export async function requireAuth(_req?: NextRequest): Promise<AuthenticatedSession> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role,
    permissions: session.user.permissions ?? [],
  };
}

/**
 * Wraps a Route Handler with authentication + optional permission check.
 * Returns a 401/403 JSON response instead of throwing if checks fail.
 */
export function withAuth<TArgs extends unknown[]>(
  handler: (session: AuthenticatedSession, ...args: TArgs) => Promise<NextResponse>,
  requiredPermissions?: PermissionCode[]
) {
  return async (...args: TArgs): Promise<NextResponse> => {
    try {
      const session = await requireAuth();

      if (requiredPermissions && !hasPermission(session.permissions, requiredPermissions)) {
        throw new ForbiddenError();
      }

      return await handler(session, ...args);
    } catch (err) {
      const { message, statusCode } = toApiError(err);
      return NextResponse.json({ error: message }, { status: statusCode });
    }
  };
}
