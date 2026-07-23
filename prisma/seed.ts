import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { ROLE_PERMISSIONS } from "../src/server/authorization/permissions";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database…");

  // ── Roles ──────────────────────────────────────────────────────
  const roleNames = ["ADMINISTRATOR", "DIRECTOR", "SALES_MANAGER", "PRICING_ANALYST"] as const;
  const roles: Record<string, { id: string }> = {};

  for (const name of roleNames) {
    const role = await db.role.upsert({
      where: { name },
      create: { name, description: name.replace(/_/g, " "), isSystem: true },
      update: {},
    });
    roles[name] = role;
  }

  // ── Permissions ─────────────────────────────────────────────────
  const permissionDefs = [
    { code: "view_customers", description: "View assigned customers", category: "Customers" },
    { code: "manage_customers", description: "Create and edit customers", category: "Customers" },
    { code: "global_customer_access", description: "Access all customers regardless of assignment", category: "Customers" },
    { code: "view_products", description: "View products", category: "Products" },
    { code: "manage_products", description: "Create and edit products", category: "Products" },
    { code: "view_product_cost", description: "View raw product cost", category: "Cost" },
    { code: "edit_product_cost", description: "Edit raw product cost", category: "Cost" },
    { code: "view_calculated_margin", description: "View calculated margin percentages", category: "Cost" },
    { code: "view_shipping_cost", description: "View shipping cost", category: "Cost" },
    { code: "view_customer_pricing", description: "View customer pricing", category: "Cost" },
    { code: "export_financial_data", description: "Export financial data", category: "Cost" },
    { code: "manage_customer_skus", description: "Manage customer SKU assignments", category: "Analysis" },
    { code: "run_calculations", description: "Trigger profitability recalculations", category: "Analysis" },
    { code: "request_shipping_quotes", description: "Request shipping rate quotes", category: "Analysis" },
    { code: "manage_allocations", description: "Manage customer allocations", category: "Analysis" },
    { code: "manage_margin_requirements", description: "Manage minimum margin requirements", category: "Analysis" },
    { code: "view_alerts", description: "View profitability alerts", category: "Alerts" },
    { code: "manage_alerts", description: "Update alert statuses", category: "Alerts" },
    { code: "add_comments", description: "Add comments and mentions", category: "Collaboration" },
    { code: "manage_comments", description: "Delete and manage all comments", category: "Collaboration" },
    { code: "import_data", description: "Import data from files", category: "Import/Export" },
    { code: "export_data", description: "Export data to files", category: "Import/Export" },
    { code: "view_reports", description: "View reports", category: "Reports" },
    { code: "manage_reports", description: "Configure and schedule reports", category: "Reports" },
    { code: "manage_users", description: "Create and manage users", category: "Admin" },
    { code: "manage_roles", description: "Manage roles and permissions", category: "Admin" },
    { code: "manage_system_config", description: "Manage system configuration", category: "Admin" },
    { code: "manage_shipping_config", description: "Manage shipping API credentials", category: "Admin" },
    { code: "manage_smtp_config", description: "Manage SMTP configuration", category: "Admin" },
    { code: "manage_backups", description: "Configure and run backups", category: "Admin" },
    { code: "view_audit_log", description: "View audit log", category: "Admin" },
    { code: "view_jobs", description: "View background job status", category: "Admin" },
  ];

  const permMap: Record<string, { id: string }> = {};
  for (const def of permissionDefs) {
    const perm = await db.permission.upsert({
      where: { code: def.code },
      create: def,
      update: { description: def.description },
    });
    permMap[def.code] = perm;
  }

  // ── Role-Permission mappings ────────────────────────────────────
  for (const [roleName, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roles[roleName]?.id;
    if (!roleId) continue;

    for (const code of permCodes) {
      const permId = permMap[code]?.id;
      if (!permId) continue;

      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permId } },
        create: { roleId, permissionId: permId },
        update: {},
      });
    }
  }

  // ── Customers ───────────────────────────────────────────────────
  const acme = await db.customer.upsert({
    where: { code: "ACME" },
    create: {
      name: "Acme Corp",
      code: "ACME",
      status: "ACTIVE",
      shippingTerms: "PREPAID",
      currency: "USD",
      description: "Primary test customer — prepaid shipping",
    },
    update: {},
  });

  const beta = await db.customer.upsert({
    where: { code: "BETA" },
    create: {
      name: "Beta Industries",
      code: "BETA",
      status: "ACTIVE",
      shippingTerms: "COLLECT",
      currency: "USD",
      description: "Secondary test customer — collect shipping",
    },
    update: {},
  });

  const gamma = await db.customer.upsert({
    where: { code: "GAMMA" },
    create: {
      name: "Gamma Retail",
      code: "GAMMA",
      status: "ACTIVE",
      shippingTerms: "PREPAID",
      currency: "USD",
      description: "Unassigned test customer — only admin can access",
    },
    update: {},
  });

  // ── Users ────────────────────────────────────────────────────────
  const hash = (pw: string) => bcrypt.hash(pw, 12);

  const users = [
    { email: "admin@sympl.test", firstName: "Admin", lastName: "User", role: "ADMINISTRATOR", password: "Admin1234!" },
    { email: "director@sympl.test", firstName: "Dana", lastName: "Director", role: "DIRECTOR", password: "Admin1234!" },
    { email: "salesmanager1@sympl.test", firstName: "Sam", lastName: "Manager", role: "SALES_MANAGER", password: "Admin1234!" },
    { email: "salesmanager2@sympl.test", firstName: "Sara", lastName: "Sales", role: "SALES_MANAGER", password: "Admin1234!" },
    { email: "analyst1@sympl.test", firstName: "Alex", lastName: "Analyst", role: "PRICING_ANALYST", password: "Admin1234!" },
    { email: "analyst2@sympl.test", firstName: "Aria", lastName: "Price", role: "PRICING_ANALYST", password: "Admin1234!" },
  ];

  const createdUsers: Record<string, { id: string }> = {};

  for (const u of users) {
    const passwordHash = await hash(u.password);
    const user = await db.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        roleId: roles[u.role].id,
      },
      update: {},
    });
    createdUsers[u.email] = user;
  }

  const adminId = createdUsers["admin@sympl.test"].id;

  // ── Customer assignments ─────────────────────────────────────────
  // Admin has global_customer_access via role — no explicit assignments needed
  // Director: Acme + Beta
  // SalesManager1: Acme
  // SalesManager2: Beta
  // Analyst1: Acme (no cost visibility)
  // Analyst2: Beta (will get cost visibility override below)

  const assignments = [
    { userId: createdUsers["director@sympl.test"].id, customerId: acme.id, role: "OWNER" as const },
    { userId: createdUsers["director@sympl.test"].id, customerId: beta.id, role: "OWNER" as const },
    { userId: createdUsers["salesmanager1@sympl.test"].id, customerId: acme.id, role: "MANAGER" as const },
    { userId: createdUsers["salesmanager2@sympl.test"].id, customerId: beta.id, role: "MANAGER" as const },
    { userId: createdUsers["analyst1@sympl.test"].id, customerId: acme.id, role: "ANALYST" as const },
    { userId: createdUsers["analyst2@sympl.test"].id, customerId: beta.id, role: "ANALYST" as const },
  ];

  for (const a of assignments) {
    await db.customerAssignment.upsert({
      where: { userId_customerId: { userId: a.userId, customerId: a.customerId } },
      create: { ...a, assignedById: adminId },
      update: { role: a.role },
    });
  }

  // ── User permission overrides ────────────────────────────────────
  // Grant analyst2 view_product_cost to demonstrate per-user overrides
  const viewCostPermId = permMap["view_product_cost"]?.id;
  if (viewCostPermId) {
    await db.userPermission.upsert({
      where: {
        userId_permissionId: {
          userId: createdUsers["analyst2@sympl.test"].id,
          permissionId: viewCostPermId,
        },
      },
      create: {
        userId: createdUsers["analyst2@sympl.test"].id,
        permissionId: viewCostPermId,
        grantedBy: adminId,
      },
      update: {},
    });
  }

  console.log("Seed complete.");
  console.log(`  Roles:       ${roleNames.length}`);
  console.log(`  Permissions: ${permissionDefs.length}`);
  console.log(`  Customers:   3 (Acme, Beta, Gamma)`);
  console.log(`  Users:       ${users.length}`);
  console.log();
  console.log("Test accounts (password: Admin1234!):");
  for (const u of users) {
    console.log(`  ${u.email.padEnd(32)} [${u.role}]`);
  }
  console.log();
  console.log("Isolation proof:");
  console.log("  analyst1@sympl.test → Acme only, no cost visibility");
  console.log("  analyst2@sympl.test → Beta only, cost visibility override");
  console.log("  admin@sympl.test    → All customers (global_customer_access)");
  console.log("  Gamma Retail        → Only visible to admin");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
