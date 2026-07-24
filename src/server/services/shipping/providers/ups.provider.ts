import type { ShippingRateProvider, ShippingRateRequest, ShippingRateResponse } from "../types";
import { calculateDimensionalWeight } from "../dimension-resolver";

interface UpsCredentials {
  clientId: string;
  clientSecret: string;
  accountNumber: string;
  environment: "sandbox" | "production";
}

const ENDPOINTS = {
  sandbox: "https://wwwcie.ups.com",
  production: "https://onlinetools.ups.com",
} as const;

export class UpsRateProvider implements ShippingRateProvider {
  private credentials: UpsCredentials;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(credentials: UpsCredentials) {
    this.credentials = credentials;
  }

  async isAvailable(): Promise<boolean> {
    return !!(
      this.credentials.clientId &&
      this.credentials.clientSecret &&
      this.credentials.accountNumber
    );
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const base = ENDPOINTS[this.credentials.environment];
    const response = await fetch(`${base}/security/v1/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${this.credentials.clientId}:${this.credentials.clientSecret}`
        ).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`UPS OAuth failed: ${response.status} ${text}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  async getRate(request: ShippingRateRequest): Promise<ShippingRateResponse> {
    const token = await this.getAccessToken();
    const base = ENDPOINTS[this.credentials.environment];

    const body = {
      RateRequest: {
        Shipment: {
          Shipper: {
            Address: { PostalCode: request.originPostalCode, CountryCode: "US" },
          },
          ShipTo: {
            Address: { PostalCode: request.destinationPostalCode, CountryCode: "US" },
          },
          ShipFrom: {
            Address: { PostalCode: request.originPostalCode, CountryCode: "US" },
          },
          Package: {
            PackagingType: { Code: "02" },
            Dimensions: {
              UnitOfMeasurement: { Code: "IN" },
              Length: String(Math.ceil(request.length)),
              Width: String(Math.ceil(request.width)),
              Height: String(Math.ceil(request.height)),
            },
            PackageWeight: {
              UnitOfMeasurement: { Code: "LBS" },
              Weight: String(Math.ceil(request.weight)),
            },
          },
          PaymentDetails: {
            ShipmentCharge: {
              Type: "01",
              BillShipper: { AccountNumber: this.credentials.accountNumber },
            },
          },
        },
      },
    };

    const response = await fetch(`${base}/api/rating/v2403/Rate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        transId: crypto.randomUUID(),
        transactionSrc: "sympl-pas",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`UPS Rating API error: ${response.status} ${text}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const rateResponse = data.RateResponse as Record<string, unknown> | undefined;
    const ratedShipment = rateResponse?.RatedShipment as Record<string, unknown> | undefined;
    const totalCharges = ratedShipment?.TotalCharges as Record<string, string> | undefined;
    const monetaryValue = totalCharges?.MonetaryValue ?? "0";
    const billedWeightData = ratedShipment?.BillingWeight as Record<string, string> | undefined;

    const rateAmount = parseFloat(monetaryValue);
    const apiBilledWeight = parseFloat(billedWeightData?.Weight ?? String(request.weight));

    const { dimensionalWeight, divisorUsed } = calculateDimensionalWeight(
      {
        length: request.length,
        width: request.width,
        height: request.height,
        weight: request.weight,
      },
      "UPS"
    );

    return {
      carrier: "UPS",
      serviceCode: "03",
      rateAmount,
      currency: "USD",
      billedWeight: apiBilledWeight,
      dimensionalWeight,
      divisorUsed,
      rawResponse: data as Record<string, unknown>,
    };
  }
}
