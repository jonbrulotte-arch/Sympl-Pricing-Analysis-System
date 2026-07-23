# Roles and Permissions Matrix

## Roles

| Role | Description |
|---|---|
| `ADMINISTRATOR` | Full system access including infrastructure configuration |
| `DIRECTOR` | Executive access with cost visibility; may have global customer access |
| `SALES_MANAGER` | Access to assigned customers and their pricing/profitability data |
| `PRICING_ANALYST` | Restricted access to assigned customers; no cost visibility by default |

## Permissions

| Permission Code | Description | Admin | Director | Sales Mgr | Analyst |
|---|---|---|---|---|---|
| **Customers** |||||
| `view_customers` | View assigned customers | ✓ | ✓ | ✓ | ✓ |
| `manage_customers` | Create and edit customers | ✓ | — | — | — |
| `global_customer_access` | Access all customers regardless of assignment | ✓ | configurable | — | — |
| **Products** |||||
| `view_products` | View products | ✓ | ✓ | ✓ | ✓ |
| `manage_products` | Create and edit products | ✓ | — | — | — |
| **Cost Visibility (critical security boundary)** |||||
| `view_product_cost` | View raw product cost | ✓ | ✓ | — | — |
| `edit_product_cost` | Edit raw product cost | ✓ | — | — | — |
| `view_calculated_margin` | View calculated margin % | ✓ | ✓ | ✓ | ✓ |
| `view_shipping_cost` | View shipping cost | ✓ | ✓ | ✓ | ✓ |
| `view_customer_pricing` | View customer selling price | ✓ | ✓ | ✓ | ✓ |
| `export_financial_data` | Export financial data to files | ✓ | ✓ | ✓ | — |
| **Analysis** |||||
| `manage_customer_skus` | Manage customer SKU assignments | ✓ | ✓ | ✓ | — |
| `run_calculations` | Trigger profitability recalculations | ✓ | ✓ | ✓ | ✓ |
| `request_shipping_quotes` | Request shipping rate quotes | ✓ | ✓ | ✓ | ✓ |
| `manage_allocations` | Manage customer cost allocations | ✓ | ✓ | — | — |
| `manage_margin_requirements` | Manage minimum margin requirements | ✓ | ✓ | — | — |
| **Alerts & Comments** |||||
| `view_alerts` | View profitability alerts | ✓ | ✓ | ✓ | ✓ |
| `manage_alerts` | Update alert statuses | ✓ | ✓ | ✓ | ✓ |
| `add_comments` | Add line-level comments and mentions | ✓ | ✓ | ✓ | ✓ |
| `manage_comments` | Delete and manage all comments | ✓ | — | — | — |
| **Import / Export** |||||
| `import_data` | Import data from files | ✓ | — | — | ✓ |
| `export_data` | Export data to files | ✓ | ✓ | ✓ | ✓ |
| **Reports** |||||
| `view_reports` | View and download reports | ✓ | ✓ | ✓ | ✓ |
| `manage_reports` | Configure and schedule reports | ✓ | ✓ | — | — |
| **Administration** |||||
| `manage_users` | Create, edit, and deactivate users | ✓ | — | — | — |
| `manage_roles` | Manage roles and permission assignments | ✓ | — | — | — |
| `manage_system_config` | Manage application settings | ✓ | — | — | — |
| `manage_shipping_config` | Manage UPS/USPS API credentials | ✓ | — | — | — |
| `manage_smtp_config` | Manage SMTP configuration | ✓ | — | — | — |
| `manage_backups` | Configure and trigger database backups | ✓ | — | — | — |
| `view_audit_log` | View the immutable audit log | ✓ | — | — | — |
| `view_jobs` | View background job status | ✓ | — | — | — |

## Per-User Permission Overrides

The `UserPermission` table allows granting individual permissions beyond a user's role defaults. This is used for:

- Granting `view_product_cost` to a specific Pricing Analyst who needs cost visibility
- Granting `global_customer_access` to a specific Director
- Granting `manage_reports` to a specific Sales Manager

Per-user permissions are merged with role defaults at login time and stored in the JWT. Revocation requires the user to log out and back in (or session invalidation).

## Cost Visibility Rule (Critical)

Raw product cost (`currentCost`, `futureCost`, `costEffectiveDate`, `futureCostEffectiveDate`, `costSource`) is stripped from all API responses, exports, and reports for users lacking `view_product_cost`.

This applies regardless of the user's role. A Director with `view_product_cost` removed from their role would not see costs. A Pricing Analyst with an explicit `view_product_cost` `UserPermission` row would see costs.

Cost fields must never appear in:
- API JSON responses for users without `view_product_cost`
- Downloaded reports or exports
- Browser developer tools (no hidden columns, no client-side payloads)
- Logs accessible to unauthorized users
