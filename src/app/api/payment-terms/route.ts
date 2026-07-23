import { NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { db } from "@/lib/db";

export const GET = withAuth(async () => {
  const terms = await db.paymentTerm.findMany({
    where: { isActive: true },
    orderBy: { days: "asc" },
  });
  return NextResponse.json({ data: terms });
}, [Permission.VIEW_CUSTOMERS]);
