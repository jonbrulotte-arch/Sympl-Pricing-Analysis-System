import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { bulkActionSchema } from "@/server/validation/roi.schema";
import { enqueueRecalculateBatch, enqueueShippingQuoteRefresh } from "@/server/jobs/queue";
import { db } from "@/lib/db";
import { getAssignedCustomerIds } from "@/server/authorization/check-customer-access";
import { logAction, AuditAction } from "@/server/services/audit-log.service";
import { toApiError } from "@/lib/errors";

export const POST = withAuth(async (session, req: NextRequest) => {
  try {
    const body = await req.json();
    const input = bulkActionSchema.parse(body);

    if (!session.permissions.includes(Permission.GLOBAL_CUSTOMER_ACCESS)) {
      const assignedIds = await getAssignedCustomerIds(session.userId);
      const skus = await db.customerSku.findMany({
        where: { id: { in: input.customerSkuIds } },
        select: { customerId: true },
      });
      const unauthorized = skus.some((s) => !assignedIds.includes(s.customerId));
      if (unauthorized) {
        return NextResponse.json({ error: "Access denied to one or more SKUs" }, { status: 403 });
      }
    }

    switch (input.action) {
      case "recalculate": {
        if (!session.permissions.includes(Permission.RUN_CALCULATIONS)) {
          return NextResponse.json({ error: "run_calculations permission required" }, { status: 403 });
        }
        await enqueueRecalculateBatch(input.customerSkuIds, session.userId);
        return NextResponse.json({ data: { queued: input.customerSkuIds.length } });
      }

      case "refresh-quotes": {
        if (!session.permissions.includes(Permission.REQUEST_SHIPPING_QUOTES)) {
          return NextResponse.json({ error: "request_shipping_quotes permission required" }, { status: 403 });
        }
        await enqueueShippingQuoteRefresh(input.customerSkuIds, session.userId);
        return NextResponse.json({ data: { queued: input.customerSkuIds.length } });
      }

      case "assign-analyst": {
        if (!session.permissions.includes(Permission.MANAGE_CUSTOMER_SKUS)) {
          return NextResponse.json({ error: "manage_customer_skus permission required" }, { status: 403 });
        }
        if (!input.assigneeId) {
          return NextResponse.json({ error: "assigneeId is required for assign-analyst" }, { status: 400 });
        }
        await db.customerSku.updateMany({
          where: { id: { in: input.customerSkuIds } },
          data: { assignedAnalystId: input.assigneeId },
        });
        await logAction({
          userId: session.userId,
          action: AuditAction.SKU_OVERRIDE_CHANGED,
          entityType: "CustomerSku",
          entityId: input.customerSkuIds.join(","),
          afterValue: { assignedAnalystId: input.assigneeId, count: input.customerSkuIds.length },
        });
        return NextResponse.json({ data: { updated: input.customerSkuIds.length } });
      }

      case "export": {
        if (!session.permissions.includes(Permission.EXPORT_DATA)) {
          return NextResponse.json({ error: "export_data permission required" }, { status: 403 });
        }
        return NextResponse.json({ data: { message: "Export queued", ids: input.customerSkuIds } });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_CUSTOMERS]);
