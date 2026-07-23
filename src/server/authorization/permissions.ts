export const Permission = {
  // Customer access
  VIEW_CUSTOMERS: "view_customers",
  MANAGE_CUSTOMERS: "manage_customers",
  GLOBAL_CUSTOMER_ACCESS: "global_customer_access",

  // Product access
  VIEW_PRODUCTS: "view_products",
  MANAGE_PRODUCTS: "manage_products",

  // Cost visibility (critical security boundary)
  VIEW_PRODUCT_COST: "view_product_cost",
  EDIT_PRODUCT_COST: "edit_product_cost",
  VIEW_CALCULATED_MARGIN: "view_calculated_margin",
  VIEW_SHIPPING_COST: "view_shipping_cost",
  VIEW_CUSTOMER_PRICING: "view_customer_pricing",
  EXPORT_FINANCIAL_DATA: "export_financial_data",

  // SKU and analysis
  MANAGE_CUSTOMER_SKUS: "manage_customer_skus",
  RUN_CALCULATIONS: "run_calculations",
  REQUEST_SHIPPING_QUOTES: "request_shipping_quotes",
  MANAGE_ALLOCATIONS: "manage_allocations",
  MANAGE_MARGIN_REQUIREMENTS: "manage_margin_requirements",

  // Alerts and comments
  VIEW_ALERTS: "view_alerts",
  MANAGE_ALERTS: "manage_alerts",
  ADD_COMMENTS: "add_comments",
  MANAGE_COMMENTS: "manage_comments",

  // Import / export
  IMPORT_DATA: "import_data",
  EXPORT_DATA: "export_data",

  // Reports
  VIEW_REPORTS: "view_reports",
  MANAGE_REPORTS: "manage_reports",

  // Administration
  MANAGE_USERS: "manage_users",
  MANAGE_ROLES: "manage_roles",
  MANAGE_SYSTEM_CONFIG: "manage_system_config",
  MANAGE_SHIPPING_CONFIG: "manage_shipping_config",
  MANAGE_SMTP_CONFIG: "manage_smtp_config",
  MANAGE_BACKUPS: "manage_backups",
  VIEW_AUDIT_LOG: "view_audit_log",
  VIEW_JOBS: "view_jobs",
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];

// Default permissions granted per role
export const ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  ADMINISTRATOR: Object.values(Permission) as PermissionCode[],

  DIRECTOR: [
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_PRODUCTS,
    Permission.VIEW_PRODUCT_COST,
    Permission.VIEW_CALCULATED_MARGIN,
    Permission.VIEW_SHIPPING_COST,
    Permission.VIEW_CUSTOMER_PRICING,
    Permission.EXPORT_FINANCIAL_DATA,
    Permission.MANAGE_CUSTOMER_SKUS,
    Permission.RUN_CALCULATIONS,
    Permission.REQUEST_SHIPPING_QUOTES,
    Permission.MANAGE_ALLOCATIONS,
    Permission.MANAGE_MARGIN_REQUIREMENTS,
    Permission.VIEW_ALERTS,
    Permission.MANAGE_ALERTS,
    Permission.ADD_COMMENTS,
    Permission.EXPORT_DATA,
    Permission.VIEW_REPORTS,
    Permission.MANAGE_REPORTS,
  ],

  SALES_MANAGER: [
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_PRODUCTS,
    Permission.VIEW_CALCULATED_MARGIN,
    Permission.VIEW_SHIPPING_COST,
    Permission.VIEW_CUSTOMER_PRICING,
    Permission.EXPORT_FINANCIAL_DATA,
    Permission.MANAGE_CUSTOMER_SKUS,
    Permission.RUN_CALCULATIONS,
    Permission.REQUEST_SHIPPING_QUOTES,
    Permission.VIEW_ALERTS,
    Permission.MANAGE_ALERTS,
    Permission.ADD_COMMENTS,
    Permission.EXPORT_DATA,
    Permission.VIEW_REPORTS,
  ],

  PRICING_ANALYST: [
    Permission.VIEW_CUSTOMERS,
    Permission.VIEW_PRODUCTS,
    Permission.VIEW_CALCULATED_MARGIN,
    Permission.VIEW_SHIPPING_COST,
    Permission.VIEW_CUSTOMER_PRICING,
    Permission.RUN_CALCULATIONS,
    Permission.REQUEST_SHIPPING_QUOTES,
    Permission.VIEW_ALERTS,
    Permission.MANAGE_ALERTS,
    Permission.ADD_COMMENTS,
    Permission.IMPORT_DATA,
    Permission.EXPORT_DATA,
    Permission.VIEW_REPORTS,
  ],
};
