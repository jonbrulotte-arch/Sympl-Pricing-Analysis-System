import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { getProductCostHistory } from "@/server/services/product.service";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ productId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { productId } = await ctx.params;
    const history = await getProductCostHistory(productId, session.permissions);
    return NextResponse.json({ data: history });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_PRODUCT_COST]);
