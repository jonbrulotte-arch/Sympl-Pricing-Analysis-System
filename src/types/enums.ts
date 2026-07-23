export type RoleName = "ADMINISTRATOR" | "DIRECTOR" | "SALES_MANAGER" | "PRICING_ANALYST";

export type AssignmentRole = "OWNER" | "MANAGER" | "ANALYST" | "VIEWER";

export type CustomerStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";

export type ShippingTerms = "PREPAID" | "COLLECT";

export type AlertSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";

export type AlertStatus =
  | "NEW"
  | "OPEN"
  | "IN_REVIEW"
  | "AWAITING_INFO"
  | "ACTION_REQUIRED"
  | "RESOLVED"
  | "DISMISSED"
  | "REOPENED";

export type ImportBatchStatus =
  | "PENDING"
  | "VALIDATING"
  | "PREVIEW"
  | "CONFIRMED"
  | "COMMITTED"
  | "FAILED"
  | "ROLLED_BACK";

export type ReviewStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED";
