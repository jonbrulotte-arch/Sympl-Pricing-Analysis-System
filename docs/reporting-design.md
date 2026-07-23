# Reporting Design

## Report Delivery Modes

| Mode | Trigger | Audience |
|---|---|---|
| Scheduled weekly report | pg-boss cron job (Monday 6 AM) | Configured recipient list |
| On-demand export | User action in ROI grid | Requesting user |
| Selected-row export | User selects rows, clicks Export | Requesting user |

---

## Excel Workbook Structure

All reports are generated as `.xlsx` files using exceljs with streaming support for large datasets.

### Worksheets

**Sheet 1: Summary**
- Portfolio overview: total customers, SKUs analyzed, alerts by severity
- Top 10 SKUs by margin variance (descending)
- Count of SKUs below minimum margin
- Generated date/time in cell A1

**Sheet 2–N: Per-Customer Sheets**
- One sheet per customer in the report (named by customer code, truncated to 31 chars)
- Columns match the ROI grid: SKU, Product Name, Selling Price, Net Revenue, Contribution Margin %, Alert Status, Review Status, Last Calculated
- Cost columns (Product Cost, Total Variable Cost, Contribution Profit) included only for recipients with `view_product_cost`
- Each sheet has frozen panes (row 1, column 1) and auto-filter enabled

### Formatting Standards

| Data Type | Number Format |
|---|---|
| Currency (selling price, cost, profit) | `$#,##0.0000` |
| Percentage (margin %) | `0.00%` |
| Date | `YYYY-MM-DD` |
| Timestamp | `YYYY-MM-DD HH:MM` |

Alert status cells use conditional fill color:
- CRITICAL → red fill (`#FEE2E2`)
- HIGH → orange fill (`#FED7AA`)
- WARNING → yellow fill (`#FEF9C3`)
- OK → no fill

---

## ReportService

`src/server/services/report.service.ts` is the sole entry point for report generation:

```typescript
async function generateReport(params: {
  customerIds: string[];
  recipientUserId: string;        // determines cost visibility
  format: "xlsx";
  reportType: "scheduled" | "on_demand";
}): Promise<Buffer>
```

Internally:
1. Queries all CustomerSkus for the specified customers with their latest CalculationResult.
2. Applies `stripCostFields()` for the recipient's permissions.
3. Builds the workbook using exceljs, then calls `workbook.xlsx.writeBuffer()`.
4. Returns the buffer (not written to disk — streamed to response or emailed as attachment).

---

## Scheduled Report Configuration

`ScheduledReport` records define recurring reports:

| Field | Description |
|---|---|
| `name` | Display name (e.g. "Weekly Portfolio Report") |
| `cronExpression` | e.g. `0 6 * * 1` (Monday 6 AM UTC) |
| `recipientUserIds` | Array of user IDs; each recipient's cost visibility is checked individually |
| `includeCustomerIds` | Empty array = all customers accessible to each recipient |
| `isActive` | Toggle without deleting |

Each recipient gets a personalized workbook: if recipient A has `view_product_cost` and recipient B does not, two separate workbooks are generated. They are not sent the same file.

---

## pg-boss Scheduled Report Job

Job name: `generate-scheduled-report`

Cron is registered at worker startup:

```typescript
await boss.schedule("generate-scheduled-report", "0 6 * * 1", {});
```

Worker handler:
1. Loads all active `ScheduledReport` records.
2. For each report, groups recipients by cost visibility.
3. Calls `generateReport()` once per visibility group.
4. Sends the workbook to each recipient in the group via nodemailer.
5. Writes a `ReportDeliveryLog` row per recipient.
6. Updates `ScheduledReport.lastRunAt`.

---

## On-Demand Export Flow

**Request:** `POST /api/exports` — requires `export_data` permission.

Request body:
```json
{
  "customerIds": ["uuid1", "uuid2"],
  "filters": {
    "alertStatus": ["CRITICAL", "HIGH"],
    "reviewStatus": ["PENDING"]
  },
  "selectedSkuIds": ["uuid3", "uuid4"]   // optional — if present, only export these rows
}
```

Response: binary `.xlsx` file with content-disposition `attachment; filename="sympl-export-YYYY-MM-DD.xlsx"`.

The handler:
1. Validates the user has `export_data` and access to all requested customers.
2. Applies all filters.
3. Calls `generateReport()` with the filtered CustomerSku IDs.
4. Streams the buffer as the HTTP response.

---

## Report Delivery Log

Every report delivery attempt is recorded in `ReportDeliveryLog`:

- **PENDING** → report queued
- **GENERATING** → workbook is being built
- **DELIVERED** → email sent successfully (for scheduled) or response streamed (for on-demand)
- **FAILED** → error recorded in `errorMessage`; the report is re-queued once on failure

Administrators can view delivery logs in the admin panel to diagnose failed reports.

---

## Cost Field Security in Reports

The report pipeline enforces the same rules as the API:

1. `ReportService` receives the recipient's `userPermissions`.
2. Before writing each data row, `stripCostFields()` is called.
3. If the recipient lacks `view_product_cost`, the cost worksheet columns are omitted entirely — not blanked — so the column count differs between reports.
4. Administrators reviewing a report cannot infer another user's cost visibility from the file structure.

This is tested by generating a report for a user without `view_product_cost` and asserting the workbook contains no cost column headers.
