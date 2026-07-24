import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { listSavedViews, createSavedView } from "@/server/services/saved-view.service";
import { createSavedViewSchema } from "@/server/validation/saved-view.schema";
import { toApiError } from "@/lib/errors";

export const GET = withAuth(async (session) => {
  try {
    const views = await listSavedViews(session.userId);
    return NextResponse.json({ data: views });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
});

export const POST = withAuth(async (session, req: NextRequest) => {
  try {
    const body = await req.json();
    const input = createSavedViewSchema.parse(body);
    const view = await createSavedView(session.userId, input);
    return NextResponse.json({ data: view }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
});
