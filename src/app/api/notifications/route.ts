import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientUserId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ notifications: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
