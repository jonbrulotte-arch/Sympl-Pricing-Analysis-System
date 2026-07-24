import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import {
  getMarginRequirement,
  upsertMarginRequirement,
} from "@/server/services/customer-margin-requirement.service";
import { upsertMarginRequirementSchema } from "@/server/validation/customer-margin-requirement.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ customerId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId } = await ctx.params;
    const req = await getMarginRequirement(customerId, session.userId, session.permissions);
    return NextResponse.json({ data: req });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);

export const PUT = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId } = await ctx.params;
    const body = await req.json();
    const input = upsertMarginRequirementSchema.parse(body);
    const record = await upsertMarginRequirement(
      customerId,
      input,
      session.userId,
      session.permissions,
      session.userId
    );
    return NextResponse.json({ data: record });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_MARGIN_REQUIREMENTS]);
