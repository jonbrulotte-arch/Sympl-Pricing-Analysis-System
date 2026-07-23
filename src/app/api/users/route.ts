import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { listUsers, createUser } from "@/server/services/user.service";
import { createUserSchema } from "@/server/validation/user.schema";
import { toApiError } from "@/lib/errors";

export const GET = withAuth(async () => {
  const users = await listUsers();
  return NextResponse.json({ data: users });
}, [Permission.MANAGE_USERS]);

export const POST = withAuth(async (session, req: NextRequest) => {
  try {
    const body = await req.json();
    const input = createUserSchema.parse(body);
    const user = await createUser(input, session.userId);
    const { passwordHash: _, ...safe } = user as typeof user & { passwordHash: string };
    return NextResponse.json({ data: safe }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_USERS]);
