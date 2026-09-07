import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { departments, semesters } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    await requireRole("admin", "warden");
    const [depts, sems] = await Promise.all([db.select().from(departments), db.select().from(semesters)]);
    return NextResponse.json({ departments: depts, semesters: sems });
  } catch (err) {
    return handleApiError(err);
  }
}
