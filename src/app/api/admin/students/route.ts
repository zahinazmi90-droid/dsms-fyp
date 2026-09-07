import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { students, users, departments, semesters } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { hashPassword } from "@/lib/auth/password";
import { logAudit, getClientIp } from "@/lib/audit";
import { getSetting } from "@/lib/settings";

export async function GET() {
  try {
    const user = await requireRole("admin", "warden");
    const rows = await db
      .select({
        id: students.id,
        matricNumber: students.matricNumber,
        name: students.name,
        phone: students.phone,
        departmentName: departments.name,
        semesterLabel: semesters.label,
        isActive: students.isActive,
      })
      .from(students)
      .leftJoin(departments, eq(students.departmentId, departments.id))
      .leftJoin(semesters, eq(students.semesterId, semesters.id));

    // Admin always sees phone (needed to review pending registrations).
    // Warden respects the existing privacy toggle.
    const canViewPhone = user.role === "admin" || (await getSetting<boolean>("warden_can_view_phone"));
    const result = canViewPhone ? rows : rows.map((r) => ({ ...r, phone: null }));

    return NextResponse.json({ students: result });
  } catch (err) {
    return handleApiError(err);
  }
}

const CreateSchema = z.object({
  matricNumber: z.string().min(3),
  name: z.string().min(1),
  departmentId: z.string(),
  semesterId: z.string(),
  phone: z
    .string()
    .regex(/^(01)[0-46-9]-*[0-9]{7,8}$/, "Format nombor telefon Malaysia tidak sah (cth: 0123456789)."),
  password: z.string().min(8, "Kata laluan mesti sekurang-kurangnya 8 aksara."),
});

export async function POST(req: Request) {
  try {
    const admin = await requireRole("admin");
    const body = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const [existing] = await db
      .select()
      .from(students)
      .where(eq(students.matricNumber, parsed.data.matricNumber))
      .limit(1);
    if (existing) {
      return NextResponse.json({ error: "Nombor Matrik sudah wujud." }, { status: 409 });
    }

    const id = randomUUID();
    const passwordHash = await hashPassword(parsed.data.password);

    await db.insert(users).values({
      id,
      role: "student",
      loginId: parsed.data.matricNumber,
      passwordHash,
    });
    await db.insert(students).values({
      id,
      matricNumber: parsed.data.matricNumber,
      name: parsed.data.name,
      departmentId: parsed.data.departmentId,
      semesterId: parsed.data.semesterId,
      phone: parsed.data.phone,
    });

    await logAudit({ userId: admin.id, action: "STUDENT_CREATE", target: id, ipAddress: getClientIp(req) });

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}
