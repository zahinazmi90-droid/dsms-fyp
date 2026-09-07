import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

const Schema = z.object({ id: z.string() });

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Input tidak sah." }, { status: 400 });

    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, parsed.data.id), eq(notifications.recipientUserId, user.id)))
      .returning({ id: notifications.id });

    if (result.length === 0) {
      return NextResponse.json({ error: "Notifikasi tidak ditemui." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
