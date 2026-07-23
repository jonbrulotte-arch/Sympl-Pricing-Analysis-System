import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { listCustomers, createCustomer } from "@/server/services/customer.service";
import { createCustomerSchema } from "@/server/validation/customer.schema";
import { toApiError, ValidationError } from "@/lib/errors";

export const GET = withAuth(async (session) => {
  const customers = await listCustomers(session.userId, session.permissions);
  return NextResponse.json({ data: customers });
}, [Permission.VIEW_CUSTOMERS]);

export const POST = withAuth(async (session, req: NextRequest) => {
  try {
    const body = await req.json();
    const input = createCustomerSchema.parse(body);
    const customer = await createCustomer(input, session.userId);
    return NextResponse.json({ data: customer }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_CUSTOMERS]);
