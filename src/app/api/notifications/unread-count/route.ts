import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const user = await requireUser();
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, user.id), eq(notifications.isRead, false)));
    return NextResponse.json({ count: Number(count) });
  } catch (err) {
    return handleApiError(err);
  }
}
