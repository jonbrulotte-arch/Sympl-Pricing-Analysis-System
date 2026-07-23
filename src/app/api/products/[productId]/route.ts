import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import {
  getProductById,
  updateProduct,
  deleteProduct,
} from "@/server/services/product.service";
import { updateProductSchema } from "@/server/validation/product.schema";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ productId: string }> };

export const GET = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { productId } = await ctx.params;
    const product = await getProductById(productId, session.permissions);
    return NextResponse.json({ data: product });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_PRODUCTS]);

export const PATCH = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { productId } = await ctx.params;
    const body = await req.json();
    const input = updateProductSchema.parse(body);
    const product = await updateProduct(productId, input, session.userId);
    return NextResponse.json({ data: product });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_PRODUCTS]);

export const DELETE = withAuth(async (session, _req: NextRequest, ctx: Ctx) => {
  try {
    const { productId } = await ctx.params;
    await deleteProduct(productId, session.userId);
    return NextResponse.json({ data: null });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_PRODUCTS]);
