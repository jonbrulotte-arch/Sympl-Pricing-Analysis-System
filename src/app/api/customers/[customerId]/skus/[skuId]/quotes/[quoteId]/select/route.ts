import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { ForbiddenError, toApiError } from "@/lib/errors";
import { db } from "@/lib/db";

type Ctx = {
  params: Promise<{ customerId: string; skuId: string; quoteId: string }>;
};

export const PATCH = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId, quoteId } = await ctx.params;

    const hasAccess = await checkCustomerAccess(session.userId, customerId, session.permissions);
    if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

    const sku = await db.customerSku.findFirst({ where: { id: skuId, customerId, deletedAt: null } });
    if (!sku) return NextResponse.json({ error: "SKU not found" }, { status: 404 });

    const quote = await db.shippingQuote.findFirst({ where: { id: quoteId, customerSkuId: skuId } });
    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

    // Deselect all, then select the target
    await db.shippingQuote.updateMany({
      where: { customerSkuId: skuId, isSelected: true },
      data: { isSelected: false },
    });
    await db.shippingQuote.update({
      where: { id: quoteId },
      data: { isSelected: true },
    });

    return NextResponse.json({ data: { selected: quoteId } });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_CUSTOMER_SKUS]);
