import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { listComments, createComment } from "@/server/services/comment.service";
import { createCommentSchema } from "@/server/validation/comment.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ customerId: string; skuId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId } = await ctx.params;
    const comments = await listComments(skuId, customerId, session.userId, session.permissions);
    return NextResponse.json({ data: comments });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);

export const POST = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, skuId } = await ctx.params;
    const parsed = createCommentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 422 });
    }

    const comment = await createComment(skuId, customerId, parsed.data, session.userId, session.permissions);
    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);
