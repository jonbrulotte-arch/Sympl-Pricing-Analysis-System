# Profitability Formula Specification

## Default Calculation

```
Net Revenue = Selling Price − Revenue-Based Allowances
  where Revenue-Based Allowances = sum of all CustomerAllocations with
        calculationType IN (PERCENT_OF_SELLING_PRICE, PERCENT_OF_NET_REVENUE)
        and isActive = true and effectiveDate ≤ today and (expirationDate IS NULL or expirationDate > today)

Total Variable Cost =
    Product Cost
  + Seller-Paid Shipping Cost  (only if customer.shippingTerms = PREPAID or customer-SKU override)
  + Fixed Per-Unit Costs       (sum of FIXED_PER_UNIT allocations × quantity)
  + Other Per-Unit Costs       (other applicable allocation types)

Contribution Profit = Net Revenue − Total Variable Cost

Contribution Margin % = Contribution Profit / Net Revenue × 100
```

## Configurable Denominator

Some companies calculate margin using gross selling price rather than net revenue. The `CustomerMarginRequirement.calculationMethod` field controls the denominator:

| Method | Denominator |
|---|---|
| `CONTRIBUTION_MARGIN` (default) | Net Revenue (after revenue-based allowances) |
| `GROSS_MARGIN` | Gross Selling Price |

## Allocation Types and Calculation Basis

| `calculationType` | Formula |
|---|---|
| `PERCENT_OF_SELLING_PRICE` | rate × selling_price |
| `PERCENT_OF_NET_REVENUE` | rate × net_revenue |
| `PERCENT_OF_COST` | rate × product_cost |
| `FIXED_PER_UNIT` | amount × package_quantity |
| `FIXED_PER_ORDER` | amount (once per order) |
| `FIXED_PER_SHIPMENT` | amount (once per shipment) |
| `FIXED_PER_SKU` | amount (once per SKU) |
| `CUSTOM` | defined in allocation record notes |

## Calculation Precedence

Rules are applied with this precedence (highest wins):

1. Customer-SKU manual override (`CustomerSku.minimumMarginOverride`)
2. Product-specific rule
3. Customer-specific rule (`CustomerMarginRequirement`)
4. Product-category rule
5. Global system default

The same precedence model applies to: minimum margins, dunnage percentages, shipping assumptions, allocation rules, quote-selection rules, and alert thresholds.

## Calculation Trace

Every `CalculationResult` row stores a `calculationTrace` JSONB field containing:

```json
{
  "engineVersion": "1.0.0",
  "calculatedAt": "ISO-8601",
  "initiatedBy": "userId or job-id",
  "inputs": {
    "sellingPrice": "10.9500",
    "productCost": "4.2000",
    "shippingCost": "1.3500",
    "allocations": [
      { "name": "Commission", "type": "PERCENT_OF_SELLING_PRICE", "rate": "0.0500", "amount": "0.5475" },
      { "name": "Rebate",     "type": "PERCENT_OF_SELLING_PRICE", "rate": "0.0300", "amount": "0.3285" }
    ],
    "shippingTerms": "PREPAID",
    "packageQuantity": 1
  },
  "intermediates": {
    "revenueBasedAllowances": "0.8760",
    "netRevenue": "10.0740",
    "totalVariableCost": "5.5500",
    "contributionProfit": "4.5240"
  },
  "outputs": {
    "contributionMarginPercent": "44.91",
    "requiredMinimumMargin": "35.00",
    "varianceFromRequired": "9.91",
    "alertStatus": "OK"
  },
  "appliedOverrides": [],
  "dataQuality": {
    "dimensionSource": "SHIPPING",
    "dunnageApplied": false
  }
}
```

This trace is the authoritative record of why a SKU produced a particular margin at a particular time.

## Alert Thresholds

After calculation:

| Condition | Alert Type | Severity |
|---|---|---|
| `contributionMarginPercent < criticalThresholdPercent` | `BELOW_CRITICAL_MARGIN` | CRITICAL |
| `contributionMarginPercent < minimumMarginPercent` | `BELOW_MINIMUM_MARGIN` | HIGH |
| `contributionMarginPercent < warningThresholdPercent` | `BELOW_WARNING_MARGIN` | WARNING |
| `contributionProfit < 0` | `NEGATIVE_PROFIT` | CRITICAL |
