import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { ForbiddenError, toApiError } from "@/lib/errors";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ customerId: string; skuId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId } = await ctx.params;

    const hasAccess = await checkCustomerAccess(session.userId, customerId, session.permissions);
    if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

    const result = await db.calculationResult.findFirst({
      where: { customerSkuId: skuId },
      orderBy: { calculatedAt: "desc" },
    });

    return NextResponse.json({ data: result ?? null });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CALCULATED_MARGIN]);
