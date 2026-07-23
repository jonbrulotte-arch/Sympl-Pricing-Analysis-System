import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { updateContact, deleteContact } from "@/server/services/customer-contact.service";
import { updateContactSchema } from "@/server/validation/customer-contact.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ customerId: string; contactId: string }> };

export const PATCH = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, contactId } = await ctx.params;
    const body = await req.json();
    const input = updateContactSchema.parse(body);
    const contact = await updateContact(
      customerId,
      contactId,
      input,
      session.userId,
      session.permissions,
      session.userId
    );
    return NextResponse.json({ data: contact });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_CUSTOMERS]);

export const DELETE = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { customerId, contactId } = await ctx.params;
    await deleteContact(customerId, contactId, session.userId, session.permissions, session.userId);
    return NextResponse.json({ data: null });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_CUSTOMERS]);
