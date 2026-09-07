import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { movementRecords } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { logAudit, getClientIp } from "@/lib/audit";

const Schema = z.object({
  studentId: z.string(),
  remarks: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("warden", "admin");
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Input tidak sah." }, { status: 400 });

    const [active] = await db
      .select()
      .from(movementRecords)
      .where(and(eq(movementRecords.studentId, parsed.data.studentId), isNull(movementRecords.timeIn)))
      .limit(1);

    if (!active) {
      return NextResponse.json({ error: "Tiada rekod aktif untuk pelajar ini." }, { status: 404 });
    }
    if (active.approvalStatus !== "REJECTED") {
      return NextResponse.json(
        { error: "Rekod ini bukan status DITOLAK. Tindakan ini hanya untuk permohonan yang ditolak." },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    await db
      .update(movementRecords)
      .set({ timeIn: now, notes: parsed.data.remarks ?? "Ditutup secara pentadbiran oleh Warden/Admin selepas ditolak.", updatedAt: now })
      .where(eq(movementRecords.id, active.id));

    await logAudit({
      userId: user.id,
      action: "MOVEMENT_FORCE_CLOSED",
      target: active.id,
      description: `Administratively closed a REJECTED movement for student ${parsed.data.studentId}`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
