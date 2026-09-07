import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { handleApiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Kata laluan baharu mesti sekurang-kurangnya 8 aksara."),
});

export async function POST(req: Request) {
  try {
    const sessionUser = await requireUser();
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const [user] = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
    if (!user) return NextResponse.json({ error: "Pengguna tidak ditemui." }, { status: 404 });

    const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Kata laluan semasa salah." }, { status: 400 });

    const newHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date().toISOString() }).where(eq(users.id, user.id));

    await logAudit({ userId: user.id, action: "CHANGE_PASSWORD" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
