import type { ShippingRateProvider, ShippingRateRequest, ShippingRateResponse } from "../types";
import { calculateDimensionalWeight } from "../dimension-resolver";

const RATE_PER_LB: Record<string, number> = {
  UPS: 0.65,
  USPS: 0.55,
};

export class MockRateProvider implements ShippingRateProvider {
  private carrier: "UPS" | "USPS";

  constructor(carrier: "UPS" | "USPS") {
    this.carrier = carrier;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getRate(request: ShippingRateRequest): Promise<ShippingRateResponse> {
    const { dimensionalWeight, billedWeight, divisorUsed } =
      calculateDimensionalWeight(
        {
          length: request.length,
          width: request.width,
          height: request.height,
          weight: request.weight,
        },
        this.carrier
      );

    const ratePerLb = RATE_PER_LB[this.carrier];
    const rateAmount = Math.round(billedWeight * ratePerLb * 100) / 100;

    return {
      carrier: this.carrier,
      serviceCode: "MOCK_GROUND",
      rateAmount,
      currency: "USD",
      billedWeight,
      dimensionalWeight,
      divisorUsed,
      rawResponse: { provider: "mock", carrier: this.carrier },
    };
  }
}
