import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { listGlobalAlerts } from "@/server/services/alert.service";
import { toApiError } from "@/lib/errors";

export const GET = withAuth(async (session, req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20")));
    const severity = url.searchParams.get("severity") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const alertType = url.searchParams.get("alertType") ?? undefined;
    const customerId = url.searchParams.get("customerId") ?? undefined;

    const result = await listGlobalAlerts(session.userId, session.permissions, {
      page,
      pageSize,
      severity,
      status,
      alertType,
      customerId,
    });
    return NextResponse.json(result);
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_ALERTS]);
