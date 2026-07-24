import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { assignCustomerToUser, getUserById } from "@/server/services/user.service";
import { assignCustomerSchema } from "@/server/validation/user.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ userId: string }> };

export const GET = withAuth(async (_session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { userId } = await ctx.params;
    const user = await getUserById(userId);
    return NextResponse.json({ data: user.assignments });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_USERS]);

export const POST = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { userId } = await ctx.params;
    const body = await req.json();
    const { customerId, role } = assignCustomerSchema.parse(body);
    await assignCustomerToUser(userId, customerId, role, session.userId);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_USERS]);
