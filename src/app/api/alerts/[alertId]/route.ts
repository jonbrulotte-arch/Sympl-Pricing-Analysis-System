import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import {
  getAlertWithAccess,
  acknowledgeAlert,
  suppressAlert,
  resolveAlert,
} from "@/server/services/alert.service";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ alertId: string }> };

export const PATCH = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { alertId } = await ctx.params;
    const body = await req.json();
    const { action, note, reason } = body as { action: string; note?: string; reason?: string };

    const alert = await getAlertWithAccess(alertId, session.userId, session.permissions);
    const customerId = alert.customerSku.customerId;

    switch (action) {
      case "acknowledge":
        await acknowledgeAlert(alertId, customerId, session.userId, session.permissions, note);
        break;
      case "suppress":
        if (!reason) {
          return NextResponse.json({ error: "reason is required for suppress" }, { status: 400 });
        }
        await suppressAlert(alertId, customerId, session.userId, session.permissions, reason);
        break;
      case "resolve":
        await resolveAlert(alertId, customerId, session.userId, session.permissions, note);
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_ALERTS]);
