# Shipping Rate Design

## Provider Abstraction

All carrier integrations implement the `ShippingRateProvider` interface:

```typescript
interface ShippingRateRequest {
  originPostalCode: string;
  destinationPostalCode: string;
  length: number;   // inches
  width: number;
  height: number;
  weight: number;   // lbs
  carrier: "UPS" | "USPS";
}

interface ShippingRateResponse {
  carrier: "UPS" | "USPS";
  serviceCode: string;
  rateAmount: Decimal;
  currency: string;
  billedWeight: Decimal;
  dimensionalWeight: Decimal;
  divisorUsed: Decimal;
  rawResponse: Record<string, unknown>;
}

interface ShippingRateProvider {
  getRate(request: ShippingRateRequest): Promise<ShippingRateResponse>;
  isAvailable(): Promise<boolean>;
}
```

Registered providers: `MockRateProvider` (always available, used in tests), `UPSRateProvider`, `USPSRateProvider`.

---

## Package Dimension Resolver

When requesting a shipping rate for a CustomerSku, the system must determine which dimensions to use. `PackageDimensionResolver` applies this waterfall:

1. **Shipping dimensions** — Product has dedicated shipping dimensions (`useShippingDimensions = true` on CustomerSku and all four shipping fields are non-null). Use `product.shippingLength`, `product.shippingWidth`, `product.shippingHeight`, `product.shippingWeight`.
2. **UPC/product dimensions** — Use `product.length`, `product.width`, `product.height`, `product.weight`.
3. **Dunnage fallback** — Neither set is available. Use the `DunnageConfig` for the product's category (or global fallback) to estimate: apply `dunnagePercent` to a default box size. Mark `dimensionSource = DUNNAGE_FALLBACK` in the quote record.

The selected source is stored in `ShippingQuote.dimensionSource` and in the `calculationTrace.dataQuality` field.

---

## Dimensional Weight Calculation

`DimensionalWeightCalculator` computes dimensional weight using carrier-specific divisors:

```
Dimensional Weight = (length × width × height) / divisor
Billed Weight = max(Dimensional Weight, Actual Weight)
```

| Carrier | Default Divisor | Notes |
|---|---|---|
| UPS | 139 | For packages ≤ 1,728 in³ (1 ft³), actual weight is used |
| USPS | 166 | Priority Mail; other services may differ |

Divisors are stored in `SystemConfig` and are configurable via the admin UI without code changes.

---

## Dunnage Configuration

`DunnageConfig` records define a padding percentage applied to each dimension before dimensional weight calculation. This accounts for packaging material (bubble wrap, foam, etc.).

- If a `DunnageConfig` with `categoryId = product.categoryId` exists and `isActive = true`, use its `dunnagePercent`.
- Otherwise, use the global `DunnageConfig` (`categoryId = null`).
- If no dunnage config exists, apply 0% (no padding).

Example: dunnagePercent = 10%, product is 10×8×6 → adjusted dims = 11×8.8×6.6.

---

## Quote Selection Rules

When multiple quotes exist for a CustomerSku:

1. Only non-expired quotes are eligible (`quoteExpiresAt > now()`).
2. If the customer or CustomerSku has a preferred carrier configured, prefer that carrier.
3. Otherwise, select the lowest `rateAmount` across eligible quotes.
4. Set `isSelected = true` on the winning quote; set `isSelected = false` on all others.

The selected quote's `rateAmount` is used as `shippingCost` in the profitability calculation when the customer's shipping terms are `PREPAID`.

---

## Quote Expiration

Quotes expire after a configurable TTL (default: 7 days), stored in `SystemConfig` as `shipping.quoteTtlDays`.

A pg-boss cron job (`shipping-quote-expiry-check`) runs nightly to:
1. Find all CustomerSkus with `lastQuotedAt < now() - TTL`.
2. Flag expired quotes (set `quoteExpiresAt` in the past if not already expired).
3. Generate `EXPIRED_QUOTE` alerts for CustomerSkus with no valid active quote.

---

## Bulk Quote Refresh

A pg-boss job (`shipping-quote-refresh`) accepts a batch of CustomerSku IDs and:
1. Resolves dimensions for each SKU.
2. Calls the configured carrier provider(s).
3. Stores new `ShippingQuote` rows.
4. Applies quote selection rules.
5. Triggers recalculation for affected SKUs.

This job is enqueued:
- Manually via the bulk-action "Refresh Quotes" on the ROI grid.
- Automatically after a ProductCostHistory or CustomerPriceHistory insert (since the quote itself doesn't change, but the calculation needs fresh data).

---

## Credential Strategy

UPS and USPS API credentials are stored encrypted in `SystemConfig`:

| Key | Description |
|---|---|
| `ups.clientId` | UPS OAuth client ID |
| `ups.clientSecret` | UPS OAuth client secret (encrypted) |
| `ups.accountNumber` | Shipper account number |
| `ups.environment` | `sandbox` or `production` |
| `usps.userId` | USPS Web Tools user ID |
| `usps.password` | USPS Web Tools password (encrypted) |
| `usps.environment` | `test` or `production` |

All encrypted values use AES-256-GCM with `APP_ENCRYPTION_KEY`. The admin UI allows test-sends to verify credentials before switching to production.

---

## MockRateProvider (Testing)

`MockRateProvider` is the default provider in test environments. It:
- Always returns `isAvailable() = true`.
- Returns a deterministic rate based on the request inputs (e.g. `weight × 0.65`).
- Never makes HTTP calls.
- Allows tests to run without live API credentials.

The active provider is selected via `SystemConfig.ups.environment` and `SystemConfig.usps.environment`:
- `sandbox` / `test` → use the sandbox endpoint (live HTTP call with test credentials).
- `production` → use the production endpoint.
- Unset / no credentials → fall back to `MockRateProvider`.
