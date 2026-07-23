# Cost Visibility Authorization Rules

## Sensitive Fields

The following fields are classified as confidential cost data and are subject to the `view_product_cost` permission gate:

| Field | Table/Context |
|---|---|
| `currentCost` | Product |
| `futureCost` | Product |
| `costEffectiveDate` | Product |
| `futureCostEffectiveDate` | Product |
| `costSource` | Product |
| `productCost` | CalculationResult |
| Cost history entries | ProductCostHistory |

## Enforcement

Cost fields are stripped at the **service layer** by `src/server/authorization/check-cost-visibility.ts::stripCostFields()` before data is returned from any service function. This means the fields are removed before they ever reach the API route handler, the front end, or a log.

### Service layer pattern

```typescript
// In any service that returns product data:
const product = await db.product.findUnique({ where: { id } });
return stripCostFields(product, session.permissions);
// → cost fields absent for users without view_product_cost
```

### Report and export pipeline

Before writing any row to an Excel export or scheduled report, the `stripCostFields()` function is applied to the data record. The report generator must not receive raw cost data if the recipient lacks `view_product_cost`.

### API responses

No API endpoint may return cost fields in its JSON response for users without `view_product_cost`. This is enforced by the service layer, not by hiding UI columns.

## What Unauthorized Users CAN See

Users without `view_product_cost` may still see:
- `view_calculated_margin`: gross margin %, contribution margin %
- Alert status (below/above margin threshold)
- Margin variance (how far above/below the minimum)

They must NOT be able to reverse-engineer the cost from the margin and the selling price. Verify this is not possible given the data exposed.

## Import/Export Attack Prevention

When importing pricing data:
- An unauthorized user must not be able to infer product cost by importing a price and observing the resulting margin change
- The import service must re-derive cost from the database (not from import input) when calculating margins
- Cost fields in export templates must be omitted for users without `view_product_cost`
- Validation must reject any attempt by an unauthorized user to set cost fields via import

## Logging

Cost values must not appear in application logs, error messages, or audit log `beforeValue`/`afterValue` fields in a form readable by users without `view_product_cost`. Audit log access itself is restricted to Administrators via `view_audit_log`.

## Testing Requirements

1. `GET /api/products/:id` response contains `currentCost` for users with `view_product_cost`
2. `GET /api/products/:id` response does NOT contain `currentCost` for users without `view_product_cost`
3. A Pricing Analyst granted `view_product_cost` via `UserPermission` CAN see cost fields
4. Exported file does not contain cost column for users without `view_product_cost`
5. Browser developer tools inspection of API response confirms cost field absence
