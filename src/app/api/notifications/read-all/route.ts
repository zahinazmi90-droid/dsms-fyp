import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

export async function PATCH() {
  try {
    const user = await requireUser();
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.recipientUserId, user.id), eq(notifications.isRead, false)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
