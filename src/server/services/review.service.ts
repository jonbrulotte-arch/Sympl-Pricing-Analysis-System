import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { checkCustomerAccess } from "@/server/authorization/check-customer-access";
import { Permission } from "@/server/authorization/permissions";
import { logAction } from "./audit-log.service";
import type { ReviewStatus } from "@/generated/prisma/client";

type ReviewAction = "request" | "approve" | "escalate" | "reset";

const VALID_TRANSITIONS: Record<ReviewStatus, ReviewAction[]> = {
  PENDING: ["request"],
  UNDER_REVIEW: ["approve", "escalate", "reset"],
  APPROVED: ["reset"],
  ESCALATED: ["approve", "reset"],
};

export async function performReviewAction(
  customerSkuId: string,
  customerId: string,
  action: ReviewAction,
  userId: string,
  permissions: string[],
  note?: string
) {
  const hasAccess = await checkCustomerAccess(userId, customerId, permissions);
  if (!hasAccess) throw new ForbiddenError("Access to this customer is denied");

  const sku = await db.customerSku.findFirst({
    where: { id: customerSkuId, customerId, deletedAt: null },
    select: { id: true, reviewStatus: true, assignedAnalystId: true },
  });
  if (!sku) throw new NotFoundError("CustomerSku");

  const allowed = VALID_TRANSITIONS[sku.reviewStatus];
  if (!allowed.includes(action)) {
    throw new ValidationError(
      `Cannot '${action}' a SKU in '${sku.reviewStatus}' status. Allowed: ${allowed.join(", ")}`
    );
  }

  // Approve/escalate require manage_customer_skus or above
  if ((action === "approve" || action === "escalate") && !permissions.includes(Permission.MANAGE_CUSTOMER_SKUS)) {
    throw new ForbiddenError("Permission denied: manage_customer_skus required");
  }

  const nextStatus: Record<ReviewAction, ReviewStatus> = {
    request: "UNDER_REVIEW",
    approve: "APPROVED",
    escalate: "ESCALATED",
    reset: "PENDING",
  };

  const newStatus = nextStatus[action];
  const prev = sku.reviewStatus;

  await db.customerSku.update({
    where: { id: customerSkuId },
    data: { reviewStatus: newStatus },
  });

  await logAction({
    userId,
    action: `review.${action}`,
    entityType: "CustomerSku",
    entityId: customerSkuId,
    beforeValue: { reviewStatus: prev },
    afterValue: { reviewStatus: newStatus, note: note ?? null },
  });

  // Notify the assigned analyst when review is requested
  if (action === "request" && sku.assignedAnalystId && sku.assignedAnalystId !== userId) {
    await db.notification.create({
      data: {
        userId: sku.assignedAnalystId,
        type: "REVIEW_REQUESTED",
        title: "Review requested",
        body: note ?? null,
        entityType: "CustomerSku",
        entityId: customerSkuId,
      },
    });
  }

  // Notify the assigned analyst when approved or escalated
  if ((action === "approve" || action === "escalate") && sku.assignedAnalystId && sku.assignedAnalystId !== userId) {
    const type = action === "approve" ? "REVIEW_APPROVED" as const : "REVIEW_ESCALATED" as const;
    await db.notification.create({
      data: {
        userId: sku.assignedAnalystId,
        type,
        title: action === "approve" ? "Review approved" : "Review escalated",
        body: note ?? null,
        entityType: "CustomerSku",
        entityId: customerSkuId,
      },
    });
  }

  return { reviewStatus: newStatus };
}
