import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { cancelImportBatch } from "@/server/services/import.service";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ batchId: string }> };

export const POST = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { batchId } = await ctx.params;
    const batch = await cancelImportBatch(batchId, session.userId);
    return NextResponse.json({ data: batch });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.IMPORT_DATA]);
