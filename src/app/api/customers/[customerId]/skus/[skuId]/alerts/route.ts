import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { listAlerts } from "@/server/services/alert.service";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ customerId: string; skuId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId } = await ctx.params;
    const alerts = await listAlerts(customerId, skuId, session.userId, session.permissions);
    return NextResponse.json({ data: alerts });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_ALERTS]);
