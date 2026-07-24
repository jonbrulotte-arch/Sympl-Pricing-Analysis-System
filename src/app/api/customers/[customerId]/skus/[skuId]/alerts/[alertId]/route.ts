import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { acknowledgeAlert, suppressAlert, resolveAlert } from "@/server/services/alert.service";
import { toApiError } from "@/lib/errors";
import { z } from "zod";

type Ctx = { params: Promise<{ customerId: string; skuId: string; alertId: string }> };

const patchSchema = z.object({
  action: z.enum(["acknowledge", "suppress", "resolve"]),
  note: z.string().optional(),
  reason: z.string().optional(),
});

export const PATCH = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, alertId } = await ctx.params;
    const body = await req.json();
    const { action, note, reason } = patchSchema.parse(body);

    if (action === "acknowledge") {
      await acknowledgeAlert(alertId, customerId, session.userId, session.permissions, note);
    } else if (action === "suppress") {
      await suppressAlert(alertId, customerId, session.userId, session.permissions, reason ?? "Suppressed by user");
    } else {
      await resolveAlert(alertId, customerId, session.userId, session.permissions, note);
    }

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_ALERTS]);
