import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, students, departments, semesters } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { logAudit, getClientIp } from "@/lib/audit";
import { handleApiError } from "@/lib/apiError";

const Schema = z.object({
  matricNumber: z.string().min(3, "Nombor Matrik diperlukan."),
  name: z.string().min(2, "Nama penuh diperlukan."),
  phone: z
    .string()
    .regex(/^(01)[0-46-9]-*[0-9]{7,8}$/, "Format nombor telefon Malaysia tidak sah (cth: 0123456789)."),
  departmentId: z.string().min(1, "Sila pilih jabatan/program."),
  semesterId: z.string().min(1, "Sila pilih semester."),
  password: z.string().min(8, "Kata laluan mesti sekurang-kurangnya 8 aksara."),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input tidak sah." }, { status: 400 });
    }
    const data = parsed.data;

    // Matric number must be unique -- this is also the student's login ID.
    const [existing] = await db
      .select()
      .from(students)
      .where(eq(students.matricNumber, data.matricNumber))
      .limit(1);
    if (existing) {
      return NextResponse.json(
        { error: "Nombor Matrik ini sudah didaftarkan. Jika ini akaun anda, sila hubungi Admin." },
        { status: 409 }
      );
    }

    // Validate the chosen department/semester actually exist and are active
    // -- never trust IDs supplied by an unauthenticated client at face value.
    const [dept] = await db.select().from(departments).where(eq(departments.id, data.departmentId)).limit(1);
    if (!dept || !dept.isActive) {
      return NextResponse.json({ error: "Jabatan/program yang dipilih tidak sah." }, { status: 400 });
    }
    const [sem] = await db.select().from(semesters).where(eq(semesters.id, data.semesterId)).limit(1);
    if (!sem || !sem.isActive) {
      return NextResponse.json({ error: "Semester yang dipilih tidak sah." }, { status: 400 });
    }

    const id = randomUUID();
    const passwordHash = await hashPassword(data.password);

    // Account is created INACTIVE -- the existing login route already
    // refuses to authenticate inactive accounts, so this student simply
    // cannot log in until an Admin approves them at /admin/students.
    await db.insert(users).values({
      id,
      role: "student",
      loginId: data.matricNumber,
      passwordHash,
      isActive: false,
    });
    await db.insert(students).values({
      id,
      matricNumber: data.matricNumber,
      name: data.name,
      departmentId: data.departmentId,
      semesterId: data.semesterId,
      phone: data.phone,
      isActive: false,
    });

    await logAudit({
      userId: null,
      action: "STUDENT_SELF_REGISTER",
      target: id,
      description: `Matric ${data.matricNumber} self-registered, pending admin approval`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      ok: true,
      message: "Pendaftaran berjaya dihantar. Sila tunggu pengesahan oleh Admin sebelum log masuk.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
