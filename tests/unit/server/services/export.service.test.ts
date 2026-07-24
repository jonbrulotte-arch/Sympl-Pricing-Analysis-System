import { describe, it, expect, vi, beforeEach } from "vitest";

const { MockWorkbook } = vi.hoisted(() => {
  class MockWorksheet {
    columns: unknown[] = [];
    views: unknown[] = [];
    autoFilter: unknown = null;
    addRow = vi.fn().mockReturnValue({ font: {} });
    getRow = vi.fn().mockReturnValue({ font: {}, fill: {} });
    getColumn = vi.fn().mockReturnValue({ width: 0 });
    protect = vi.fn();
  }

  class MockWorkbook {
    creator = "";
    created: Date | null = null;
    worksheets: MockWorksheet[] = [];
    xlsx = {
      writeBuffer: vi.fn().mockResolvedValue(Buffer.from("test")),
    };
    addWorksheet = vi.fn().mockImplementation(() => {
      const ws = new MockWorksheet();
      this.worksheets.push(ws);
      return ws;
    });
  }

  return { MockWorkbook };
});

vi.mock("exceljs", () => ({
  default: { Workbook: MockWorkbook },
}));

vi.mock("@/lib/db", () => ({
  db: {
    customer: { findUniqueOrThrow: vi.fn() },
    customerSku: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/authorization/check-customer-access", () => ({
  checkCustomerAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/server/authorization/check-cost-visibility", () => ({
  canViewProductCost: vi.fn().mockReturnValue(true),
}));

import { db } from "@/lib/db";
import { generateImportTemplate } from "@/server/services/export.service";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { canViewProductCost } from "@/server/authorization/check-cost-visibility";
import { ForbiddenError } from "@/lib/errors";

const mockDb = db as unknown as {
  customer: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
  customerSku: { findMany: ReturnType<typeof vi.fn> };
  product: { findMany: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const mockCheckAccess = checkCustomerAccess as ReturnType<typeof vi.fn>;
const mockCanViewCost = canViewProductCost as ReturnType<typeof vi.fn>;

const CID = "c1";
const UID = "u1";
const PERMS = ["manage_customers"];

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckAccess.mockResolvedValue(true);
  mockCanViewCost.mockReturnValue(true);
});

describe("generateImportTemplate", () => {
  const customer = { id: CID, name: "Acme Corp" };
  const skus = [
    {
      id: "csku1",
      sellingPrice: "25.50",
      packageQuantity: 12,
      minimumMarginOverride: null,
      customerSkuCode: "ACM-001",
      notes: null,
      product: {
        sku: "P-100",
        name: "Widget A",
        currentCost: "15.00",
        futureCost: null,
      },
    },
  ];
  const products = [
    {
      sku: "P-100",
      name: "Widget A",
      brand: "BrandX",
      unitOfMeasure: "EA",
      category: { name: "Parts" },
    },
  ];

  it("returns a Buffer", async () => {
    mockDb.customer.findUniqueOrThrow.mockResolvedValue(customer);
    mockDb.customerSku.findMany.mockResolvedValue(skus);
    mockDb.product.findMany.mockResolvedValue(products);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await generateImportTemplate(CID, UID, PERMS);

    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("queries customer, SKUs, and products", async () => {
    mockDb.customer.findUniqueOrThrow.mockResolvedValue(customer);
    mockDb.customerSku.findMany.mockResolvedValue(skus);
    mockDb.product.findMany.mockResolvedValue(products);
    mockDb.auditLog.create.mockResolvedValue({});

    await generateImportTemplate(CID, UID, PERMS);

    expect(mockDb.customer.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: CID },
    });
    expect(mockDb.customerSku.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: CID, deletedAt: null },
      })
    );
  });

  it("logs the export action", async () => {
    mockDb.customer.findUniqueOrThrow.mockResolvedValue(customer);
    mockDb.customerSku.findMany.mockResolvedValue(skus);
    mockDb.product.findMany.mockResolvedValue(products);
    mockDb.auditLog.create.mockResolvedValue({});

    await generateImportTemplate(CID, UID, PERMS);

    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "EXPORT_GENERATED",
          entityType: "Customer",
          entityId: CID,
        }),
      })
    );
  });

  it("throws ForbiddenError when access is denied", async () => {
    mockCheckAccess.mockResolvedValueOnce(false);

    await expect(
      generateImportTemplate(CID, UID, PERMS)
    ).rejects.toThrow(ForbiddenError);
  });

  it("generates template with empty SKU list", async () => {
    mockDb.customer.findUniqueOrThrow.mockResolvedValue(customer);
    mockDb.customerSku.findMany.mockResolvedValue([]);
    mockDb.product.findMany.mockResolvedValue(products);
    mockDb.auditLog.create.mockResolvedValue({});

    const result = await generateImportTemplate(CID, UID, PERMS);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          afterValue: expect.objectContaining({ rowCount: 0 }),
        }),
      })
    );
  });
});
