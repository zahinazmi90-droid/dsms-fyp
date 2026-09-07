import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { students } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { logAudit, getClientIp } from "@/lib/audit";

const Schema = z.object({
  phone: z
    .string()
    .regex(/^(01)[0-46-9]-*[0-9]{7,8}$/, "Format nombor telefon Malaysia tidak sah (cth: 0123456789)."),
});

export async function PUT(req: Request) {
  try {
    const user = await requireRole("student");
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    await db.update(students).set({ phone: parsed.data.phone }).where(eq(students.id, user.id));

    await logAudit({
      userId: user.id,
      action: "STUDENT_UPDATE_PHONE",
      target: user.id,
      description: "Student updated own phone number",
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true, phone: parsed.data.phone });
  } catch (err) {
    return handleApiError(err);
  }
}
