import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { fellows } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    await requireUser();
    const rows = await db
      .select({ id: fellows.id, name: fellows.name, floorArea: fellows.floorArea })
      .from(fellows)
      .where(eq(fellows.isActive, true));
    return NextResponse.json({ fellows: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
