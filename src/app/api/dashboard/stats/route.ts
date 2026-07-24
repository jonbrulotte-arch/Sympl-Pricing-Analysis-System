import { NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { getDashboardStats } from "@/server/services/dashboard.service";
import { toApiError } from "@/lib/errors";

export const GET = withAuth(async (session) => {
  try {
    const stats = await getDashboardStats(session.userId, session.permissions);
    return NextResponse.json({ data: stats });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
});
