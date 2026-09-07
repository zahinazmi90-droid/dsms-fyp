import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { movementTypes } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { getSetting } from "@/lib/settings";

const FEATURE_FLAG_BY_TYPE: Record<string, string> = {
  NORMAL: "normal_outing_enabled",
  STUDY: "study_outing_enabled",
  OVERNIGHT: "overnight_enabled",
  EMERGENCY: "emergency_enabled",
};

export async function GET() {
  try {
    await requireUser();
    const rows = await db.select().from(movementTypes).where(eq(movementTypes.isActive, true));
    const filtered: typeof rows = [];
    for (const r of rows) {
      const flagKey = FEATURE_FLAG_BY_TYPE[r.id];
      const enabled = flagKey ? await getSetting<boolean>(flagKey) : true;
      if (enabled) filtered.push(r);
    }
    return NextResponse.json({ types: filtered });
  } catch (err) {
    return handleApiError(err);
  }
}
