# Route Map

All API routes return JSON. All authenticated routes require a valid NextAuth session (JWT). Permission codes are defined in `src/server/authorization/permissions.ts`.

## Authentication Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| POST | `/api/auth/signin` | No | — | NextAuth credentials login |
| GET/POST | `/api/auth/[...nextauth]` | No | — | NextAuth catch-all handler |

---

## Customer Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/customers` | Yes | `view_customers` | List customers (filtered by CustomerAssignment unless `global_customer_access`) |
| POST | `/api/customers` | Yes | `manage_customers` | Create a new customer |
| GET | `/api/customers/:id` | Yes | `view_customers` | Get customer by ID (customer access check enforced) |
| PATCH | `/api/customers/:id` | Yes | `manage_customers` | Update customer (customer access check enforced) |
| DELETE | `/api/customers/:id` | Yes | `manage_customers` | Soft-delete customer |
| GET | `/api/customers/:id/assignments` | Yes | `manage_customers` | List users assigned to this customer |
| POST | `/api/customers/:id/assignments` | Yes | `manage_customers` | Assign a user to this customer |
| DELETE | `/api/customers/:id/assignments/:userId` | Yes | `manage_customers` | Remove a user assignment |
| GET | `/api/customers/:id/allocations` | Yes | `view_customers` | List customer allocations |
| POST | `/api/customers/:id/allocations` | Yes | `manage_allocations` | Create allocation |
| PATCH | `/api/customers/:id/allocations/:allocId` | Yes | `manage_allocations` | Update allocation |
| DELETE | `/api/customers/:id/allocations/:allocId` | Yes | `manage_allocations` | Delete allocation |
| GET | `/api/customers/:id/margin-requirements` | Yes | `view_customers` | Get margin requirements |
| PUT | `/api/customers/:id/margin-requirements` | Yes | `manage_margin_requirements` | Set/update margin requirements |
| GET | `/api/customers/:id/skus` | Yes | `view_customers` | List CustomerSkus with latest CalculationResult |
| POST | `/api/customers/:id/skus` | Yes | `manage_customer_skus` | Add a product to this customer |
| GET | `/api/customers/:id/skus/:skuId` | Yes | `view_customers` | Get single CustomerSku detail |
| PATCH | `/api/customers/:id/skus/:skuId` | Yes | `manage_customer_skus` | Update CustomerSku (price, qty, overrides) |
| DELETE | `/api/customers/:id/skus/:skuId` | Yes | `manage_customer_skus` | Soft-delete CustomerSku |

---

## Product Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/products` | Yes | `view_products` | List products (cost fields stripped by service layer) |
| POST | `/api/products` | Yes | `manage_products` | Create product |
| GET | `/api/products/:id` | Yes | `view_products` | Get product (cost fields stripped without `view_product_cost`) |
| PATCH | `/api/products/:id` | Yes | `manage_products` | Update product identity fields |
| PATCH | `/api/products/:id/cost` | Yes | `edit_product_cost` | Update cost fields (writes ProductCostHistory) |
| DELETE | `/api/products/:id` | Yes | `manage_products` | Soft-delete product |
| GET | `/api/products/:id/cost-history` | Yes | `view_product_cost` | Get cost history |
| GET | `/api/categories` | Yes | `view_products` | List product categories |
| POST | `/api/categories` | Yes | `manage_products` | Create category |
| PATCH | `/api/categories/:id` | Yes | `manage_products` | Update category |

---

## Calculation Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| POST | `/api/customers/:id/skus/:skuId/calculate` | Yes | `run_calculations` | Trigger recalculation for one SKU |
| POST | `/api/customers/:id/calculate-all` | Yes | `run_calculations` | Enqueue bulk recalculation for all SKUs |
| GET | `/api/customers/:id/skus/:skuId/calculation-history` | Yes | `view_customers` | List past CalculationResults |
| GET | `/api/customers/:id/skus/:skuId/calculation-history/:resultId` | Yes | `view_customers` | Get full calculationTrace for one result |

---

## Shipping Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| POST | `/api/customers/:id/skus/:skuId/quotes` | Yes | `request_shipping_quotes` | Request a fresh shipping quote |
| POST | `/api/customers/:id/refresh-quotes` | Yes | `request_shipping_quotes` | Enqueue bulk quote refresh |
| GET | `/api/customers/:id/skus/:skuId/quotes` | Yes | `view_customers` | List quotes for a SKU |
| PATCH | `/api/customers/:id/skus/:skuId/quotes/:quoteId/select` | Yes | `manage_customer_skus` | Mark a quote as selected |

---

## Alert Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/alerts` | Yes | `view_alerts` | List alerts (filtered by customer access) |
| GET | `/api/alerts/:id` | Yes | `view_alerts` | Get alert detail with history |
| PATCH | `/api/alerts/:id/acknowledge` | Yes | `manage_alerts` | Acknowledge an alert |
| PATCH | `/api/alerts/:id/resolve` | Yes | `manage_alerts` | Resolve an alert |
| PATCH | `/api/alerts/:id/suppress` | Yes | `manage_alerts` | Suppress an alert |

---

## Import / Export Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| POST | `/api/imports` | Yes | `import_data` | Upload an Excel file (multipart/form-data) |
| GET | `/api/imports/:batchId` | Yes | `import_data` | Poll import batch status |
| GET | `/api/imports` | Yes | `import_data` | List import batches for the current user |
| GET | `/api/exports/template` | Yes | `export_data` | Download blank Excel import template |
| POST | `/api/exports` | Yes | `export_data` | Export current ROI grid data to Excel |

---

## Collaboration Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/customers/:id/skus/:skuId/comments` | Yes | `view_customers` | List comments on a CustomerSku |
| POST | `/api/customers/:id/skus/:skuId/comments` | Yes | `add_comments` | Add a comment (with optional @mentions) |
| PATCH | `/api/comments/:commentId` | Yes | `manage_comments` or own comment | Edit a comment |
| DELETE | `/api/comments/:commentId` | Yes | `manage_comments` or own comment | Soft-delete a comment |
| GET | `/api/notifications` | Yes | (own notifications) | List current user's notifications |
| PATCH | `/api/notifications/:id/read` | Yes | (own notifications) | Mark notification as read |
| PATCH | `/api/notifications/read-all` | Yes | (own notifications) | Mark all as read |

---

## Report Routes

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/reports` | Yes | `view_reports` | List scheduled reports |
| POST | `/api/reports` | Yes | `manage_reports` | Create a scheduled report |
| PATCH | `/api/reports/:id` | Yes | `manage_reports` | Update report config |
| DELETE | `/api/reports/:id` | Yes | `manage_reports` | Deactivate report |
| GET | `/api/reports/:id/deliveries` | Yes | `manage_reports` | List delivery log for a report |

---

## User Management Routes (Admin)

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/users` | Yes | `manage_users` | List all users |
| POST | `/api/users` | Yes | `manage_users` | Create a user |
| GET | `/api/users/:id` | Yes | `manage_users` | Get user detail |
| PATCH | `/api/users/:id` | Yes | `manage_users` | Update user (role, name, active status) |
| DELETE | `/api/users/:id` | Yes | `manage_users` | Deactivate user (soft) |
| GET | `/api/users/:id/permissions` | Yes | `manage_users` | List per-user permission overrides |
| POST | `/api/users/:id/permissions` | Yes | `manage_users` | Grant a per-user permission |
| DELETE | `/api/users/:id/permissions/:permId` | Yes | `manage_users` | Revoke a per-user permission |

---

## Audit Log Routes (Admin)

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/audit-log` | Yes | `view_audit_log` | List audit log entries (paginated, filterable) |
| GET | `/api/audit-log/:id` | Yes | `view_audit_log` | Get single audit log entry |

---

## System Config Routes (Admin)

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/admin/config` | Yes | `manage_system_config` | List config keys (values redacted for encrypted keys) |
| PUT | `/api/admin/config/:key` | Yes | `manage_system_config` | Set a config value |
| POST | `/api/admin/config/smtp/test` | Yes | `manage_smtp_config` | Send a test email |
| POST | `/api/admin/config/shipping/test` | Yes | `manage_shipping_config` | Test carrier API connectivity |

---

## Job Monitoring Routes (Admin)

| Method | Path | Auth | Permission | Description |
|---|---|---|---|---|
| GET | `/api/admin/jobs` | Yes | `view_jobs` | List pg-boss job queues with backlog counts |
| GET | `/api/admin/jobs/dead-letter` | Yes | `view_jobs` | List dead-letter queue entries |
| POST | `/api/admin/jobs/dead-letter/:id/retry` | Yes | `manage_system_config` | Re-queue a dead-letter job |

---

## Page Routes (Next.js App Router)

| Path | Auth | Layout |
|---|---|---|
| `/` | — | Redirects to `/dashboard` |
| `/login` | No | (auth) — centered, no sidebar |
| `/dashboard` | Yes | (app) — AppShell |
| `/customers` | Yes | (app) |
| `/customers/:id` | Yes | (app) |
| `/customers/:id/roi` | Yes | (app) |
| `/products` | Yes | (app) |
| `/alerts` | Yes | (app) |
| `/reports` | Yes | (app) |
| `/imports` | Yes | (app) |
| `/notifications` | Yes | (app) |
| `/profile` | Yes | (app) |
| `/admin/users` | Yes (`manage_users`) | (app) |
| `/admin/users/:id` | Yes (`manage_users`) | (app) |
| `/admin/roles` | Yes (`manage_roles`) | (app) |
| `/admin/settings` | Yes (`manage_system_config`) | (app) |
| `/admin/shipping` | Yes (`manage_shipping_config`) | (app) |
| `/admin/smtp` | Yes (`manage_smtp_config`) | (app) |
| `/admin/jobs` | Yes (`view_jobs`) | (app) |
| `/admin/audit-log` | Yes (`view_audit_log`) | (app) |
