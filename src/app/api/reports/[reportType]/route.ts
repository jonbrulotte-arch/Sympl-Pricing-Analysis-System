import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import {
  generatePortfolioMarginReport,
  generateAlertSummaryReport,
  generatePriceHistoryReport,
} from "@/server/services/report.service";
import { toApiError } from "@/lib/errors";

type Ctx = { params: Promise<{ reportType: string }> };

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const GET = withAuth(async (session, req: NextRequest, ctx: Ctx) => {
  try {
    const { reportType } = await ctx.params;
    const { searchParams } = new URL(req.url);

    let buffer: Buffer;
    let filename: string;

    const date = new Date().toISOString().split("T")[0];

    switch (reportType) {
      case "portfolio-margin": {
        buffer = await generatePortfolioMarginReport(session.userId, session.permissions);
        filename = `portfolio-margin-${date}.xlsx`;
        break;
      }
      case "alert-summary": {
        buffer = await generateAlertSummaryReport(session.userId, session.permissions);
        filename = `alert-summary-${date}.xlsx`;
        break;
      }
      case "price-history": {
        const customerId = searchParams.get("customerId");
        if (!customerId) {
          return NextResponse.json({ error: "customerId is required for price-history report" }, { status: 400 });
        }
        buffer = await generatePriceHistoryReport(customerId, session.userId, session.permissions);
        filename = `price-history-${customerId}-${date}.xlsx`;
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown report type: ${reportType}` }, { status: 404 });
    }

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.VIEW_REPORTS]);
