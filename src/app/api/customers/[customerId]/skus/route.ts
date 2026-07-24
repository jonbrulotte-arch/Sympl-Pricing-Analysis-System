import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { listCustomerSkus, createCustomerSku } from "@/server/services/customer-sku.service";
import { createCustomerSkuSchema } from "@/server/validation/customer-sku.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ customerId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId } = await ctx.params;
    const skus = await listCustomerSkus(customerId, session.userId, session.permissions);
    return NextResponse.json({ data: skus });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);

export const POST = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId } = await ctx.params;
    const body = await req.json();
    const input = createCustomerSkuSchema.parse(body);
    const sku = await createCustomerSku(
      customerId,
      input,
      session.userId,
      session.permissions,
      session.userId
    );
    return NextResponse.json({ data: sku }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_CUSTOMER_SKUS]);
