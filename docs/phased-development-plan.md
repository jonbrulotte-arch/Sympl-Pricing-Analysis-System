# Phased Development Plan

## Phase 1: Foundation ✓ (current)

**Goal:** Working, authenticated application with enforced customer isolation and role-based access.

**Deliverables:**
- Project scaffold (Next.js 16, Tailwind v4, all prescribed dependencies)
- PostgreSQL schema for authorization and customer entities
- NextAuth v5 authentication with JWT
- Role and permission model with per-user overrides
- Customer isolation guard (`check-customer-access.ts`)
- Cost visibility guard (`check-cost-visibility.ts`)
- Audit log framework
- App shell with dark sidebar, role-aware navigation
- Login page
- API routes: customers, users, audit log
- Authorization unit tests (13 passing)
- Seed data demonstrating isolation with 6 users and 3 customers
- 15 architecture documentation files

**Acceptance criteria:**
- TypeScript compiles without errors
- Unit tests pass
- Login works for all 6 seed users
- analyst1 cannot access Beta Industries or Gamma Retail
- analyst2 has cost visibility; analyst1 does not

---

## Phase 2: Customer and Product Data

**Goal:** Complete CRUD for customers, products, and customer-SKU assignments with cost/price history.

**Deliverables:**
- Full customer profile (contacts, payment terms, shipping terms)
- Customer allocations (configurable rate types, precedence ordering)
- Customer margin requirements (min margin, warning/critical thresholds)
- Product records (identity, dimensions, confidential cost fields)
- Product categories with hierarchical structure
- Product cost history (append-only)
- Customer-SKU assignment entity with customer-specific overrides
- Customer price history (append-only)
- Import/export foundation (Excel template generation, basic import loop)
- Customer list and detail pages (UI)
- Product list and detail pages (UI)

---

## Phase 3: Calculation Engine

**Goal:** Server-side profitability calculation with full audit trail.

**Deliverables:**
- `CalculationService` with configurable formula engine
- Calculation trace stored as JSONB in `CalculationResult`
- Precedence model for margins, allocations, overrides
- Recalculation background job (pg-boss)
- Calculation detail panel (click a margin → see the full trace)
- Unit tests for all formula paths and precedence rules

---

## Phase 4: Shipping

**Goal:** UPS and USPS integration behind a shared abstraction layer.

**Deliverables:**
- `ShippingRateProvider` interface
- `PackageDimensionResolver` (shipping dims → UPC dims → dunnage fallback)
- `DimensionalWeightCalculator` (carrier-specific divisors)
- `DunnageConfig` records and application logic
- `MockRateProvider` for testing without live API calls
- `UPSRateProvider` (once abstraction layer and credential strategy are established)
- `USPSRateProvider` (same)
- `ShippingQuote` storage with quote selection rules
- Background job for bulk quote refresh and expiration checks

---

## Phase 5: ROI Grid and Alerts

**Goal:** High-performance, permission-aware customer ROI grid with alert management.

**Deliverables:**
- Customer ROI grid (TanStack Table, server-side pagination/sorting/filtering)
- Saved views (per-user column layout and filter presets)
- Bulk actions (refresh quotes, recalculate, export, assign analyst)
- Alert generation engine (20+ alert types from spec)
- Alert lifecycle management (status transitions, history preservation)
- Role-aware dashboard with portfolio summary, alert summary, work queue
- Permission-aware column visibility (cost columns hidden without `view_product_cost`)

---

## Phase 6: Collaboration

**Goal:** Line-level comments, user mentions, and in-app/email notifications.

**Deliverables:**
- Line-level comments on customer-SKU records
- Comment threads (replies)
- User mentions (restricted to users with customer access)
- In-app notification system
- Email notifications via nodemailer
- Mention and assignment notification flows
- Notification preferences per user

---

## Phase 7: Reporting

**Goal:** Scheduled and on-demand Excel reports with full permission enforcement.

**Deliverables:**
- `ReportService` using exceljs
- Summary worksheet (portfolio overview)
- Per-customer worksheets (ROI grid data)
- Weekly scheduled report via pg-boss cron
- Report delivery log
- On-demand filtered export from ROI grid
- Selected-row export
- Cost field exclusion for unauthorized recipients

---

## Phase 8: Administration and Operations

**Goal:** Complete administrative controls and production-ready hardening.

**Deliverables:**
- SMTP configuration UI with encrypted credential storage and test-send
- UPS/USPS API configuration UI with sandbox/production toggle
- Backup scheduling and status monitoring
- Restore documentation and validation procedure
- Job monitoring UI (pg-boss job table)
- Expanded audit log viewer with filters
- Security hardening review
- MFA architecture (TOTP, optional)
- SSO architecture documentation (future implementation)
