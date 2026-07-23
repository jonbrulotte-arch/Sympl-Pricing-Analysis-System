# Local Development Guide

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- npm

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd Sympl-Pricing-Analysis-System
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and set:
- `DATABASE_URL` — already points to the Docker Postgres instance by default
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `APP_ENCRYPTION_KEY` — generate with `openssl rand -hex 32`

### 3. Start the database

```bash
docker compose up -d db
```

Wait for it to be healthy:
```bash
docker compose ps
```

### 4. Run database migrations

```bash
npm run db:migrate
```

On first run this creates all tables and applies the initial migration.

### 5. Seed test data

```bash
npm run db:seed
```

This creates:
- 4 roles with full permission mappings
- 6 test users (see table below)
- 3 test customers (Acme Corp, Beta Industries, Gamma Retail)
- Customer assignments demonstrating isolation

**Test accounts** (all use password `Admin1234!`):

| Email | Role | Customers | Cost Visibility |
|---|---|---|---|
| admin@sympl.test | Administrator | All (global) | Yes |
| director@sympl.test | Director | Acme, Beta | Yes |
| salesmanager1@sympl.test | Sales Manager | Acme | No |
| salesmanager2@sympl.test | Sales Manager | Beta | No |
| analyst1@sympl.test | Pricing Analyst | Acme | No |
| analyst2@sympl.test | Pricing Analyst | Beta | Yes (override) |

### 6. Start the development server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) — it redirects to `/dashboard`, which redirects to `/login` if not authenticated.

## Running Tests

### Unit tests

```bash
npm test
```

### Unit tests in watch mode

```bash
npm run test:watch
```

### E2E tests (requires dev server running)

```bash
npm run test:e2e
```

## Database Tools

```bash
npm run db:studio    # Open Prisma Studio (visual DB browser)
npm run db:migrate   # Create and apply a new migration
npm run db:seed      # Re-seed test data (safe to run multiple times)
```

## Background Worker

In development, the pg-boss worker can be started separately:

```bash
npm run worker
```

(Not required for Phase 1 — no background jobs are registered yet.)

## Project Structure

See the full directory layout in the main [README.md](../README.md).

## Troubleshooting

**"Cannot connect to database":** Ensure Docker is running and `docker compose up -d db` has been executed. Check `DATABASE_URL` in `.env.local`.

**"Invalid NEXTAUTH_SECRET":** Ensure `NEXTAUTH_SECRET` is set and at least 32 characters.

**"Prisma client not generated":** Run `npm run db:generate` to regenerate the Prisma client after schema changes.
