# Database Tables Reference

All tables use PostgreSQL via Prisma 7 (driver-adapter mode). All monetary fields use `NUMERIC(19,4)`. All percentage fields use `NUMERIC(10,4)`. All primary keys are UUID (`@default(uuid())`).

---

## Authorization Tables

### `roles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `name` | TEXT | UNIQUE, NOT NULL | `ADMINISTRATOR`, `DIRECTOR`, `SALES_MANAGER`, `PRICING_ANALYST` |
| `description` | TEXT | | |
| `isSystem` | BOOLEAN | NOT NULL, DEFAULT true | Prevents deletion of built-in roles |
| `createdAt` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updatedAt` | TIMESTAMPTZ | NOT NULL | |

### `permissions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `code` | TEXT | UNIQUE, NOT NULL | Kebab-case permission code (e.g. `view_product_cost`) |
| `description` | TEXT | | Human-readable label |
| `category` | TEXT | | Grouping (customers, products, cost, analysis, admin, etc.) |
| `createdAt` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updatedAt` | TIMESTAMPTZ | NOT NULL | |

### `role_permissions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `roleId` | UUID | FK→roles, NOT NULL | |
| `permissionId` | UUID | FK→permissions, NOT NULL | |
| `createdAt` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| — | — | UNIQUE(roleId, permissionId) | |

### `user_permissions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `userId` | UUID | FK→users, NOT NULL | |
| `permissionId` | UUID | FK→permissions, NOT NULL | |
| `grantedById` | UUID | FK→users | Admin who granted the override |
| `createdAt` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| — | — | UNIQUE(userId, permissionId) | |

---

## User Table

### `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `email` | TEXT | UNIQUE, NOT NULL | Login identifier |
| `passwordHash` | TEXT | NOT NULL | bcrypt hash |
| `firstName` | TEXT | NOT NULL | |
| `lastName` | TEXT | NOT NULL | |
| `roleId` | UUID | FK→roles, NOT NULL | |
| `isActive` | BOOLEAN | NOT NULL, DEFAULT true | Soft-disable |
| `lastLoginAt` | TIMESTAMPTZ | | |
| `failedLoginCount` | INTEGER | NOT NULL, DEFAULT 0 | |
| `lockedUntil` | TIMESTAMPTZ | | Null = not locked |
| `mustResetPassword` | BOOLEAN | NOT NULL, DEFAULT false | |
| `createdAt` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updatedAt` | TIMESTAMPTZ | NOT NULL | |
| `deletedAt` | TIMESTAMPTZ | | Soft-delete; null = active |

---

## Customer Tables

### `customers`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `name` | TEXT | NOT NULL | Display name |
| `code` | TEXT | UNIQUE, NOT NULL | Short identifier (e.g. `ACME`) |
| `status` | TEXT | NOT NULL, DEFAULT `ACTIVE` | Enum: ACTIVE, INACTIVE, PROSPECT |
| `description` | TEXT | | |
| `currency` | TEXT | NOT NULL, DEFAULT `USD` | ISO 4217 |
| `timezone` | TEXT | NOT NULL, DEFAULT `America/New_York` | |
| `shippingTerms` | TEXT | NOT NULL | Enum: PREPAID, COLLECT |
| `defaultOriginPostalCode` | TEXT | | |
| `defaultDestinationPostalCode` | TEXT | | |
| `createdAt` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| `updatedAt` | TIMESTAMPTZ | NOT NULL | |
| `deletedAt` | TIMESTAMPTZ | | Soft-delete |

### `customer_assignments`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `userId` | UUID | FK→users, NOT NULL | |
| `customerId` | UUID | FK→customers, NOT NULL | |
| `assignedById` | UUID | FK→users, NOT NULL | Admin who created the assignment |
| `role` | TEXT | NOT NULL, DEFAULT `ANALYST` | Enum: OWNER, MANAGER, ANALYST, VIEWER |
| `createdAt` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| — | — | UNIQUE(userId, customerId) | One assignment record per user-customer pair |

### `customer_contacts`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `customerId` | UUID | FK→customers |
| `name` | TEXT | |
| `title` | TEXT | |
| `email` | TEXT | |
| `phone` | TEXT | |
| `isPrimary` | BOOLEAN | |
| `createdAt` / `updatedAt` | TIMESTAMPTZ | |

### `customer_allocations`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `customerId` | UUID | FK→customers |
| `name` | TEXT | e.g. "Commission", "Rebate" |
| `calculationType` | TEXT | Enum: PERCENT_OF_SELLING_PRICE, PERCENT_OF_NET_REVENUE, PERCENT_OF_COST, FIXED_PER_UNIT, FIXED_PER_ORDER, FIXED_PER_SHIPMENT, FIXED_PER_SKU, CUSTOM |
| `rate` | NUMERIC(10,4) | For percentage-based types |
| `amount` | NUMERIC(19,4) | For fixed-amount types |
| `priority` | INTEGER | Ordering for display |
| `isActive` | BOOLEAN | |
| `effectiveDate` | DATE | |
| `expirationDate` | DATE | Null = no expiration |
| `notes` | TEXT | Required for CUSTOM type |
| `createdAt` / `updatedAt` | TIMESTAMPTZ | |

### `customer_margin_requirements`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `customerId` | UUID | FK→customers, UNIQUE |
| `minimumMarginPercent` | NUMERIC(10,4) | Below this = HIGH alert |
| `warningThresholdPercent` | NUMERIC(10,4) | Below this = WARNING alert |
| `criticalThresholdPercent` | NUMERIC(10,4) | Below this = CRITICAL alert |
| `calculationMethod` | TEXT | Enum: CONTRIBUTION_MARGIN, GROSS_MARGIN |
| `createdAt` / `updatedAt` | TIMESTAMPTZ | |

---

## Product Tables

### `product_categories`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `name` | TEXT | |
| `parentId` | UUID | FK→product_categories (self-ref), nullable |
| `dunnagePercent` | NUMERIC(10,4) | Applied to dimensions for shipping |
| `createdAt` / `updatedAt` | TIMESTAMPTZ | |

### `products`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `sku` | TEXT | UNIQUE |
| `name` | TEXT | |
| `brand` | TEXT | |
| `upc` | TEXT | |
| `categoryId` | UUID | FK→product_categories |
| `length` | NUMERIC(10,4) | inches (shipping dimensions) |
| `width` | NUMERIC(10,4) | |
| `height` | NUMERIC(10,4) | |
| `weight` | NUMERIC(10,4) | lbs |
| `currentCost` | NUMERIC(19,4) | **CONFIDENTIAL** — stripped without view_product_cost |
| `futureCost` | NUMERIC(19,4) | **CONFIDENTIAL** |
| `costEffectiveDate` | DATE | **CONFIDENTIAL** |
| `futureCostEffectiveDate` | DATE | **CONFIDENTIAL** |
| `costSource` | TEXT | **CONFIDENTIAL** — e.g. "ERP", "Manual" |
| `isActive` | BOOLEAN | |
| `createdAt` / `updatedAt` / `deletedAt` | TIMESTAMPTZ | |

### `product_cost_history`

Append-only. No `updatedAt` or `deletedAt`.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `productId` | UUID | FK→products |
| `cost` | NUMERIC(19,4) | **CONFIDENTIAL** |
| `effectiveDate` | DATE | |
| `source` | TEXT | |
| `recordedById` | UUID | FK→users |
| `createdAt` | TIMESTAMPTZ | |

---

## Customer-SKU Tables

### `customer_skus`

The central analysis entity.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `customerId` | UUID | FK→customers |
| `productId` | UUID | FK→products |
| `sellingPrice` | NUMERIC(19,4) | Customer-specific price |
| `packageQuantity` | INTEGER | Units per case/pack |
| `minimumMarginOverride` | NUMERIC(10,4) | Overrides customer margin requirement |
| `shippingTermsOverride` | TEXT | Overrides customer.shippingTerms |
| `useShippingDimensions` | BOOLEAN | When true, use product shipping dims |
| `alertStatus` | TEXT | Enum: OK, WARNING, HIGH, CRITICAL |
| `reviewStatus` | TEXT | Enum: PENDING, UNDER_REVIEW, APPROVED, ESCALATED |
| `lastCalculatedAt` | TIMESTAMPTZ | |
| `lastQuotedAt` | TIMESTAMPTZ | |
| `notes` | TEXT | |
| `createdAt` / `updatedAt` / `deletedAt` | TIMESTAMPTZ | |
| — | UNIQUE(customerId, productId) | One row per customer-product pair |

### `customer_price_history`

Append-only.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `customerSkuId` | UUID | FK→customer_skus |
| `sellingPrice` | NUMERIC(19,4) | |
| `effectiveDate` | DATE | |
| `recordedById` | UUID | FK→users |
| `createdAt` | TIMESTAMPTZ | |

---

## Calculation Table

### `calculation_results`

Append-only.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `customerSkuId` | UUID | FK→customer_skus |
| `engineVersion` | TEXT | e.g. "1.0.0" |
| `sellingPrice` | NUMERIC(19,4) | Snapshot at calculation time |
| `netRevenue` | NUMERIC(19,4) | |
| `totalVariableCost` | NUMERIC(19,4) | |
| `contributionProfit` | NUMERIC(19,4) | |
| `contributionMarginPercent` | NUMERIC(10,4) | |
| `requiredMinimumMargin` | NUMERIC(10,4) | From precedence resolution |
| `varianceFromRequired` | NUMERIC(10,4) | contributionMarginPercent − requiredMinimumMargin |
| `alertStatus` | TEXT | OK / WARNING / HIGH / CRITICAL |
| `calculationTrace` | JSONB | Full audit trace (inputs, intermediates, outputs) |
| `initiatedBy` | TEXT | userId or job-id |
| `calculatedAt` | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

---

## Shipping Tables

### `shipping_quotes`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `customerSkuId` | UUID | FK→customer_skus |
| `carrier` | TEXT | Enum: UPS, USPS |
| `serviceCode` | TEXT | e.g. "UPS_GROUND", "USPS_PRIORITY" |
| `rateAmount` | NUMERIC(19,4) | |
| `currency` | TEXT | DEFAULT "USD" |
| `billedWeight` | NUMERIC(10,4) | lbs — dimensional or actual, whichever is greater |
| `dimensionalWeight` | NUMERIC(10,4) | |
| `divisorUsed` | NUMERIC(10,4) | Carrier-specific dim divisor |
| `dimensionSource` | TEXT | Enum: SHIPPING, UPC, DUNNAGE_FALLBACK |
| `quoteExpiresAt` | TIMESTAMPTZ | |
| `isSelected` | BOOLEAN | The quote used in current calculation |
| `rawResponse` | JSONB | Carrier API response |
| `createdAt` | TIMESTAMPTZ | |

### `dunnage_configs`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `categoryId` | UUID | FK→product_categories, nullable (null = global) |
| `dunnagePercent` | NUMERIC(10,4) | Added to each dimension |
| `isActive` | BOOLEAN | |
| `createdAt` / `updatedAt` | TIMESTAMPTZ | |

---

## Alert Tables

### `alerts`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `customerSkuId` | UUID | FK→customer_skus |
| `alertType` | TEXT | Enum: BELOW_CRITICAL_MARGIN, BELOW_MINIMUM_MARGIN, BELOW_WARNING_MARGIN, NEGATIVE_PROFIT, NO_SHIPPING_QUOTE, EXPIRED_QUOTE, COST_CHANGE, PRICE_CHANGE, etc. |
| `severity` | TEXT | Enum: CRITICAL, HIGH, WARNING, INFO |
| `status` | TEXT | Enum: OPEN, ACKNOWLEDGED, RESOLVED, SUPPRESSED |
| `message` | TEXT | |
| `triggeredAt` | TIMESTAMPTZ | |
| `acknowledgedAt` | TIMESTAMPTZ | |
| `acknowledgedById` | UUID | FK→users |
| `resolvedAt` | TIMESTAMPTZ | |
| `resolvedById` | UUID | FK→users |
| `createdAt` / `updatedAt` | TIMESTAMPTZ | |

### `alert_history`

Append-only status-change log.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `alertId` | UUID | FK→alerts |
| `fromStatus` | TEXT | |
| `toStatus` | TEXT | |
| `changedById` | UUID | FK→users |
| `note` | TEXT | |
| `createdAt` | TIMESTAMPTZ | |

---

## Collaboration Tables

### `comments`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `customerSkuId` | UUID | FK→customer_skus |
| `authorId` | UUID | FK→users |
| `parentId` | UUID | FK→comments (self-ref), nullable — for replies |
| `body` | TEXT | Markdown content |
| `createdAt` / `updatedAt` / `deletedAt` | TIMESTAMPTZ | |

### `mentions`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `commentId` | UUID | FK→comments |
| `mentionedUserId` | UUID | FK→users |
| `createdAt` | TIMESTAMPTZ | |

### `notifications`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `userId` | UUID | FK→users |
| `type` | TEXT | Enum: MENTION, ASSIGNMENT, ALERT, COMMENT_REPLY, REPORT_READY |
| `title` | TEXT | |
| `body` | TEXT | |
| `entityType` | TEXT | e.g. "customer_sku", "alert" |
| `entityId` | UUID | |
| `isRead` | BOOLEAN | DEFAULT false |
| `readAt` | TIMESTAMPTZ | |
| `createdAt` | TIMESTAMPTZ | |

---

## Import Tables

### `import_batches`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `uploadedById` | UUID | FK→users |
| `filename` | TEXT | |
| `status` | TEXT | Enum: PENDING, VALIDATING, PROCESSING, COMPLETE, FAILED |
| `totalRows` | INTEGER | |
| `successRows` | INTEGER | |
| `errorRows` | INTEGER | |
| `errorSummary` | JSONB | |
| `jobId` | TEXT | pg-boss job ID |
| `createdAt` / `updatedAt` | TIMESTAMPTZ | |

### `import_rows`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `batchId` | UUID | FK→import_batches |
| `rowNumber` | INTEGER | 1-indexed row from the source file |
| `rawData` | JSONB | Raw column values from import |
| `status` | TEXT | Enum: PENDING, SUCCESS, ERROR, SKIPPED |
| `errors` | JSONB | Array of field-level error messages |
| `createdAt` / `updatedAt` | TIMESTAMPTZ | |

---

## Administration Tables

### `audit_log`

Append-only. No `updatedAt`, no `deletedAt`.

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `userId` | UUID | FK→users, nullable (null = system action) |
| `action` | TEXT | e.g. `USER_CREATED`, `CUSTOMER_UPDATED`, `LOGIN_FAILED` |
| `entityType` | TEXT | e.g. `user`, `customer`, `customer_sku` |
| `entityId` | TEXT | ID of the affected entity |
| `beforeValue` | JSONB | State before the action (cost fields omitted) |
| `afterValue` | JSONB | State after the action (cost fields omitted) |
| `sourceIp` | TEXT | |
| `userAgent` | TEXT | |
| `correlationId` | TEXT | Request trace ID |
| `createdAt` | TIMESTAMPTZ | NOT NULL, DEFAULT now() |

### `system_configs`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `key` | TEXT | UNIQUE — e.g. `smtp.host`, `ups.apiKey` |
| `value` | TEXT | Encrypted if `isEncrypted = true` |
| `isEncrypted` | BOOLEAN | AES-256-GCM via APP_ENCRYPTION_KEY |
| `description` | TEXT | |
| `updatedById` | UUID | FK→users |
| `createdAt` / `updatedAt` | TIMESTAMPTZ | |

### `scheduled_reports`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `name` | TEXT | |
| `cronExpression` | TEXT | e.g. `0 6 * * 1` (weekly Monday 6am) |
| `recipientUserIds` | UUID[] | Array of user IDs |
| `includeCustomerIds` | UUID[] | Empty = all accessible customers |
| `isActive` | BOOLEAN | |
| `lastRunAt` | TIMESTAMPTZ | |
| `createdAt` / `updatedAt` | TIMESTAMPTZ | |

### `report_delivery_log`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | PK |
| `scheduledReportId` | UUID | FK→scheduled_reports |
| `triggeredById` | UUID | FK→users, nullable (null = scheduled) |
| `status` | TEXT | Enum: PENDING, GENERATING, DELIVERED, FAILED |
| `recipientEmails` | TEXT[] | |
| `filePath` | TEXT | Temporary file path |
| `errorMessage` | TEXT | |
| `deliveredAt` | TIMESTAMPTZ | |
| `createdAt` / `updatedAt` | TIMESTAMPTZ | |
