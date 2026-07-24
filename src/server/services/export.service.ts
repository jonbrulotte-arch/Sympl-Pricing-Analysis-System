import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { canViewProductCost } from "@/server/authorization/check-cost-visibility";
import { logAction, AuditAction } from "./audit-log.service";

export async function generateImportTemplate(
  customerId: string,
  userId: string,
  userPermissions: string[]
): Promise<Buffer> {
  const hasAccess = await checkCustomerAccess(userId, customerId, userPermissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const showCost = canViewProductCost(userPermissions);

  const [customer, customerSkus, products] = await Promise.all([
    db.customer.findUniqueOrThrow({ where: { id: customerId } }),
    db.customerSku.findMany({
      where: { customerId, deletedAt: null },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    }),
    db.product.findMany({
      where: { isActive: true, deletedAt: null },
      include: { category: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sympl PAS";
  workbook.created = new Date();

  // ── Instructions sheet ──────────────────────────────────────────────────────
  const instructionsSheet = workbook.addWorksheet("Instructions");
  instructionsSheet.getColumn(1).width = 30;
  instructionsSheet.getColumn(2).width = 60;

  instructionsSheet.addRow(["Sympl Pricing Analysis — Import Template"]).font = {
    bold: true,
    size: 14,
  };
  instructionsSheet.addRow([]);
  instructionsSheet.addRow(["Customer:", customer.name]);
  instructionsSheet.addRow(["Generated:", new Date().toISOString().split("T")[0]]);
  instructionsSheet.addRow([]);
  instructionsSheet.addRow(["Column", "Description"]).font = { bold: true };
  instructionsSheet.addRow(["SKU", "Required. Product SKU code from the Reference sheet."]);
  instructionsSheet.addRow(["Selling Price", "Price charged to this customer. Must be > 0."]);
  instructionsSheet.addRow(["Package Quantity", "Units per package (positive integer)."]);
  instructionsSheet.addRow([
    "Minimum Margin Override",
    "Override for this SKU only (0–100). Leave blank to use customer default.",
  ]);
  instructionsSheet.addRow(["Customer SKU Code", "Customer's internal SKU code (optional)."]);
  instructionsSheet.addRow(["Notes", "Free-text notes (optional)."]);
  if (showCost) {
    instructionsSheet.addRow(["Current Cost", "Product cost. Authorized users only."]);
    instructionsSheet.addRow(["Future Cost", "Upcoming product cost. Authorized users only."]);
  }

  // ── Data sheet ───────────────────────────────────────────────────────────────
  const dataSheet = workbook.addWorksheet("Data");

  const columns: Partial<ExcelJS.Column>[] = [
    { header: "SKU", key: "sku", width: 18 },
    { header: "Product Name", key: "productName", width: 30 },
    { header: "Selling Price", key: "sellingPrice", width: 16, style: { numFmt: "$#,##0.0000" } },
    { header: "Package Quantity", key: "packageQuantity", width: 18 },
    { header: "Minimum Margin Override", key: "minimumMarginOverride", width: 24 },
    { header: "Customer SKU Code", key: "customerSkuCode", width: 20 },
    { header: "Notes", key: "notes", width: 30 },
  ];

  if (showCost) {
    columns.push(
      { header: "Current Cost", key: "currentCost", width: 16, style: { numFmt: "$#,##0.0000" } },
      { header: "Future Cost", key: "futureCost", width: 16, style: { numFmt: "$#,##0.0000" } }
    );
  }

  dataSheet.columns = columns;
  dataSheet.getRow(1).font = { bold: true };
  dataSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9E1F2" },
  };
  dataSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  for (const csku of customerSkus) {
    const row: Record<string, unknown> = {
      sku: csku.product.sku,
      productName: csku.product.name,
      sellingPrice: csku.sellingPrice ? Number(csku.sellingPrice) : null,
      packageQuantity: csku.packageQuantity,
      minimumMarginOverride: csku.minimumMarginOverride
        ? Number(csku.minimumMarginOverride)
        : null,
      customerSkuCode: csku.customerSkuCode ?? null,
      notes: csku.notes ?? null,
    };

    if (showCost) {
      row.currentCost = csku.product.currentCost ? Number(csku.product.currentCost) : null;
      row.futureCost = csku.product.futureCost ? Number(csku.product.futureCost) : null;
    }

    dataSheet.addRow(row);
  }

  dataSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  // ── Reference sheet ──────────────────────────────────────────────────────────
  const refSheet = workbook.addWorksheet("Reference");
  refSheet.columns = [
    { header: "SKU", key: "sku", width: 18 },
    { header: "Product Name", key: "name", width: 30 },
    { header: "Brand", key: "brand", width: 20 },
    { header: "Category", key: "category", width: 24 },
    { header: "Unit of Measure", key: "unitOfMeasure", width: 18 },
  ];
  refSheet.getRow(1).font = { bold: true };
  refSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2EFDA" },
  };
  refSheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

  for (const p of products) {
    refSheet.addRow({
      sku: p.sku,
      name: p.name,
      brand: p.brand ?? "",
      category: p.category?.name ?? "",
      unitOfMeasure: p.unitOfMeasure ?? "",
    });
  }

  refSheet.protect("", { selectLockedCells: true, selectUnlockedCells: false });

  await logAction({
    userId,
    action: AuditAction.EXPORT_GENERATED,
    entityType: "Customer",
    entityId: customerId,
    afterValue: { templateType: "import", rowCount: customerSkus.length },
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
