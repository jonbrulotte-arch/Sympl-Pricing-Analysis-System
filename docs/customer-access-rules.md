# Customer Access Authorization Rules

## The Core Isolation Rule

A user may only view, search, and interact with customers to which they have been explicitly assigned via the `CustomerAssignment` table. This restriction is enforced at the backend service layer and database query level — it cannot be bypassed by navigating to a URL, crafting an API request, or importing data.

## CustomerAssignment Model

```
CustomerAssignment
  userId         FK → User
  customerId     FK → Customer
  assignedById   FK → User (who performed the assignment)
  role           OWNER | MANAGER | ANALYST | VIEWER
  createdAt
```

## Access Check Flow

```
Request arrives with authenticated session (userId, permissions[])
          ↓
Does user have global_customer_access permission?
  YES → Proceed without filtering
  NO  → Query CustomerAssignment WHERE userId = session.userId AND customerId = requested customerId
          ↓
         Assignment found? YES → Proceed
         Assignment found? NO  → Return 403 Forbidden
```

## List Query Pattern

Every list query that returns customer-level data must include a WHERE clause:

```sql
-- For users without global_customer_access:
WHERE customer.id IN (
  SELECT customer_id FROM customer_assignments WHERE user_id = $userId
)

-- For users with global_customer_access:
-- No filter applied
```

This is implemented in `src/server/services/customer.service.ts::listCustomers()` and must be replicated in every service function that lists customer-related data (customer SKUs, allocations, shipping quotes, alerts, comments, etc.).

## Who Has Global Access

- **Administrators:** Always have `global_customer_access` via role default
- **Directors:** May have `global_customer_access` if granted (via `UserPermission` override or role configuration)
- **All others:** Never — regardless of any other permission

## Scoped Data

The customer isolation applies to all data that belongs to or references a customer:

| Entity | Isolation Mechanism |
|---|---|
| Customer profiles | `CustomerAssignment` filter on list; access check on get-by-id |
| Customer SKUs | Inherited from parent customer |
| Customer allocations | Inherited from parent customer |
| Customer margin requirements | Inherited from parent customer |
| Shipping quotes | Inherited via CustomerSku → Customer |
| Calculation results | Inherited via CustomerSku → Customer |
| Alerts | Inherited via CustomerSku → Customer |
| Comments | Inherited via CustomerSku → Customer |
| Reports | Only include authorized customers |
| Search results | Never return restricted customer names, codes, or SKUs |
| Exports | Filter to authorized customers |

## User Mention Restriction

When adding comments, users may only `@mention` users who are also assigned to the same customer. The mention autocomplete must filter to authorized users only. A mention notification must never expose customer information to the mentioned user if they lack customer access.

## Testing Requirements

The following integration tests are required for every PR:

1. `GET /api/customers` returns only assigned customers for a non-global user
2. `GET /api/customers/:id` returns 403 for a customer the user is not assigned to
3. `GET /api/customers/:id` returns 200 for an Administrator accessing any customer
4. Customer data does not appear in search results for unauthorized users
5. Manually constructed URLs (`/customers/{unassigned-id}/roi`) result in 403, not a data leak
