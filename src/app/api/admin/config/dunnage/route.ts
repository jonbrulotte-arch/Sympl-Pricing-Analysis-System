import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { toApiError } from "@/lib/errors";
import { listDunnageConfigs, upsertDunnageConfig } from "@/server/services/shipping/dunnage.service";
import { dunnageConfigSchema } from "@/server/validation/shipping.schema";

export const GET = withAuth(async () => {
  try {
    const configs = await listDunnageConfigs();
    return NextResponse.json({ data: configs });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_SHIPPING_CONFIG]);

export const POST = withAuth(async (session, req: NextRequest) => {
  try {
    const body = await req.json();
    const input = dunnageConfigSchema.parse(body);

    const config = await upsertDunnageConfig(
      input.categoryId ?? null,
      input.dunnagePercent,
      input.isActive,
      session.userId
    );

    return NextResponse.json({ data: config }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_SHIPPING_CONFIG]);
