import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("exceljs", () => {
  const MockWorkbook = vi.fn().mockImplementation(() => ({
    xlsx: { load: vi.fn() },
    getWorksheet: vi.fn().mockReturnValue(null),
    worksheets: [],
  }));
  return { default: { Workbook: MockWorkbook } };
});

vi.mock("@/lib/db", () => ({
  db: {
    importBatch: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    importRow: {
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
    product: { findFirst: vi.fn(), update: vi.fn() },
    customerSku: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    customerPriceHistory: { create: vi.fn() },
    customerAssignment: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/jobs/queue", () => ({
  enqueueRecalculateBatch: vi.fn(),
}));

import { db } from "@/lib/db";
import {
  validateImportRow,
  listImportBatches,
  getImportBatch,
  cancelImportBatch,
} from "@/server/services/import.service";

const mockDb = db as unknown as {
  importBatch: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  importRow: {
    createMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  product: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  customerSku: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  customerPriceHistory: { create: ReturnType<typeof vi.fn> };
  customerAssignment: { findUnique: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
};

const baseBatch = {
  id: "batch-1",
  uploadedById: "user-1",
  customerId: "cust-1",
  filename: "import.xlsx",
  status: "COMPLETE",
  totalRows: 2,
  successRows: 2,
  errorRows: 0,
  skippedRows: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.customerAssignment.findUnique.mockResolvedValue({ userId: "user-1", customerId: "cust-1" });
  mockDb.importBatch.create.mockResolvedValue({ ...baseBatch, status: "PENDING" });
  mockDb.importBatch.update.mockResolvedValue(baseBatch);
  mockDb.importBatch.findUniqueOrThrow.mockResolvedValue(baseBatch);
  mockDb.importBatch.findUnique.mockResolvedValue(baseBatch);
  mockDb.importRow.createMany.mockResolvedValue({ count: 2 });
  mockDb.importRow.update.mockResolvedValue({});
  mockDb.importRow.updateMany.mockResolvedValue({ count: 1 });
  mockDb.importRow.findFirst.mockResolvedValue({ id: "row-1", status: "PENDING", rawData: { sku: "SKU-001" } });
  mockDb.product.findFirst.mockResolvedValue({ id: "prod-1", sku: "SKU-001" });
  mockDb.product.update.mockResolvedValue({});
  mockDb.customerSku.findFirst.mockResolvedValue(null);
  mockDb.customerSku.findUnique.mockResolvedValue(null);
  mockDb.customerSku.create.mockResolvedValue({ id: "csku-1" });
  mockDb.customerSku.update.mockResolvedValue({});
  mockDb.customerPriceHistory.create.mockResolvedValue({});
  mockDb.auditLog.create.mockResolvedValue({});
});

// ─────────────────────────────────────────────────────────────
// validateImportRow
// ─────────────────────────────────────────────────────────────

describe("validateImportRow", () => {
  it("returns SKU required error when sku is missing", () => {
    const errors = validateImportRow({});
    expect(errors).toContain("SKU is required");
  });

  it("returns no errors for a valid row with all fields", () => {
    const errors = validateImportRow({
      sku: "SKU-001",
      sellingPrice: 25.0,
      packageQuantity: 12,
      minimumMarginOverride: 15,
      customerSkuCode: "CUST-A",
      notes: null,
    });
    expect(errors).toHaveLength(0);
  });

  it("returns no errors when optional numeric fields are null", () => {
    const errors = validateImportRow({ sku: "SKU-001" });
    expect(errors).toHaveLength(0);
  });

  it("rejects negative selling price", () => {
    const errors = validateImportRow({ sku: "SKU-001", sellingPrice: -1 });
    expect(errors.some((e: string) => e.includes("Selling Price"))).toBe(true);
  });

  it("rejects zero selling price", () => {
    const errors = validateImportRow({ sku: "SKU-001", sellingPrice: 0 });
    expect(errors.some((e: string) => e.includes("Selling Price"))).toBe(true);
  });

  it("rejects non-integer package quantity", () => {
    const errors = validateImportRow({ sku: "SKU-001", packageQuantity: 1.5 });
    expect(errors.some((e: string) => e.includes("Package Quantity"))).toBe(true);
  });

  it("rejects package quantity of 0", () => {
    const errors = validateImportRow({ sku: "SKU-001", packageQuantity: 0 });
    expect(errors.some((e: string) => e.includes("Package Quantity"))).toBe(true);
  });

  it("rejects minimum margin override > 100", () => {
    const errors = validateImportRow({ sku: "SKU-001", minimumMarginOverride: 101 });
    expect(errors.some((e: string) => e.includes("Minimum Margin Override"))).toBe(true);
  });

  it("accepts minimum margin override of 0", () => {
    const errors = validateImportRow({ sku: "SKU-001", minimumMarginOverride: 0 });
    expect(errors).toHaveLength(0);
  });

  it("rejects negative current cost", () => {
    const errors = validateImportRow({ sku: "SKU-001", currentCost: -5 });
    expect(errors.some((e: string) => e.includes("Current Cost"))).toBe(true);
  });

  it("rejects negative future cost", () => {
    const errors = validateImportRow({ sku: "SKU-001", futureCost: -0.01 });
    expect(errors.some((e: string) => e.includes("Future Cost"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// listImportBatches
// ─────────────────────────────────────────────────────────────

describe("listImportBatches", () => {
  it("returns batches for the given user", async () => {
    mockDb.importBatch.findMany.mockResolvedValue([baseBatch]);
    const result = await listImportBatches("user-1");
    expect(mockDb.importBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { uploadedById: "user-1" } })
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("batch-1");
  });

  it("returns empty array when user has no batches", async () => {
    mockDb.importBatch.findMany.mockResolvedValue([]);
    const result = await listImportBatches("user-99");
    expect(result).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// getImportBatch
// ─────────────────────────────────────────────────────────────

describe("getImportBatch", () => {
  it("returns batch when owner matches", async () => {
    mockDb.importBatch.findUnique.mockResolvedValue(baseBatch);
    const result = await getImportBatch("batch-1", "user-1");
    expect(result).not.toBeNull();
    expect(result?.id).toBe("batch-1");
  });

  it("returns null when batch belongs to different user", async () => {
    mockDb.importBatch.findUnique.mockResolvedValue({ ...baseBatch, uploadedById: "user-99" });
    const result = await getImportBatch("batch-1", "user-1");
    expect(result).toBeNull();
  });

  it("returns null when batch does not exist", async () => {
    mockDb.importBatch.findUnique.mockResolvedValue(null);
    const result = await getImportBatch("batch-x", "user-1");
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// cancelImportBatch
// ─────────────────────────────────────────────────────────────

describe("cancelImportBatch", () => {
  it("cancels a PENDING batch", async () => {
    mockDb.importBatch.findUnique.mockResolvedValue({ ...baseBatch, status: "PENDING" });
    await cancelImportBatch("batch-1", "user-1");
    expect(mockDb.importBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "batch-1" },
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
  });

  it("cancels a VALIDATING batch", async () => {
    mockDb.importBatch.findUnique.mockResolvedValue({ ...baseBatch, status: "VALIDATING" });
    await cancelImportBatch("batch-1", "user-1");
    expect(mockDb.importBatch.update).toHaveBeenCalled();
  });

  it("throws when batch is already COMPLETE", async () => {
    mockDb.importBatch.findUnique.mockResolvedValue({ ...baseBatch, status: "COMPLETE" });
    await expect(cancelImportBatch("batch-1", "user-1")).rejects.toThrow("Cannot cancel");
  });

  it("throws when batch is in PROCESSING state", async () => {
    mockDb.importBatch.findUnique.mockResolvedValue({ ...baseBatch, status: "PROCESSING" });
    await expect(cancelImportBatch("batch-1", "user-1")).rejects.toThrow("Cannot cancel");
  });

  it("throws when batch not found", async () => {
    mockDb.importBatch.findUnique.mockResolvedValue(null);
    await expect(cancelImportBatch("batch-x", "user-1")).rejects.toThrow("not found");
  });

  it("throws when batch belongs to different user", async () => {
    mockDb.importBatch.findUnique.mockResolvedValue({ ...baseBatch, uploadedById: "user-99" });
    await expect(cancelImportBatch("batch-1", "user-1")).rejects.toThrow("not found");
  });
});
