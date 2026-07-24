import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { getImportBatch } from "@/server/services/import.service";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ batchId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { batchId } = await ctx.params;
    const batch = await getImportBatch(batchId, session.userId);
    if (!batch) {
      return NextResponse.json({ error: "Import batch not found" }, { status: 404 });
    }
    return NextResponse.json({ data: batch });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.IMPORT_DATA]);
