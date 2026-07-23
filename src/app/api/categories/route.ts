import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { listCategories, createCategory } from "@/server/services/product-category.service";
import { createCategorySchema } from "@/server/validation/category.schema";
import { toApiError } from "@/lib/errors";

export const GET = withAuth(async () => {
  const categories = await listCategories();
  return NextResponse.json({ data: categories });
}, [Permission.VIEW_PRODUCTS]);

export const POST = withAuth(async (session, req: NextRequest) => {
  try {
    const body = await req.json();
    const input = createCategorySchema.parse(body);
    const category = await createCategory(input, session.userId);
    return NextResponse.json({ data: category }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_PRODUCTS]);
