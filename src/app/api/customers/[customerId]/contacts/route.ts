import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { listContacts, createContact } from "@/server/services/customer-contact.service";
import { createContactSchema } from "@/server/validation/customer-contact.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ customerId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId } = await ctx.params;
    const contacts = await listContacts(customerId, session.userId, session.permissions);
    return NextResponse.json({ data: contacts });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);

export const POST = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId } = await ctx.params;
    const body = await req.json();
    const input = createContactSchema.parse(body);
    const contact = await createContact(
      customerId,
      input,
      session.userId,
      session.permissions,
      session.userId
    );
    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_CUSTOMERS]);
