import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import {
  getUserById,
  updateUser,
  deactivateUser,
  assignCustomerToUser,
  removeCustomerFromUser,
} from "@/server/services/user.service";
import { updateUserSchema, assignCustomerSchema } from "@/server/validation/user.schema";
import { toApiError } from "@/lib/errors";

type RouteContext = { params: Promise<{ userId: string }> };

export const GET = withAuth(async (_session, _req: NextRequest, ctx: RouteContext) => {
  try {
    const { userId } = await ctx.params;
    const user = await getUserById(userId);
    const { passwordHash: _, ...safe } = user as typeof user & { passwordHash: string };
    return NextResponse.json({ data: safe });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_USERS]);

export const PATCH = withAuth(async (session, req: NextRequest, ctx: RouteContext) => {
  try {
    const { userId } = await ctx.params;
    const body = await req.json();
    const input = updateUserSchema.parse(body);
    const user = await updateUser(userId, input, session.userId);
    const { passwordHash: _, ...safe } = user as typeof user & { passwordHash: string };
    return NextResponse.json({ data: safe });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_USERS]);

export const DELETE = withAuth(async (session, _req: NextRequest, ctx: RouteContext) => {
  try {
    const { userId } = await ctx.params;
    await deactivateUser(userId, session.userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_USERS]);
