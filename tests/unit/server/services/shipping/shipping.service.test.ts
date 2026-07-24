import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    customerSku: { findUnique: vi.fn(), update: vi.fn() },
    shippingQuote: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/services/audit-log.service", () => ({
  logAction: vi.fn(),
  AuditAction: { SHIPPING_QUOTE_REQUESTED: "SHIPPING_QUOTE_REQUESTED" },
}));

vi.mock("@/server/services/shipping/dunnage.service", () => ({
  getDunnagePercent: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/server/services/shipping/provider-factory", () => ({
  getProvider: vi.fn().mockResolvedValue({
    isAvailable: vi.fn().mockResolvedValue(true),
    getRate: vi.fn().mockResolvedValue({
      carrier: "UPS",
      serviceCode: "MOCK_GROUND",
      rateAmount: 5.25,
      currency: "USD",
      billedWeight: 10,
      dimensionalWeight: 8,
      divisorUsed: 139,
      rawResponse: {},
    }),
  }),
}));

vi.mock("@/server/services/system-config.service", () => ({
  getConfigValue: vi.fn().mockResolvedValue("7"),
}));

import { db } from "@/lib/db";
import { requestQuote, requestQuoteSafe, getSelectedQuote, selectBestQuote } from "@/server/services/shipping/shipping.service";

const mockDb = db as unknown as {
  customerSku: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  shippingQuote: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

const baseSku = {
  id: "sku-1",
  useShippingDimensions: true,
  product: {
    id: "prod-1",
    categoryId: "cat-1",
    length: 10, width: 7, height: 5, weight: 9,
    shippingLength: 11, shippingWidth: 8, shippingHeight: 6, shippingWeight: 10,
    category: { id: "cat-1", dunnagePercent: "0.10" },
  },
  customer: {
    id: "cust-1",
    defaultOriginPostalCode: "10001",
    defaultDestinationPostalCode: "90210",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.customerSku.findUnique.mockResolvedValue(baseSku);
  mockDb.shippingQuote.create.mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "quote-1", ...args.data })
  );
  mockDb.shippingQuote.updateMany.mockResolvedValue({ count: 0 });
  mockDb.shippingQuote.findFirst.mockResolvedValue(null);
  mockDb.customerSku.update.mockResolvedValue({});
});

describe("requestQuote", () => {
  it("creates a shipping quote with correct data", async () => {
    const quote = await requestQuote("sku-1", "user-1");
    expect(quote).not.toBeNull();
    expect(mockDb.shippingQuote.create).toHaveBeenCalledTimes(1);
    expect(mockDb.customerSku.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sku-1" },
        data: expect.objectContaining({ lastQuotedAt: expect.any(Date) }),
      })
    );
  });

  it("returns null when no dimensions available", async () => {
    mockDb.customerSku.findUnique.mockResolvedValue({
      ...baseSku,
      useShippingDimensions: false,
      product: {
        ...baseSku.product,
        length: null, width: null, height: null, weight: null,
        shippingLength: null, shippingWidth: null, shippingHeight: null, shippingWeight: null,
        category: null,
        categoryId: null,
      },
    });

    const quote = await requestQuote("sku-1");
    expect(quote).toBeNull();
    expect(mockDb.shippingQuote.create).not.toHaveBeenCalled();
  });
});

describe("requestQuoteSafe", () => {
  it("returns null on provider error", async () => {
    mockDb.customerSku.findUnique.mockRejectedValue(new Error("DB down"));
    const quote = await requestQuoteSafe("sku-1");
    expect(quote).toBeNull();
  });
});

describe("getSelectedQuote", () => {
  it("returns selected non-expired quote", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    mockDb.shippingQuote.findFirst.mockResolvedValue({
      id: "quote-1",
      rateAmount: "5.2500",
      dimensionSource: "SHIPPING",
      quoteExpiresAt: future,
      isSelected: true,
    });

    const result = await getSelectedQuote("sku-1");
    expect(result).not.toBeNull();
    expect(result!.rateAmount).toBe(5.25);
    expect(result!.dimensionSource).toBe("SHIPPING");
  });

  it("returns null when no selected quote", async () => {
    mockDb.shippingQuote.findFirst.mockResolvedValue(null);
    const result = await getSelectedQuote("sku-1");
    expect(result).toBeNull();
  });
});

describe("selectBestQuote", () => {
  it("deselects all and selects lowest rate", async () => {
    const cheapQuote = { id: "q-cheap", rateAmount: "3.00" };
    mockDb.shippingQuote.findFirst.mockResolvedValue(cheapQuote);
    mockDb.shippingQuote.update.mockResolvedValue({});

    await selectBestQuote("sku-1");

    expect(mockDb.shippingQuote.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerSkuId: "sku-1", isSelected: true },
        data: { isSelected: false },
      })
    );
    expect(mockDb.shippingQuote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q-cheap" },
        data: { isSelected: true },
      })
    );
  });
});
