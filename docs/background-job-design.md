# Background Job Design

## Technology: pg-boss

pg-boss is a PostgreSQL-backed job queue. It runs as a Node.js worker process alongside the Next.js app, sharing the same Postgres instance. No Redis or separate infrastructure is required.

Key features used:
- **Named queues** — each job type is a named queue with independent concurrency and retry settings
- **Cron scheduling** — `boss.schedule()` registers recurring jobs
- **Dead-letter queues** — failed jobs after max retries are moved to a DLQ for inspection
- **Singleton jobs** — `singletonKey` prevents duplicate jobs for the same entity

---

## Worker Entry Point

`src/server/jobs/worker.ts` is the standalone worker process, started by `npm run worker`:

```typescript
import { boss } from "./queue";
import { registerHandlers } from "./handlers";

await boss.start();
await registerHandlers(boss);
console.log("Worker started");
```

In production, this process runs as a separate container or systemd service alongside the Next.js app.

In development, it is started manually with `npm run worker` (not required for Phase 1 — no jobs registered yet).

---

## Queue Singleton

`src/server/jobs/queue.ts`:

```typescript
import PgBoss from "pg-boss";

const globalForBoss = globalThis as unknown as { boss?: PgBoss };

export const boss =
  globalForBoss.boss ??
  new PgBoss({
    connectionString: process.env.DATABASE_URL,
    retryLimit: 3,
    retryDelay: 60,    // seconds between retries
    expireInHours: 24,
  });

if (process.env.NODE_ENV !== "production") {
  globalForBoss.boss = boss;
}
```

---

## Registered Jobs

### `data-import`

**Trigger:** `POST /api/imports` — user uploads an Excel file.

| Setting | Value |
|---|---|
| Queue | `data-import` |
| Concurrency | 2 (limit parallel imports) |
| Retry limit | 3 |
| Singleton key | `batchId` |

Handler: Runs the 10-step import loop (see `docs/import-export-workflow.md`). Updates `ImportBatch` status throughout.

---

### `recalculate-sku`

**Trigger:** CustomerSku price change, cost change, allocation change, or manual "Recalculate" action.

| Setting | Value |
|---|---|
| Queue | `recalculate-sku` |
| Concurrency | 10 |
| Retry limit | 3 |
| Singleton key | `customerSkuId` (prevents duplicate recalculations for same SKU) |

Handler: Calls `CalculationService.calculate(customerSkuId)`. Inserts a `CalculationResult`. Updates `CustomerSku.alertStatus` and `CustomerSku.lastCalculatedAt`. Creates/resolves alerts.

---

### `recalculate-batch`

**Trigger:** Import completion (`data-import` job), bulk recalculate action from ROI grid.

| Setting | Value |
|---|---|
| Queue | `recalculate-batch` |
| Concurrency | 2 |
| Retry limit | 2 |

Handler: Fans out individual `recalculate-sku` jobs for each SKU ID in the batch payload. Does not do the calculation itself.

---

### `shipping-quote-refresh`

**Trigger:** Bulk "Refresh Quotes" action from ROI grid, or after import completion.

| Setting | Value |
|---|---|
| Queue | `shipping-quote-refresh` |
| Concurrency | 3 |
| Retry limit | 2 |

Handler: Calls the appropriate `ShippingRateProvider` for each CustomerSku. Stores `ShippingQuote`. Applies selection rules. Enqueues `recalculate-sku` for affected SKUs.

---

### `shipping-quote-expiry-check` (cron)

**Schedule:** `0 2 * * *` — 2 AM UTC daily.

Handler:
1. Finds CustomerSkus with PREPAID shipping terms where all quotes are expired or missing.
2. Creates `EXPIRED_QUOTE` or `NO_SHIPPING_QUOTE` alerts.
3. Does not enqueue new quote requests automatically (user must trigger a refresh).

---

### `generate-scheduled-report` (cron)

**Schedule:** `0 6 * * 1` — Monday 6 AM UTC.

Handler: Loads active `ScheduledReport` records, generates personalized workbooks, sends via email, logs delivery.

---

### `review-sla-check` (cron)

**Schedule:** `0 8 * * *` — 8 AM UTC daily.

Handler: Finds CustomerSkus in PENDING review status where `lastCalculatedAt < now() - reviewSlaDays`. Creates `REVIEW_OVERDUE` alerts.

---

## Retry Policy

All jobs follow the global retry policy unless overridden per queue:

- Retry limit: 3
- Retry delay: 60 seconds (exponential backoff on subsequent retries)
- After max retries: job moves to `__dead_letter__` queue

Administrators can view and re-queue dead-letter jobs in the admin panel (Phase 8).

---

## Job Monitoring

The admin panel (Phase 8) exposes a job monitoring view that queries the pg-boss internal tables:

- Queue backlog sizes
- In-progress job counts
- Dead-letter queue contents with error messages
- Recent job completion history

pg-boss maintains its job table in the `pgboss` schema in the same Postgres database.

---

## Environment: Worker vs. Web Process

| Concern | Web Process (Next.js) | Worker Process |
|---|---|---|
| Enqueues jobs | Yes — via `boss.send()` | No |
| Handles jobs | No | Yes — via `boss.work()` |
| Connects to Postgres | Yes | Yes (same DATABASE_URL) |
| HTTP port | 3000 | None |

The web process **enqueues** but never **handles** jobs. This separation ensures slow jobs never block HTTP responses. In development, both can run on the same machine; in production, the worker should be scaled independently.
