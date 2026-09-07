import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { queryMovementReport } from "@/lib/report";

export async function GET(req: Request) {
  try {
    await requireRole("warden", "admin");
    const { searchParams } = new URL(req.url);
    const rows = await queryMovementReport({
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      matricNumber: searchParams.get("matricNumber") || undefined,
      departmentId: searchParams.get("departmentId") || undefined,
      semesterId: searchParams.get("semesterId") || undefined,
      movementTypeId: searchParams.get("movementTypeId") || undefined,
      lateOnly: searchParams.get("lateOnly") === "true",
    });
    return NextResponse.json({ records: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
