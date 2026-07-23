import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { Permission } from "@/server/authorization/permissions";
import { logAction, AuditAction } from "./audit-log.service";
import { enqueueRecalculateBatch } from "@/server/jobs/queue";

interface ImportRowData {
  sku?: string;
  sellingPrice?: number | null;
  packageQuantity?: number | null;
  minimumMarginOverride?: number | null;
  customerSkuCode?: string | null;
  notes?: string | null;
  currentCost?: number | null;
  futureCost?: number | null;
}

function parseRow(row: ExcelJS.Row, headers: Record<string, number>): ImportRowData {
  const get = (name: string) => {
    const col = headers[name.toLowerCase()];
    return col !== undefined ? row.getCell(col).value : undefined;
  };

  const toNum = (v: ExcelJS.CellValue) => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : parseFloat(String(v));
    return isNaN(n) ? null : n;
  };

  return {
    sku: String(get("sku") ?? "").trim() || undefined,
    sellingPrice: toNum(get("selling price") as ExcelJS.CellValue),
    packageQuantity: toNum(get("package quantity") as ExcelJS.CellValue),
    minimumMarginOverride: toNum(get("minimum margin override") as ExcelJS.CellValue),
    customerSkuCode: get("customer sku code") ? String(get("customer sku code")).trim() : null,
    notes: get("notes") ? String(get("notes")).trim() : null,
    currentCost: toNum(get("current cost") as ExcelJS.CellValue),
    futureCost: toNum(get("future cost") as ExcelJS.CellValue),
  };
}

export async function createImportBatch(
  file: Buffer,
  filename: string,
  customerId: string,
  userId: string,
  userPermissions: string[]
) {
  // Step 5: Customer access check
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const canEditCost = userPermissions.includes(Permission.EDIT_PRODUCT_COST);

  // Step 1: Create batch
  const batch = await db.importBatch.create({
    data: {
      uploadedById: userId,
      customerId,
      filename,
      status: "PENDING",
    },
  });

  await logAction({
    userId,
    action: AuditAction.IMPORT_STARTED,
    entityType: "ImportBatch",
    entityId: batch.id,
    afterValue: { filename, customerId },
  });

  try {
    // Step 2: Parse
    await db.importBatch.update({ where: { id: batch.id }, data: { status: "VALIDATING" } });

    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(file as any);

    const dataSheet =
      workbook.getWorksheet("Data") ??
      workbook.getWorksheet(2) ??
      workbook.worksheets[0];

    if (!dataSheet) {
      await db.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "FAILED",
          errorSummary: { error: "No data sheet found in workbook" },
        },
      });
      return db.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
    }

    // Read headers (row 1)
    const headerRow = dataSheet.getRow(1);
    const headers: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      if (cell.value) {
        headers[String(cell.value).trim().toLowerCase()] = colNumber;
      }
    });

    if (!headers["sku"]) {
      await db.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "FAILED",
          errorSummary: { error: "No SKU column found in header row" },
        },
      });
      return db.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
    }

    // Collect all data rows
    const rawRows: { rowNumber: number; data: ImportRowData }[] = [];
    dataSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const data = parseRow(row, headers);
      if (data.sku) rawRows.push({ rowNumber, data });
    });

    if (rawRows.length === 0) {
      await db.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "COMPLETE",
          totalRows: 0,
          successRows: 0,
          errorRows: 0,
          skippedRows: 0,
        },
      });
      return db.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
    }

    // Create ImportRow records
    await db.importRow.createMany({
      data: rawRows.map(({ rowNumber, data }) => ({
        batchId: batch.id,
        rowNumber,
        rawData: data as object,
        status: "PENDING",
      })),
    });

    // Step 3–8: Process rows
    await db.importBatch.update({ where: { id: batch.id }, data: { status: "PROCESSING" } });

    let successRows = 0;
    let errorRows = 0;
    let skippedRows = 0;
    const errorSummaryMap: Record<string, number> = {};

    for (const { rowNumber, data } of rawRows) {
      const importRow = await db.importRow.findFirst({
        where: { batchId: batch.id, rowNumber },
      });
      if (!importRow) continue;

      const errors: string[] = [];

      // Step 3: Structure validation
      if (!data.sku) errors.push("SKU is required");
      if (data.sellingPrice != null && data.sellingPrice <= 0)
        errors.push("Selling price must be > 0");
      if (data.packageQuantity != null && (!Number.isInteger(data.packageQuantity) || data.packageQuantity < 1))
        errors.push("Package quantity must be a positive integer");
      if (
        data.minimumMarginOverride != null &&
        (data.minimumMarginOverride < 0 || data.minimumMarginOverride > 100)
      )
        errors.push("Minimum margin override must be between 0 and 100");

      // Step 4: Resolve product
      let productId: string | null = null;
      if (errors.length === 0 && data.sku) {
        const product = await db.product.findFirst({
          where: { sku: data.sku, deletedAt: null },
        });
        if (!product) {
          errors.push(`SKU not found: ${data.sku}`);
        } else {
          productId = product.id;
        }
      }

      // Step 6: Permission check on cost fields
      if ((data.currentCost != null || data.futureCost != null) && !canEditCost) {
        errors.push("Not authorized to set cost fields");
      }

      if (errors.length > 0) {
        await db.importRow.update({
          where: { id: importRow.id },
          data: { status: "ERROR", errors: errors as unknown as object },
        });
        for (const e of errors) {
          errorSummaryMap[e] = (errorSummaryMap[e] ?? 0) + 1;
        }
        errorRows++;
        continue;
      }

      // Step 7: Business rule — skip unchanged rows
      const existingSku = productId
        ? await db.customerSku.findFirst({
            where: { customerId, productId, deletedAt: null },
          })
        : null;

      if (
        existingSku &&
        data.sellingPrice != null &&
        Number(existingSku.sellingPrice) === data.sellingPrice
      ) {
        await db.importRow.update({
          where: { id: importRow.id },
          data: { status: "SKIPPED" },
        });
        skippedRows++;
        continue;
      }

      // Step 8: Upsert
      try {
        if (existingSku) {
          const priceChanged =
            data.sellingPrice != null &&
            Number(existingSku.sellingPrice) !== data.sellingPrice;

          await db.customerSku.update({
            where: { id: existingSku.id },
            data: {
              ...(data.sellingPrice != null && { sellingPrice: data.sellingPrice }),
              ...(data.packageQuantity != null && { packageQuantity: data.packageQuantity }),
              ...(data.minimumMarginOverride !== undefined && {
                minimumMarginOverride: data.minimumMarginOverride,
              }),
              ...(data.customerSkuCode !== undefined && { customerSkuCode: data.customerSkuCode }),
              ...(data.notes !== undefined && { notes: data.notes }),
            },
          });

          if (priceChanged && data.sellingPrice != null) {
            await db.customerPriceHistory.create({
              data: {
                customerSkuId: existingSku.id,
                sellingPrice: data.sellingPrice,
                effectiveDate: new Date(),
                recordedById: userId,
              },
            });
          }

          await logAction({
            userId,
            action: AuditAction.PRICE_CHANGED,
            entityType: "CustomerSku",
            entityId: existingSku.id,
            afterValue: { sellingPrice: data.sellingPrice },
            importBatchId: batch.id,
          });
        } else if (productId) {
          const newSku = await db.customerSku.create({
            data: {
              customerId,
              productId,
              sellingPrice: data.sellingPrice ?? null,
              packageQuantity: data.packageQuantity ?? 1,
              minimumMarginOverride: data.minimumMarginOverride ?? null,
              customerSkuCode: data.customerSkuCode ?? null,
              notes: data.notes ?? null,
            },
          });

          if (data.sellingPrice != null) {
            await db.customerPriceHistory.create({
              data: {
                customerSkuId: newSku.id,
                sellingPrice: data.sellingPrice,
                effectiveDate: new Date(),
                recordedById: userId,
              },
            });
          }

          await logAction({
            userId,
            action: AuditAction.PRICE_CHANGED,
            entityType: "CustomerSku",
            entityId: newSku.id,
            afterValue: { sellingPrice: data.sellingPrice },
            importBatchId: batch.id,
          });
        }

        await db.importRow.update({
          where: { id: importRow.id },
          data: { status: "SUCCESS" },
        });
        successRows++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        await db.importRow.update({
          where: { id: importRow.id },
          data: { status: "ERROR", errors: [msg] as unknown as object },
        });
        errorSummaryMap[msg] = (errorSummaryMap[msg] ?? 0) + 1;
        errorRows++;
      }
    }

    // Step 9: enqueue recalculation for all successfully imported SKUs
    const successfulSkuIds: string[] = [];
    for (const { rowNumber } of rawRows) {
      const importRow = await db.importRow.findFirst({ where: { batchId: batch.id, rowNumber } });
      if (importRow?.status === "SUCCESS") {
        // Find the CustomerSku that was upserted for this row
        const rawData = importRow.rawData as { sku?: string };
        if (rawData.sku) {
          const product = await db.product.findFirst({ where: { sku: rawData.sku, deletedAt: null } });
          if (product) {
            const cSku = await db.customerSku.findFirst({ where: { customerId, productId: product.id, deletedAt: null } });
            if (cSku) successfulSkuIds.push(cSku.id);
          }
        }
      }
    }
    if (successfulSkuIds.length > 0) {
      try {
        await enqueueRecalculateBatch(successfulSkuIds, userId);
      } catch {
        // Non-fatal: worker may not be running in dev
      }
    }

    // Step 10: Report
    const errorSummaryEntries = Object.entries(errorSummaryMap).slice(0, 100);
    const errorSummary =
      errorSummaryEntries.length > 0 ? Object.fromEntries(errorSummaryEntries) : null;

    await db.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMPLETE",
        totalRows: rawRows.length,
        successRows,
        errorRows,
        skippedRows,
        errorSummary: errorSummary as object ?? undefined,
      },
    });

    await logAction({
      userId,
      action: AuditAction.IMPORT_COMMITTED,
      entityType: "ImportBatch",
      entityId: batch.id,
      afterValue: { successRows, errorRows, skippedRows },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await db.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        errorSummary: { error: msg } as object,
      },
    });
  }

  return db.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
}

export async function getImportBatch(batchId: string, userId: string) {
  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
  });
  if (!batch || batch.uploadedById !== userId) {
    return null;
  }
  return batch;
}

export async function listImportBatches(userId: string) {
  return db.importBatch.findMany({
    where: { uploadedById: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
