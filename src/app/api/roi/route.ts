import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { getRoiGridData } from "@/server/services/roi-grid.service";
import { roiGridQuerySchema } from "@/server/validation/roi.schema";
import { toApiError } from "@/lib/errors";

export const GET = withAuth(async (session, req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const raw: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { raw[k] = v; });

    const params = roiGridQuerySchema.parse(raw);
    const result = await getRoiGridData(session.userId, session.permissions, params);
    return NextResponse.json(result);
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);
