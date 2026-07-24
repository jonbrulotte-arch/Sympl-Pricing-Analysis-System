import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import {
  getCustomerSkuById,
  updateCustomerSku,
  deleteCustomerSku,
} from "@/server/services/customer-sku.service";
import { updateCustomerSkuSchema } from "@/server/validation/customer-sku.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ customerId: string; skuId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId } = await ctx.params;
    const sku = await getCustomerSkuById(customerId, skuId, session.userId, session.permissions);
    return NextResponse.json({ data: sku });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);

export const PATCH = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId } = await ctx.params;
    const body = await req.json();
    const input = updateCustomerSkuSchema.parse(body);
    const sku = await updateCustomerSku(
      customerId,
      skuId,
      input,
      session.userId,
      session.permissions,
      session.userId
    );
    return NextResponse.json({ data: sku });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_CUSTOMER_SKUS]);

export const DELETE = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId } = await ctx.params;
    await deleteCustomerSku(customerId, skuId, session.userId, session.permissions, session.userId);
    return NextResponse.json({ data: null });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_CUSTOMER_SKUS]);
