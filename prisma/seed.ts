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

  // ── Payment Terms ────────────────────────────────────────────────
  const net30 = await db.paymentTerm.upsert({
    where: { name: "Net 30" },
    create: { name: "Net 30", days: 30, description: "Payment due within 30 days of invoice" },
    update: {},
  });

  await db.paymentTerm.upsert({
    where: { name: "Net 60" },
    create: { name: "Net 60", days: 60, description: "Payment due within 60 days of invoice" },
    update: {},
  });

  await db.paymentTerm.upsert({
    where: { name: "Net 90" },
    create: { name: "Net 90", days: 90, description: "Payment due within 90 days of invoice" },
    update: {},
  });

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
      paymentTermId: net30.id,
      defaultOriginPostalCode: "10001",
      defaultDestinationPostalCode: "90210",
    },
    update: { paymentTermId: net30.id },
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

  // ── Customer Contacts ─────────────────────────────────────────────
  const acmeContact = await db.customerContact.upsert({
    where: { id: "seed-contact-acme-01" },
    create: {
      id: "seed-contact-acme-01",
      customerId: acme.id,
      name: "Jane Smith",
      title: "VP of Purchasing",
      email: "jane.smith@acmecorp.example",
      phone: "212-555-0101",
      isPrimary: true,
    },
    update: {},
  });
  void acmeContact;

  await db.customerContact.upsert({
    where: { id: "seed-contact-acme-02" },
    create: {
      id: "seed-contact-acme-02",
      customerId: acme.id,
      name: "Bob Johnson",
      title: "Logistics Manager",
      email: "bob.johnson@acmecorp.example",
      phone: "212-555-0102",
      isPrimary: false,
    },
    update: {},
  });

  // ── Customer Margin Requirements ──────────────────────────────────
  await db.customerMarginRequirement.upsert({
    where: { customerId: acme.id },
    create: {
      customerId: acme.id,
      minimumMarginPercent: 35,
      warningThresholdPercent: 40,
      criticalThresholdPercent: 30,
      calculationMethod: "CONTRIBUTION_MARGIN",
      notes: "Standard margin floor for Acme program",
    },
    update: {},
  });

  await db.customerMarginRequirement.upsert({
    where: { customerId: beta.id },
    create: {
      customerId: beta.id,
      minimumMarginPercent: 38,
      warningThresholdPercent: 43,
      criticalThresholdPercent: 32,
      calculationMethod: "CONTRIBUTION_MARGIN",
    },
    update: {},
  });

  // ── Customer Allocations ──────────────────────────────────────────
  await db.customerAllocation.upsert({
    where: { id: "seed-alloc-acme-01" },
    create: {
      id: "seed-alloc-acme-01",
      customerId: acme.id,
      name: "Sales Commission",
      description: "Standard sales rep commission",
      calculationType: "PERCENT_OF_SELLING_PRICE",
      rate: 0.05,
      priority: 1,
      isActive: true,
      effectiveDate: new Date("2025-01-01"),
    },
    update: {},
  });

  await db.customerAllocation.upsert({
    where: { id: "seed-alloc-acme-02" },
    create: {
      id: "seed-alloc-acme-02",
      customerId: acme.id,
      name: "Volume Rebate",
      description: "Annual volume rebate",
      calculationType: "PERCENT_OF_SELLING_PRICE",
      rate: 0.03,
      priority: 2,
      isActive: true,
      effectiveDate: new Date("2025-01-01"),
      expirationDate: new Date("2025-12-31"),
    },
    update: {},
  });

  // ── Product Categories ────────────────────────────────────────────
  const beverages = await db.productCategory.upsert({
    where: { id: "seed-cat-beverages" },
    create: {
      id: "seed-cat-beverages",
      name: "Beverages",
      dunnagePercent: 0.08,
    },
    update: {},
  });

  const carbonated = await db.productCategory.upsert({
    where: { id: "seed-cat-carbonated" },
    create: {
      id: "seed-cat-carbonated",
      name: "Carbonated Drinks",
      parentId: beverages.id,
      dunnagePercent: 0.10,
    },
    update: {},
  });

  const nonCarbonated = await db.productCategory.upsert({
    where: { id: "seed-cat-noncarbonated" },
    create: {
      id: "seed-cat-noncarbonated",
      name: "Non-Carbonated Drinks",
      parentId: beverages.id,
      dunnagePercent: 0.08,
    },
    update: {},
  });

  // ── Products ──────────────────────────────────────────────────────
  const today = new Date("2025-01-01");

  const cola12pk = await db.product.upsert({
    where: { sku: "BEV-COLA-12PK" },
    create: {
      sku: "BEV-COLA-12PK",
      name: "Classic Cola 12-Pack",
      brand: "Refresh Brand",
      upc: "012345678901",
      categoryId: carbonated.id,
      unitOfMeasure: "CASE",
      isActive: true,
      length: 10.5, width: 7.25, height: 5.0, weight: 9.5,
      shippingLength: 11.0, shippingWidth: 7.75, shippingHeight: 5.5, shippingWeight: 10.0,
      currentCost: 4.20, costEffectiveDate: today, costSource: "ERP",
    },
    update: {},
  });

  const sparklingWater = await db.product.upsert({
    where: { sku: "BEV-SPRK-24PK" },
    create: {
      sku: "BEV-SPRK-24PK",
      name: "Sparkling Water 24-Pack",
      brand: "Refresh Brand",
      upc: "012345678902",
      categoryId: carbonated.id,
      unitOfMeasure: "CASE",
      isActive: true,
      length: 14.0, width: 10.0, height: 6.0, weight: 18.0,
      shippingLength: 14.5, shippingWidth: 10.5, shippingHeight: 6.5, shippingWeight: 18.5,
      currentCost: 6.80, costEffectiveDate: today, costSource: "ERP",
      futureCost: 7.10, futureCostEffectiveDate: new Date("2026-01-01"),
    },
    update: {},
  });

  const juiceBlend = await db.product.upsert({
    where: { sku: "BEV-JUICE-6PK" },
    create: {
      sku: "BEV-JUICE-6PK",
      name: "Tropical Juice Blend 6-Pack",
      brand: "Orchard Fresh",
      upc: "012345678903",
      categoryId: nonCarbonated.id,
      unitOfMeasure: "CASE",
      isActive: true,
      length: 9.0, width: 6.0, height: 8.0, weight: 12.0,
      shippingLength: 9.5, shippingWidth: 6.5, shippingHeight: 8.5, shippingWeight: 12.5,
      currentCost: 5.50, costEffectiveDate: today, costSource: "ERP",
    },
    update: {},
  });

  const energyDrink = await db.product.upsert({
    where: { sku: "BEV-ENRG-24PK" },
    create: {
      sku: "BEV-ENRG-24PK",
      name: "Energy Boost 24-Pack",
      brand: "Volt Energy",
      upc: "012345678904",
      categoryId: carbonated.id,
      unitOfMeasure: "CASE",
      isActive: true,
      length: 13.0, width: 9.0, height: 5.5, weight: 16.0,
      shippingLength: 13.5, shippingWidth: 9.5, shippingHeight: 6.0, shippingWeight: 16.5,
      currentCost: 9.20, costEffectiveDate: today, costSource: "ERP",
    },
    update: {},
  });

  const teaVariety = await db.product.upsert({
    where: { sku: "BEV-TEA-12PK" },
    create: {
      sku: "BEV-TEA-12PK",
      name: "Green Tea Variety 12-Pack",
      brand: "Orchard Fresh",
      upc: "012345678905",
      categoryId: nonCarbonated.id,
      unitOfMeasure: "CASE",
      isActive: true,
      length: 10.0, width: 7.0, height: 5.0, weight: 8.0,
      shippingLength: 10.5, shippingWidth: 7.5, shippingHeight: 5.5, shippingWeight: 8.5,
      currentCost: 3.90, costEffectiveDate: today, costSource: "ERP",
    },
    update: {},
  });

  // ── Product Cost History ──────────────────────────────────────────
  for (const { productId, cost } of [
    { productId: cola12pk.id, cost: 3.90 },
    { productId: sparklingWater.id, cost: 6.40 },
    { productId: juiceBlend.id, cost: 5.10 },
    { productId: energyDrink.id, cost: 8.80 },
    { productId: teaVariety.id, cost: 3.60 },
  ]) {
    const existing = await db.productCostHistory.findFirst({ where: { productId } });
    if (!existing) {
      await db.productCostHistory.create({
        data: {
          productId,
          cost,
          effectiveDate: new Date("2024-07-01"),
          source: "ERP",
          recordedById: adminId,
        },
      });
    }
  }

  // ── Customer SKUs (Acme Corp) ─────────────────────────────────────
  const acmeSkus = [
    { product: cola12pk, price: 10.95, code: "ACME-COLA-12PK" },
    { product: sparklingWater, price: 16.50, code: "ACME-SPRK-24PK" },
    { product: juiceBlend, price: 13.25, code: "ACME-JUICE-6PK" },
    { product: energyDrink, price: 22.00, code: "ACME-ENRG-24PK" },
  ];

  for (const { product, price, code } of acmeSkus) {
    const existing = await db.customerSku.findUnique({
      where: { customerId_productId: { customerId: acme.id, productId: product.id } },
    });

    if (!existing) {
      const sku = await db.customerSku.create({
        data: {
          customerId: acme.id,
          productId: product.id,
          customerSkuCode: code,
          sellingPrice: price,
          packageQuantity: 1,
          alertStatus: "OK",
          reviewStatus: "APPROVED",
          assignedAnalystId: createdUsers["analyst1@sympl.test"].id,
        },
      });

      await db.customerPriceHistory.create({
        data: {
          customerSkuId: sku.id,
          sellingPrice: price,
          effectiveDate: new Date("2025-01-01"),
          recordedById: adminId,
        },
      });
    }
  }

  // ── Customer SKUs (Beta Industries) ──────────────────────────────
  const betaSkus = [
    { product: cola12pk, price: 11.25, code: "BETA-COLA-12PK" },
    { product: energyDrink, price: 23.50, code: "BETA-ENRG-24PK" },
    { product: teaVariety, price: 9.75, code: "BETA-TEA-12PK" },
  ];

  for (const { product, price, code } of betaSkus) {
    const existing = await db.customerSku.findUnique({
      where: { customerId_productId: { customerId: beta.id, productId: product.id } },
    });

    if (!existing) {
      const sku = await db.customerSku.create({
        data: {
          customerId: beta.id,
          productId: product.id,
          customerSkuCode: code,
          sellingPrice: price,
          packageQuantity: 1,
          alertStatus: "OK",
          reviewStatus: "APPROVED",
          assignedAnalystId: createdUsers["analyst2@sympl.test"].id,
        },
      });

      await db.customerPriceHistory.create({
        data: {
          customerSkuId: sku.id,
          sellingPrice: price,
          effectiveDate: new Date("2025-01-01"),
          recordedById: adminId,
        },
      });
    }
  }

  void gamma;

  console.log("Seed complete.");
  console.log(`  Roles:              ${roleNames.length}`);
  console.log(`  Permissions:        ${permissionDefs.length}`);
  console.log(`  Payment Terms:      3`);
  console.log(`  Customers:          3 (Acme, Beta, Gamma)`);
  console.log(`  Users:              ${users.length}`);
  console.log(`  Product Categories: 3 (Beverages > Carbonated, Non-Carbonated)`);
  console.log(`  Products:           5`);
  console.log(`  Customer SKUs:      4 (Acme) + 3 (Beta)`);
  console.log();
  console.log("Test accounts (password: Admin1234!):");
  for (const u of users) {
    console.log(`  ${u.email.padEnd(36)} [${u.role}]`);
  }
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
