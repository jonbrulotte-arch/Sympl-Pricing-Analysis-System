# Entity-Relationship Model

## Core Authorization Cluster

```
Role ──< RolePermission >── Permission
 │
 └──< User >── UserPermission >── Permission
                │
                └──< CustomerAssignment >── Customer
```

- A **Role** has many **Permissions** through **RolePermission** (many-to-many junction).
- A **User** belongs to exactly one **Role**.
- A **User** may have individual **UserPermission** overrides that add to or replace role defaults.
- A **User** may be assigned to zero or more **Customers** through **CustomerAssignment**.
- A **Customer** may have zero or more **Users** assigned to it.

## Customer Data Cluster

```
Customer ──< CustomerAssignment >── User
    │
    ├──< CustomerContact
    ├──< CustomerAllocation
    ├──< CustomerMarginRequirement
    └──< CustomerSku >── Product
              │
              ├──< CustomerPriceHistory
              └──< CalculationResult
```

- A **Customer** has contacts, allocation rules, and margin requirements.
- A **CustomerSku** is the junction between a Customer and a Product; it stores customer-specific pricing, overrides, and analysis status.
- Each **CustomerSku** has an append-only price history and a series of calculation results.

## Product Cluster

```
ProductCategory ──< ProductCategory (self-referencing, parent/child)
     │
     └──< Product ──< ProductCostHistory (append-only)
                │
                └──< CustomerSku
```

- **Products** belong to a **ProductCategory** which may have a parent category (hierarchical).
- Product costs are tracked in an append-only **ProductCostHistory** table; the `currentCost` and `futureCost` on the Product row are the active values.

## Shipping Cluster

```
CustomerSku ──< ShippingQuote
DunnageConfig (global or per ProductCategory)
```

- **ShippingQuote** records are requested from UPS/USPS providers for a CustomerSku and stored with an expiration timestamp.
- **DunnageConfig** applies at the product category level (with a global fallback) to add a percentage to package dimensions for dimensional weight calculation.

## Calculation Cluster

```
CustomerSku ──< CalculationResult
```

- **CalculationResult** is append-only; each recalculation inserts a new row. The most recent result per CustomerSku is the active result.
- The `calculationTrace` JSONB column stores all inputs, intermediates, and outputs so results are fully auditable.

## Alert Cluster

```
CalculationResult ──> Alert ──< AlertHistory
```

- A **CalculationResult** triggers **Alert** creation/update when margin thresholds are breached.
- **AlertHistory** captures every status transition on an alert (open → acknowledged → resolved).

## Collaboration Cluster

```
CustomerSku ──< Comment ──< Comment (replies)
Comment ──< Mention ──> User
User ──< Notification
```

- **Comments** are threaded (a comment may have a `parentId` pointing to another comment).
- **Mentions** link a comment to a mentioned user and generate a **Notification**.

## Import/Export Cluster

```
User ──< ImportBatch ──< ImportRow
```

- An **ImportBatch** tracks a complete file upload session with status, row counts, and error summary.
- Each **ImportRow** records the raw data and any validation/transformation errors.

## Administration Cluster

```
User ──< AuditLog
SystemConfig (key/value store, encrypted values)
ScheduledReport ──< ReportDeliveryLog
```

- **AuditLog** is append-only; every sensitive action writes a row with before/after JSONB.
- **SystemConfig** stores global configuration (SMTP credentials, UPS/USPS API keys, shipping divisors) with optional encryption flag.
- **ScheduledReport** defines report schedule and recipients; **ReportDeliveryLog** tracks each delivery attempt.

## Key Cardinalities

| Relationship | Cardinality | Notes |
|---|---|---|
| User → Role | Many-to-one | Exactly one role per user |
| User → Permission (via UserPermission) | Many-to-many | Additive overrides |
| Role → Permission (via RolePermission) | Many-to-many | Base permissions |
| User → Customer (via CustomerAssignment) | Many-to-many | Enforces isolation |
| Customer → Product (via CustomerSku) | Many-to-many | Core analysis entity |
| CustomerSku → CalculationResult | One-to-many | Append-only history |
| CustomerSku → ShippingQuote | One-to-many | Multiple carrier quotes |
| Product → ProductCostHistory | One-to-many | Append-only |
| Comment → Comment (replies) | Self-referencing | One level (no deep nesting) |
| AuditLog → User | Many-to-one | Append-only; no cascade delete |
