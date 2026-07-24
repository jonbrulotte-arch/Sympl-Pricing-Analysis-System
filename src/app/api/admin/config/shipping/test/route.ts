import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { toApiError } from "@/lib/errors";
import { getProvider } from "@/server/services/shipping/provider-factory";

export const POST = withAuth(async (session, req: NextRequest) => {
  try {
    const body = await req.json();
    const carrier = body.carrier === "USPS" ? "USPS" as const : "UPS" as const;

    const provider = await getProvider(carrier);
    const available = await provider.isAvailable();

    if (!available) {
      return NextResponse.json({
        data: { carrier, available: false, message: "Credentials not configured" },
      });
    }

    const testRate = await provider.getRate({
      originPostalCode: "10001",
      destinationPostalCode: "90210",
      length: 12,
      width: 12,
      height: 12,
      weight: 5,
      carrier,
    });

    return NextResponse.json({
      data: {
        carrier,
        available: true,
        testRate: testRate.rateAmount,
        serviceCode: testRate.serviceCode,
      },
    });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.MANAGE_SHIPPING_CONFIG]);
