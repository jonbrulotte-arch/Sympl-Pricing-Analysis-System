import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { listNotifications } from "@/server/services/notification.service";
import { toApiError } from "@/lib/errors";

export const GET = withAuth(async (session, req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Math.min(Number(url.searchParams.get("pageSize") ?? "20"), 50);
    const unreadOnly = url.searchParams.get("unreadOnly") === "true";

    const result = await listNotifications(session.userId, { page, pageSize, unreadOnly });
    return NextResponse.json(result);
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
});
