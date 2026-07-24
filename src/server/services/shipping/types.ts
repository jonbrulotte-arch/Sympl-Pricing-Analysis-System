export interface ShippingRateRequest {
  originPostalCode: string;
  destinationPostalCode: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  carrier: "UPS" | "USPS";
}

export interface ShippingRateResponse {
  carrier: "UPS" | "USPS";
  serviceCode: string;
  rateAmount: number;
  currency: string;
  billedWeight: number;
  dimensionalWeight: number;
  divisorUsed: number;
  rawResponse: Record<string, unknown>;
}

export interface ShippingRateError {
  carrier: "UPS" | "USPS";
  code: string;
  message: string;
}

export interface ShippingRateProvider {
  getRate(request: ShippingRateRequest): Promise<ShippingRateResponse>;
  isAvailable(): Promise<boolean>;
}
