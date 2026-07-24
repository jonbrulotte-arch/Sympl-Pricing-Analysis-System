import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { toApiError } from "@/lib/errors";
import { listConfigKeys, setConfigValue } from "@/server/services/system-config.service";
import { systemConfigSchema } from "@/server/validation/shipping.schema";

const SHIPPING_PREFIXES = ["ups.", "usps.", "shipping."];

export const GET = withAuth(async (session) => {
  try {
    const allKeys = await listConfigKeys();
    const shippingKeys = allKeys.filter((k) =>
      SHIPPING_PREFIXES.some((p) => k.key.startsWith(p))
    );
    return NextResponse.json({ data: shippingKeys });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_SHIPPING_CONFIG]);

export const PUT = withAuth(async (session, req: NextRequest) => {
  try {
    const body = await req.json();
    const input = systemConfigSchema.parse(body);

    if (!SHIPPING_PREFIXES.some((p) => input.key.startsWith(p))) {
      return NextResponse.json(
        { error: "Key must start with ups., usps., or shipping." },
        { status: 422 }
      );
    }

    await setConfigValue(
      input.key,
      input.value,
      input.isEncrypted,
      session.userId,
      input.description
    );

    return NextResponse.json({ data: { key: input.key, saved: true } });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_SHIPPING_CONFIG]);
