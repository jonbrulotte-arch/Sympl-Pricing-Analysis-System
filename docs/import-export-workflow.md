# Import / Export Workflow

## Overview

The import/export system moves customer-SKU pricing data between Excel files and the database. It enforces the same permission rules as the API: cost fields are omitted from exports and rejected in imports for users without `view_product_cost`.

---

## Export: Template Generation

Before importing, analysts download an Excel template pre-populated with the customer's existing data.

**Template contents:**
- **Instructions sheet** — column definitions, valid values, formatting rules
- **Data sheet** — one row per existing CustomerSku with editable columns pre-filled
- **Reference sheet** — active products, SKU numbers, category names (read-only)

**Column visibility by permission:**

| Column | Required Permission |
|---|---|
| Selling Price | `manage_customer_skus` |
| Package Quantity | `manage_customer_skus` |
| Minimum Margin Override | `manage_customer_skus` |
| Current Cost | `view_product_cost` |
| Future Cost | `view_product_cost` |

Users without `view_product_cost` receive a template with cost columns omitted. The column letters shift accordingly so the import parser does not rely on column position — it reads by header name.

---

## Import: 10-Step Loop

### Step 1: Upload

User uploads an Excel file via `POST /api/imports`. The route handler:
1. Validates the file is `.xlsx` (rejects `.xls`, `.csv`).
2. Reads the file into memory using exceljs.
3. Creates an `ImportBatch` record with `status = PENDING`.
4. Enqueues a `data-import` pg-boss job with the batch ID.
5. Returns the batch ID to the client for polling.

### Step 2: Parse

The worker job reads the data sheet using exceljs:
- Reads rows starting at row 2 (row 1 = headers).
- Maps header names to field names (case-insensitive, whitespace-trimmed).
- Creates an `ImportRow` record for each row with `rawData = JSON`.
- Updates `ImportBatch.status = VALIDATING`.

### Step 3: Validate Structure

For each row, the validation layer checks:
- Required columns are present.
- Numeric fields contain parseable numbers.
- Enum fields contain valid enum values.
- SKU column is not blank.

Rows with structural errors are marked `status = ERROR` with error details in `ImportRow.errors`.

### Step 4: Resolve Products

For each structurally valid row:
- Look up `Product` by SKU code.
- If no product found, mark row `ERROR: SKU not found`.
- Store the resolved `productId` in the row's processing state.

### Step 5: Resolve Customer

The import batch belongs to a customer (passed as a query parameter at upload time):
- Verify the importing user has access to that customer (`checkCustomerAccess`).
- Look up the `Customer` record; reject the whole batch if not found or not accessible.

### Step 6: Permission Checks

For each row, re-validate cost fields:
- If the row contains `currentCost` or `futureCost` and the user lacks `view_product_cost`, mark the row `ERROR: not authorized to set cost fields`.
- This prevents an attacker from inferring cost by uploading a price and observing the calculated margin.

### Step 7: Business Rule Validation

For each row passing steps 3–6:
- Selling price must be > 0.
- Package quantity must be a positive integer.
- Minimum margin override must be between 0 and 100 if provided.
- If a `CustomerSku` for this customer + product already exists and `sellingPrice` is unchanged, the row is marked `SKIPPED` (no-op).

### Step 8: Upsert

For each row passing all validations:
- If a `CustomerSku` exists for (customerId, productId): update the editable fields.
- If not: create a new `CustomerSku`.
- Write a `CustomerPriceHistory` row for any price change.
- Write cost history row if cost fields changed and user has `view_product_cost`.
- Log an audit record for each row processed.
- Mark row `status = SUCCESS`.

### Step 9: Recalculation

After all rows are processed:
- Enqueue a `recalculate-batch` pg-boss job for all successfully upserted CustomerSku IDs.
- This is non-blocking — the import batch is marked `COMPLETE` before recalculation finishes.

### Step 10: Report

Update `ImportBatch`:
- `status = COMPLETE` (even if some rows errored — partial success is allowed).
- `totalRows`, `successRows`, `errorRows` counts.
- `errorSummary` JSONB: first 100 error messages grouped by error type.

The client polls `GET /api/imports/:batchId` to check status and display results.

---

## Export: On-Demand

Users with `export_data` permission may export the current ROI grid data to Excel.

**Endpoint:** `POST /api/exports` with filter parameters.

**Process:**
1. Run the same query as the ROI grid with the user's current filters.
2. Apply `stripCostFields()` for users without `view_product_cost`.
3. Build an Excel workbook using exceljs:
   - Freeze panes: row 1 and column 1.
   - Auto-filter on all columns.
   - Number formats: currency cells use `$#,##0.0000`; percentage cells use `0.00%`.
4. Stream the workbook to the response with content-type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

**Selected-row export:** The ROI grid checkboxes allow selecting specific rows. The export payload includes the selected CustomerSku IDs; the export query adds a `WHERE id IN (...)` clause.

---

## Security Rules

| Rule | Enforcement |
|---|---|
| Cost columns omitted without `view_product_cost` | Service layer — `stripCostFields()` applied before Excel row is written |
| Cost fields rejected in import without `view_product_cost` | Import Step 6 |
| Cost re-derived from DB, never from import | Import Step 8 — cost from DB is used for margin calculation, not from the import file |
| Customer isolation on import | Import Step 5 — `checkCustomerAccess()` |
| Customer isolation on export | Export query filters by `getAssignedCustomerIds()` unless `global_customer_access` |

---

## File Retention

Uploaded import files are not persisted to disk after parsing (Step 2). The `ImportBatch` and `ImportRow` records serve as the durable record of what was imported and why rows succeeded or failed.

Exported files are generated on demand and streamed directly to the response; no file is written to disk.
