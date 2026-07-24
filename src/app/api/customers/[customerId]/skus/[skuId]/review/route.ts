import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { performReviewAction } from "@/server/services/review.service";
import { reviewActionSchema } from "@/server/validation/review.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ customerId: string; skuId: string }> };

export const POST = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId } = await ctx.params;
    const parsed = reviewActionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 422 });
    }

    const result = await performReviewAction(
      skuId,
      customerId,
      parsed.data.action,
      session.userId,
      session.permissions,
      parsed.data.note
    );

    return NextResponse.json({ data: result });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);
