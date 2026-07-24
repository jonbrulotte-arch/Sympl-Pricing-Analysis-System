import type { ShippingRateProvider } from "./types";
import { getConfigValues } from "@/server/services/system-config.service";
import { MockRateProvider } from "./providers/mock.provider";
import { UpsRateProvider } from "./providers/ups.provider";
import { UspsRateProvider } from "./providers/usps.provider";

export async function getProvider(
  carrier: "UPS" | "USPS"
): Promise<ShippingRateProvider> {
  if (carrier === "UPS") {
    return getUpsProvider();
  }
  return getUspsProvider();
}

async function getUpsProvider(): Promise<ShippingRateProvider> {
  try {
    const creds = await getConfigValues("ups.");
    if (creds["ups.clientId"] && creds["ups.clientSecret"] && creds["ups.accountNumber"]) {
      return new UpsRateProvider({
        clientId: creds["ups.clientId"],
        clientSecret: creds["ups.clientSecret"],
        accountNumber: creds["ups.accountNumber"],
        environment: (creds["ups.environment"] as "sandbox" | "production") ?? "sandbox",
      });
    }
  } catch {
    // Fall through to mock
  }
  return new MockRateProvider("UPS");
}

async function getUspsProvider(): Promise<ShippingRateProvider> {
  try {
    const creds = await getConfigValues("usps.");
    if (creds["usps.userId"]) {
      return new UspsRateProvider({
        userId: creds["usps.userId"],
        environment: (creds["usps.environment"] as "test" | "production") ?? "test",
      });
    }
  } catch {
    // Fall through to mock
  }
  return new MockRateProvider("USPS");
}
