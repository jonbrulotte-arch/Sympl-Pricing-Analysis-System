import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import {
  updateAllocation,
  deleteAllocation,
} from "@/server/services/customer-allocation.service";
import { updateAllocationSchema } from "@/server/validation/customer-allocation.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ customerId: string; allocId: string }> };

export const PATCH = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, allocId } = await ctx.params;
    const body = await req.json();
    const input = updateAllocationSchema.parse(body);
    const allocation = await updateAllocation(
      customerId,
      allocId,
      input,
      session.userId,
      session.permissions,
      session.userId
    );
    return NextResponse.json({ data: allocation });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_ALLOCATIONS]);

export const DELETE = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, allocId } = await ctx.params;
    await deleteAllocation(customerId, allocId, session.userId, session.permissions, session.userId);
    return NextResponse.json({ data: null });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_ALLOCATIONS]);
