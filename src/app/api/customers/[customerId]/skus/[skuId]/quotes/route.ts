import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { ForbiddenError, toApiError } from "@/lib/errors";
import { db } from "@/lib/db";
import { requestQuote, getQuotesForSku } from "@/server/services/shipping/shipping.service";
import { stripShippingCostFields } from "@/server/authorization/check-cost-visibility";

type Ctx = { params: Promise<{ customerId: string; skuId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId } = await ctx.params;

    const hasAccess = await checkCustomerAccess(session.userId, customerId, session.permissions);
    if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

    const sku = await db.customerSku.findFirst({ where: { id: skuId, customerId, deletedAt: null } });
    if (!sku) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const quotes = await getQuotesForSku(skuId);
    const sanitized = quotes.map((q) =>
      stripShippingCostFields(q as unknown as Record<string, unknown>, session.permissions)
    );

    return NextResponse.json({ data: sanitized });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);

export const POST = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId } = await ctx.params;

    const hasAccess = await checkCustomerAccess(session.userId, customerId, session.permissions);
    if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

    const sku = await db.customerSku.findFirst({ where: { id: skuId, customerId, deletedAt: null } });
    if (!sku) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const quote = await requestQuote(skuId, session.userId);
    if (!quote) {
      return NextResponse.json(
        { error: "Unable to generate quote — product has no dimensions" },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: quote }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.REQUEST_SHIPPING_QUOTES]);
