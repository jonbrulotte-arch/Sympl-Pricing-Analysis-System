# Architecture Decisions

## 1. Framework: Next.js 16 (App Router)

**Decision:** Use Next.js 16 with the App Router, Turbopack, and React 19.

**Rationale:** Prescribed by SYMPL-DESIGN-SYSTEM.md to match the sibling Sympl PM application. App Router enables server components by default, reducing client-side JavaScript and improving initial load performance for data-dense financial screens. Route groups allow clean separation of auth and app layouts without URL impact.

## 2. API Layer: Next.js Route Handlers (REST)

**Decision:** Implement all API endpoints as Next.js Route Handlers under `src/app/api/`.

**Rationale:** The spec requires a versioned, documented API consumable from background job workers, email templates, and future integrations. REST Route Handlers provide standard HTTP endpoints with clear paths, are accessible from non-React clients (the pg-boss worker process), and make it straightforward to add API versioning via URL prefixes (`/api/v2/...`) if needed. tRPC was considered but rejected because it couples client and server type inference in a way that makes external consumption and versioning harder.

## 3. Database: PostgreSQL with Prisma 7 (driver-adapter mode)

**Decision:** PostgreSQL via Prisma 7 using `@prisma/adapter-pg` in driver-adapter mode.

**Rationale:** Prescribed by SYMPL-DESIGN-SYSTEM.md. PostgreSQL provides `NUMERIC` type for fixed-precision decimals (mandated by spec), strong migration support, JSONB for calculation traces and audit data, and partitioning options for the audit log. Prisma 7 with driver-adapter mode bypasses the Prisma engine binary entirely, speaking directly to PostgreSQL through the `pg` package — eliminating a dependency and improving performance in serverless-style environments.

**Important:** All monetary and percentage fields use `Decimal` in Prisma (maps to PostgreSQL `NUMERIC(19,4)` and `NUMERIC(10,4)` respectively). JavaScript `number` (binary floating-point) is never used for financial arithmetic.

## 4. Background Jobs: pg-boss

**Decision:** Use pg-boss (Postgres-backed job queue) for all background processing.

**Rationale:** The system already requires PostgreSQL. pg-boss stores jobs in PostgreSQL tables, supports cron scheduling, retries with backoff, dead-letter queues, and completion events. Adding Redis solely for a job queue (BullMQ) would introduce additional infrastructure without proportional benefit at expected scale. pg-boss is mature, well-documented, and isolates behind the `src/server/jobs/` abstraction layer — migrating to BullMQ later would only require changing that layer.

**Jobs deferred to Phase 1 completion:** The pg-boss worker is scaffolded (`src/server/jobs/queue.ts`, `src/server/jobs/worker.ts`) but no jobs are registered until their feature phase.

## 5. Authentication: NextAuth v5 (JWT strategy)

**Decision:** NextAuth v5 with Credentials provider and JWT strategy.

**Rationale:** JWT strategy embeds `userId`, `role`, and resolved `permissions` in the token, making every API route handler able to check permissions without a database round-trip. The resolved permission list (role defaults merged with per-user overrides) is computed at login time and signed into the JWT. Password hashing uses bcryptjs with cost factor 12.

**Account security:** After `MAX_FAILED_LOGINS` (5) consecutive failures, the account is locked for `LOCKOUT_DURATION_MINUTES` (30). All login events (success and failure) are written to the audit log.

## 6. Authorization: Two-Layer Security Model

**Layer 1 — Customer isolation:** Every query involving customer data is filtered by `CustomerAssignment`. Users with `global_customer_access` (Administrators, optionally Directors) bypass the filter. Enforced in `src/server/authorization/check-customer-access.ts`, called by every service method — not just the API layer.

**Layer 2 — Cost visibility:** Raw product cost is stripped from all API responses, exports, and reports by `src/server/authorization/check-cost-visibility.ts` for users lacking `view_product_cost`. This check is applied at the service layer, not the route handler, so it cannot be bypassed by calling service functions directly.

## 7. Excel Generation: exceljs

**Decision:** Use exceljs for Excel report generation.

**Rationale:** Supports streaming for large workbooks, rich formatting (freeze panes, filters, column widths, number formats, cell styles, alert highlighting), and produces well-formed `.xlsx` files. xlsx-populate was considered but has fewer formatting capabilities.

## 8. Email: nodemailer

**Decision:** nodemailer with SMTP configuration stored encrypted in `SystemConfig`.

**Rationale:** Standard, well-supported, transport-agnostic. SMTP credentials are stored encrypted (AES-256 with key from `APP_ENCRYPTION_KEY` environment variable) and are never returned to the browser after storage.

## 9. Testing: Vitest + Playwright

**Decision:** Vitest for unit and integration tests; Playwright for E2E tests.

**Rationale:** Vitest is fast, natively TypeScript, and integrates cleanly with the Vite-based Next.js dev environment. Playwright provides reliable browser automation for testing the critical security flows (login, customer isolation, role-aware navigation) in a real browser environment.

## 10. State Management: TanStack Query v5

**Decision:** TanStack Query (React Query) for client-side server state management.

**Rationale:** The application has many data-fetch-heavy screens (ROI grid, customer list, alert list) that benefit from caching, background refetching, optimistic updates, and pagination utilities. TanStack Query handles these patterns without requiring a global state library.
