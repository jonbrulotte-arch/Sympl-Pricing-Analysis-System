import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { listProducts, createProduct } from "@/server/services/product.service";
import { createProductSchema } from "@/server/validation/product.schema";
import { toApiError } from "@/lib/errors";

export const GET = withAuth(async (session) => {
  const products = await listProducts(session.permissions);
  return NextResponse.json({ data: products });
}, [Permission.VIEW_PRODUCTS]);

export const POST = withAuth(async (session, req: NextRequest) => {
  try {
    const body = await req.json();
    const input = createProductSchema.parse(body);
    const product = await createProduct(input, session.userId);
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_PRODUCTS]);
