import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { markNotificationRead } from "@/server/services/notification.service";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ notificationId: string }> };

export const PATCH = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { notificationId } = await ctx.params;
    const notification = await markNotificationRead(notificationId, session.userId);
    return NextResponse.json({ data: notification });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
});
