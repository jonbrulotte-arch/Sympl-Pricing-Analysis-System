import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import {
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} from "@/server/services/customer.service";
import { updateCustomerSchema } from "@/server/validation/customer.schema";
import { toApiError } from "@/lib/errors";

type RouteContext = { params: Promise<{ customerId: string }> };

export const GET = withAuth(async (session, req: NextRequest, ctx: RouteContext) => {
  try {
    const { customerId } = await ctx.params;
    const customer = await getCustomerById(customerId, session.userId, session.permissions);
    return NextResponse.json({ data: customer });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);

export const PATCH = withAuth(async (session, req: NextRequest, ctx: RouteContext) => {
  try {
    const { customerId } = await ctx.params;
    const body = await req.json();
    const input = updateCustomerSchema.parse(body);
    const customer = await updateCustomer(
      customerId,
      input,
      session.userId,
      session.permissions,
      session.userId
    );
    return NextResponse.json({ data: customer });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_CUSTOMERS]);

export const DELETE = withAuth(async (session, req: NextRequest, ctx: RouteContext) => {
  try {
    const { customerId } = await ctx.params;
    await deleteCustomer(customerId, session.userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_CUSTOMERS]);
