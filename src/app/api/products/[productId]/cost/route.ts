import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { updateProductCost } from "@/server/services/product.service";
import { updateProductCostSchema } from "@/server/validation/product.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ productId: string }> };

export const PATCH = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { productId } = await ctx.params;
    const body = await req.json();
    const input = updateProductCostSchema.parse(body);
    const product = await updateProductCost(productId, input, session.permissions, session.userId);
    return NextResponse.json({ data: product });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.EDIT_PRODUCT_COST]);
