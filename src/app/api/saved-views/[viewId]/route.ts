import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { updateSavedView, deleteSavedView } from "@/server/services/saved-view.service";
import { updateSavedViewSchema } from "@/server/validation/saved-view.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ viewId: string }> };

export const PUT = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { viewId } = await ctx.params;
    const body = await req.json();
    const input = updateSavedViewSchema.parse(body);
    const view = await updateSavedView(viewId, session.userId, input);
    return NextResponse.json({ data: view });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
});

export const DELETE = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { viewId } = await ctx.params;
    await deleteSavedView(viewId, session.userId);
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
});
