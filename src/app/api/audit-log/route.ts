import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { db } from "@/lib/db";
import { paginationSchema } from "@/server/validation/shared.schema";
import { toApiError } from "@/lib/errors";

export const GET = withAuth(async (_session, req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const { page, limit } = paginationSchema.parse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      db.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      db.auditLog.count(),
    ]);

    return NextResponse.json({
      data: entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_AUDIT_LOG]);
