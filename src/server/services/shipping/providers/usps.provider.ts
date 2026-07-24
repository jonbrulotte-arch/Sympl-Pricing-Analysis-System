import type { ShippingRateProvider, ShippingRateRequest, ShippingRateResponse } from "../types";
import { calculateDimensionalWeight } from "../dimension-resolver";

interface UspsCredentials {
  userId: string;
  environment: "test" | "production";
}

const ENDPOINTS = {
  test: "https://stg-secure.shippingapis.com/ShippingAPI.dll",
  production: "https://secure.shippingapis.com/ShippingAPI.dll",
} as const;

export class UspsRateProvider implements ShippingRateProvider {
  private credentials: UspsCredentials;

  constructor(credentials: UspsCredentials) {
    this.credentials = credentials;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.credentials.userId;
  }

  async getRate(request: ShippingRateRequest): Promise<ShippingRateResponse> {
    const xml = `<RateV4Request USERID="${this.escapeXml(this.credentials.userId)}">
  <Revision>2</Revision>
  <Package ID="1ST">
    <Service>PRIORITY</Service>
    <ZipOrigination>${this.escapeXml(request.originPostalCode)}</ZipOrigination>
    <ZipDestination>${this.escapeXml(request.destinationPostalCode)}</ZipDestination>
    <Pounds>${Math.floor(request.weight)}</Pounds>
    <Ounces>${Math.round((request.weight % 1) * 16)}</Ounces>
    <Container>RECTANGULAR</Container>
    <Width>${request.width}</Width>
    <Length>${request.length}</Length>
    <Height>${request.height}</Height>
    <Machinable>true</Machinable>
  </Package>
</RateV4Request>`;

    const base = ENDPOINTS[this.credentials.environment];
    const url = `${base}?API=RateV4&XML=${encodeURIComponent(xml)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`USPS API error: ${response.status}`);
    }

    const text = await response.text();

    const errorMatch = text.match(/<Description>(.*?)<\/Description>/);
    if (text.includes("<Error>") && errorMatch) {
      throw new Error(`USPS API error: ${errorMatch[1]}`);
    }

    const rateMatch = text.match(/<Rate>([\d.]+)<\/Rate>/);
    const rateAmount = rateMatch ? parseFloat(rateMatch[1]) : 0;

    const { dimensionalWeight, billedWeight, divisorUsed } =
      calculateDimensionalWeight(
        {
          length: request.length,
          width: request.width,
          height: request.height,
          weight: request.weight,
        },
        "USPS"
      );

    return {
      carrier: "USPS",
      serviceCode: "PRIORITY",
      rateAmount,
      currency: "USD",
      billedWeight,
      dimensionalWeight,
      divisorUsed,
      rawResponse: { xmlResponse: text },
    };
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
