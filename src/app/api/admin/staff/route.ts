import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { users, staff, departments } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { hashPassword } from "@/lib/auth/password";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET() {
  try {
    await requireRole("admin");
    const rows = await db
      .select({
        id: staff.id,
        name: staff.name,
        phone: staff.phone,
        isActive: staff.isActive,
        departmentName: departments.name,
        loginId: users.loginId,
        role: users.role,
      })
      .from(staff)
      .innerJoin(users, eq(staff.id, users.id))
      .leftJoin(departments, eq(staff.departmentId, departments.id));
    return NextResponse.json({ staff: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  loginId: z.string().min(3).max(200),
  role: z.enum(["lecturer", "head_of_programme"]),
  departmentId: z.string().min(1),
  phone: z.string().max(20).optional(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const admin = await requireRole("admin");
    const body = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    const [dept] = await db.select().from(departments).where(eq(departments.id, parsed.data.departmentId)).limit(1);
    if (!dept) return NextResponse.json({ error: "Jabatan/program tidak sah." }, { status: 400 });

    if (parsed.data.role === "head_of_programme") {
      const existingHop = await db
        .select({ id: staff.id })
        .from(staff)
        .innerJoin(users, eq(staff.id, users.id))
        .where(and(eq(staff.departmentId, parsed.data.departmentId), eq(users.role, "head_of_programme"), eq(staff.isActive, true)));
      if (existingHop.length > 0) {
        return NextResponse.json(
          { error: "Jabatan ini sudah mempunyai Ketua Program aktif. Nyahaktifkan yang sedia ada dahulu." },
          { status: 409 }
        );
      }
    }

    const [existingUser] = await db.select().from(users).where(eq(users.loginId, parsed.data.loginId)).limit(1);
    if (existingUser) return NextResponse.json({ error: "ID log masuk ini sudah digunakan." }, { status: 409 });

    const id = randomUUID();
    const passwordHash = await hashPassword(parsed.data.password);

    await db.insert(users).values({ id, role: parsed.data.role, loginId: parsed.data.loginId, passwordHash });
    await db.insert(staff).values({ id, name: parsed.data.name, departmentId: parsed.data.departmentId, phone: parsed.data.phone });

    await logAudit({ userId: admin.id, action: "STAFF_CREATE", target: id, description: `${parsed.data.role} ${parsed.data.name}`, ipAddress: getClientIp(req) });

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}
