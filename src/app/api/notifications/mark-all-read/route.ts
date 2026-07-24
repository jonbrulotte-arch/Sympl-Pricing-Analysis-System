import { NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { markAllNotificationsRead } from "@/server/services/notification.service";
import { toApiError } from "@/lib/errors";

export const POST = withAuth(async (session) => {
  try {
    const result = await markAllNotificationsRead(session.userId);
    return NextResponse.json({ data: result });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
});
