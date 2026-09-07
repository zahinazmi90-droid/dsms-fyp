import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userPushTokens } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

const Schema = z.object({
  token: z.string().min(20).max(1000),
  browser: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Token tidak sah." }, { status: 400 });

    const [existing] = await db.select().from(userPushTokens).where(eq(userPushTokens.token, parsed.data.token)).limit(1);

    if (existing) {
      await db
        .update(userPushTokens)
        .set({ userId: user.id, isActive: true, lastSeenAt: new Date().toISOString(), browser: parsed.data.browser })
        .where(eq(userPushTokens.id, existing.id));
      return NextResponse.json({ ok: true });
    }

    await db.insert(userPushTokens).values({
      id: randomUUID(),
      userId: user.id,
      token: parsed.data.token,
      deviceType: "web",
      browser: parsed.data.browser,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
