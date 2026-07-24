import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { ForbiddenError, toApiError } from "@/lib/errors";
import { db } from "@/lib/db";
import { enqueueShippingQuoteRefresh } from "@/server/jobs/queue";

type Ctx = { params: Promise<{ customerId: string }> };

export const POST = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId } = await ctx.params;

    const hasAccess = await checkCustomerAccess(session.userId, customerId, session.permissions);
    if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

    const body = await req.json().catch(() => ({}));
    let customerSkuIds: string[] = (body as { customerSkuIds?: string[] }).customerSkuIds ?? [];

    if (customerSkuIds.length === 0) {
      const skus = await db.customerSku.findMany({
        where: { customerId, deletedAt: null },
        select: { id: true },
      });
      customerSkuIds = skus.map((s) => s.id);
    }

    if (customerSkuIds.length === 0) {
      return NextResponse.json({ data: { queued: 0 } });
    }

    try {
      await enqueueShippingQuoteRefresh(customerSkuIds, session.userId);
    } catch {
      // Worker may not be running — fall through gracefully
    }

    return NextResponse.json({ data: { queued: customerSkuIds.length } });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.REQUEST_SHIPPING_QUOTES]);
