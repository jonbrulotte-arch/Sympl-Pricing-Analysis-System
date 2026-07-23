# Sympl PAS — Pricing Analysis System

A secure, multi-user, web-based customer pricing, cost, shipping, profitability, and margin analysis platform. Sympl PAS helps sales managers, pricing analysts, and leadership evaluate the financial health of customer programs at the individual SKU level.

## Quick Start

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env.local
# Set NEXTAUTH_SECRET and APP_ENCRYPTION_KEY (see docs/local-development.md)

# Start PostgreSQL
docker compose up -d db

# Run migrations and seed
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000). Log in with `admin@sympl.test` / `Admin1234!`.

See [docs/local-development.md](docs/local-development.md) for complete setup and all test accounts.

## Documentation

| Document | Description |
|---|---|
| [docs/architecture-decisions.md](docs/architecture-decisions.md) | Technology choices and rationale |
| [docs/roles-permissions-matrix.md](docs/roles-permissions-matrix.md) | Role and permission model |
| [docs/customer-access-rules.md](docs/customer-access-rules.md) | Customer isolation enforcement |
| [docs/cost-visibility-rules.md](docs/cost-visibility-rules.md) | Product cost confidentiality rules |
| [docs/profitability-formula.md](docs/profitability-formula.md) | Calculation engine design and formulas |
| [docs/phased-development-plan.md](docs/phased-development-plan.md) | 8-phase implementation roadmap |
| [docs/local-development.md](docs/local-development.md) | Local setup and test accounts |
| [SPEC.md](SPEC.md) | Full product requirements specification |
| [SYMPL-DESIGN-SYSTEM.md](SYMPL-DESIGN-SYSTEM.md) | Front-end design system reference |

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19 |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL + Prisma 7 (driver-adapter) |
| Auth | NextAuth v5 (JWT) |
| Background Jobs | pg-boss |
| Excel | exceljs |
| Testing | Vitest + Playwright |

## Scripts

```bash
npm run dev          # Start development server
npm test             # Run unit and integration tests
npm run test:e2e     # Run Playwright E2E tests
npm run db:migrate   # Create and apply database migration
npm run db:seed      # Seed development data
npm run db:studio    # Open Prisma Studio
npm run db:generate  # Regenerate Prisma client after schema change
npm run worker       # Start background job worker
```

## Security

- Customer isolation enforced at the database query level
- Raw product cost restricted to authorized roles and users
- Immutable audit log for all sensitive actions
- Fixed-precision decimals for all financial values
- Account lockout after 5 consecutive failed login attempts
- Encrypted storage for API credentials and SMTP passwords
