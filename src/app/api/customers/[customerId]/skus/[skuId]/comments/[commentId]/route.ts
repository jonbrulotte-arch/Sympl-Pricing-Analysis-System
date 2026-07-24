import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { updateComment, deleteComment } from "@/server/services/comment.service";
import { updateCommentSchema } from "@/server/validation/comment.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ customerId: string; skuId: string; commentId: string }> };

export const PATCH = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId, commentId } = await ctx.params;
    const parsed = updateCommentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 422 });
    }

    const comment = await updateComment(commentId, skuId, customerId, parsed.data, session.userId, session.permissions);
    return NextResponse.json({ data: comment });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);

export const DELETE = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId, commentId } = await ctx.params;
    await deleteComment(commentId, skuId, customerId, session.userId, session.permissions);
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);
