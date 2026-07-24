import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { listConfigKeys, setConfigValue, getConfigValues } from "@/server/services/system-config.service";
import { toApiError } from "@/lib/errors";
import { z } from "zod";

const EXCLUDED_PREFIXES = ["ups.", "usps.", "shipping."];

const upsertConfigSchema = z.object({
  key: z.string().min(1).max(200),
  value: z.string(),
  isEncrypted: z.boolean().default(false),
  description: z.string().max(500).optional(),
});

export const GET = withAuth(async () => {
  try {
    const all = await listConfigKeys();
    const general = all.filter((k) => !EXCLUDED_PREFIXES.some((p) => k.key.startsWith(p)));
    const values = await getConfigValues("");
    const withValues = general.map((k) => ({
      ...k,
      value: k.isEncrypted ? null : (values[k.key] ?? null),
    }));
    return NextResponse.json({ data: withValues });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_SYSTEM_CONFIG]);

export const PUT = withAuth(async (session, req: NextRequest) => {
  try {
    const body = await req.json();
    const input = upsertConfigSchema.parse(body);

    if (EXCLUDED_PREFIXES.some((p) => input.key.startsWith(p))) {
      return NextResponse.json(
        { error: "Use the shipping config endpoint for shipping-related keys" },
        { status: 422 }
      );
    }

    await setConfigValue(input.key, input.value, input.isEncrypted, session.userId, input.description);
    return NextResponse.json({ data: { key: input.key, saved: true } });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_SYSTEM_CONFIG]);
