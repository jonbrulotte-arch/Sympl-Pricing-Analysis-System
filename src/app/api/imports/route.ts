import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/authorization/require-auth";
import { Permission } from "@/server/authorization/permissions";
import { createImportBatch, listImportBatches } from "@/server/services/import.service";
import { toApiError } from "@/lib/errors";

export const GET = withAuth(async (session) => {
  const batches = await listImportBatches(session.userId);
  return NextResponse.json({ data: batches });
}, [Permission.IMPORT_DATA]);

export const POST = withAuth(async (session, req: NextRequest) => {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const customerId = formData.get("customerId");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!customerId || typeof customerId !== "string") {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const filename = file.name;
    if (!filename.endsWith(".xlsx")) {
      return NextResponse.json({ error: "Only .xlsx files are supported" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const batch = await createImportBatch(
      buffer,
      filename,
      customerId,
      session.userId,
      session.permissions
    );

    return NextResponse.json({ data: batch }, { status: 201 });
  } catch (err) {
    const { message, statusCode } = toApiError(err);
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}, [Permission.IMPORT_DATA]);
