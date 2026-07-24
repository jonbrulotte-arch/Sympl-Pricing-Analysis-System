import { NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { db } from "@/lib/db";

export const GET = withAuth(async () => {
  const roles = await db.role.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: roles });
}, [Permission.MANAGE_USERS]);
