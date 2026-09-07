import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { departments, semesters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { handleApiError } from "@/lib/apiError";

// Intentionally public (no requireRole) -- a prospective student filling in
// the registration form isn't logged in yet, but department/semester names
// are not sensitive information.
export async function GET() {
  try {
    const [depts, sems] = await Promise.all([
      db.select().from(departments).where(eq(departments.isActive, true)),
      db.select().from(semesters).where(eq(semesters.isActive, true)),
    ]);
    return NextResponse.json({ departments: depts, semesters: sems });
  } catch (err) {
    return handleApiError(err);
  }
}
