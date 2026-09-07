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
    if (student.isActive) {
      return NextResponse.json(
        { error: "Akaun ini sudah aktif dan tidak boleh ditolak. Nyahaktifkan sahaja jika perlu." },
        { status: 409 }
      );
    }

    // Safe to hard-delete: an inactive/never-approved account has no
    // movement records, sessions, or history attached to it yet.
    await db.delete(students).where(eq(students.id, parsed.data.studentId));
    await db.delete(users).where(eq(users.id, parsed.data.studentId));

    await logAudit({
      userId: admin.id,
      action: "STUDENT_REGISTRATION_REJECTED",
      target: parsed.data.studentId,
      description: `Rejected matric ${student.matricNumber}`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
