import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { listAllocations, createAllocation } from "@/server/services/customer-allocation.service";
import { createAllocationSchema } from "@/server/validation/customer-allocation.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ customerId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId } = await ctx.params;
    const allocations = await listAllocations(customerId, session.userId, session.permissions);
    return NextResponse.json({ data: allocations });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);

export const POST = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId } = await ctx.params;
    const body = await req.json();
    const input = createAllocationSchema.parse(body);
    const allocation = await createAllocation(
      customerId,
      input,
      session.userId,
      session.permissions,
      session.userId
    );
    return NextResponse.json({ data: allocation }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_ALLOCATIONS]);
