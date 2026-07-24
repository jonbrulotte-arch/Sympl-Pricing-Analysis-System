import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { removeCustomerFromUser } from "@/server/services/user.service";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ userId: string; customerId: string }> };

export const DELETE = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { userId, customerId } = await ctx.params;
    await removeCustomerFromUser(userId, customerId, session.userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_USERS]);
