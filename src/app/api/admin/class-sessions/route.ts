import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { classSessions, staff, departments, semesters } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { logAudit, getClientIp } from "@/lib/audit";

const timeString = z.string().refine(
  (v) => {
    const m = /^(\d{2}):(\d{2})$/.exec(v);
    if (!m) return false;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h >= 0 && h <= 23 && min >= 0 && min <= 59;
  },
  { message: "Format masa tidak sah. Gunakan format HH:mm." }
);

export async function GET() {
  try {
    await requireRole("admin");
    const rows = await db
      .select({
        id: classSessions.id,
        departmentId: classSessions.departmentId,
        departmentName: departments.name,
        semesterId: classSessions.semesterId,
        semesterLabel: semesters.label,
        dayOfWeek: classSessions.dayOfWeek,
        startTime: classSessions.startTime,
        endTime: classSessions.endTime,
        lecturerId: classSessions.lecturerId,
        lecturerName: staff.name,
        courseName: classSessions.courseName,
        isActive: classSessions.isActive,
      })
      .from(classSessions)
      .innerJoin(staff, eq(classSessions.lecturerId, staff.id))
      .innerJoin(departments, eq(classSessions.departmentId, departments.id))
      .innerJoin(semesters, eq(classSessions.semesterId, semesters.id));
    return NextResponse.json({ classSessions: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

const CreateSchema = z
  .object({
    departmentId: z.string().min(1),
    semesterId: z.string().min(1),
    dayOfWeek: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
    startTime: timeString,
    endTime: timeString,
    lecturerId: z.string().min(1),
    courseName: z.string().max(200).optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (d) => {
      const [sh, sm] = d.startTime.split(":").map(Number);
      const [eh, em] = d.endTime.split(":").map(Number);
      return sh * 60 + sm < eh * 60 + em;
    },
    { message: "Masa mula kelas mesti sebelum masa tamat.", path: ["endTime"] }
  );

export async function POST(req: Request) {
  try {
    const admin = await requireRole("admin");
    const body = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const id = randomUUID();
    await db.insert(classSessions).values({ id, ...parsed.data });
    await logAudit({ userId: admin.id, action: "CLASS_SESSION_CREATE", target: id, ipAddress: getClientIp(req) });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}
