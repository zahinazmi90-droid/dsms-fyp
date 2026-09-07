import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, students } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { logAudit, getClientIp } from "@/lib/audit";

const Schema = z.object({ studentId: z.string() });

export async function POST(req: Request) {
  try {
    const admin = await requireRole("admin");
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Input tidak sah." }, { status: 400 });

    const [student] = await db.select().from(students).where(eq(students.id, parsed.data.studentId)).limit(1);
    if (!student) return NextResponse.json({ error: "Pelajar tidak ditemui." }, { status: 404 });

    const now = new Date().toISOString();
    await db.update(users).set({ isActive: true, updatedAt: now }).where(eq(users.id, parsed.data.studentId));
    await db.update(students).set({ isActive: true }).where(eq(students.id, parsed.data.studentId));

    await logAudit({
      userId: admin.id,
      action: "STUDENT_REGISTRATION_APPROVED",
      target: parsed.data.studentId,
      description: `Approved matric ${student.matricNumber}`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
