import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { runCalculationAndPersist } from "@/server/services/calculation.service";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { ForbiddenError, toApiError } from "@/lib/errors";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ customerId: string; skuId: string }> };

export const POST = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId } = await ctx.params;

    const hasAccess = await checkCustomerAccess(session.userId, customerId, session.permissions);
    if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

    const sku = await db.customerSku.findFirst({ where: { id: skuId, customerId, deletedAt: null } });
    if (!sku) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await runCalculationAndPersist(skuId, session.userId);

    const updated = await db.customerSku.findUnique({ where: { id: skuId } });
    return NextResponse.json({ data: updated });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.RUN_CALCULATIONS]);
