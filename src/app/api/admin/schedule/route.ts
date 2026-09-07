import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { scheduleRules } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { logAudit, getClientIp } from "@/lib/audit";

/** "HH:mm" format AND value validation (00-23 hours, 00-59 minutes) --
 * a regex alone (as this route used before) accepts nonsense like "25:99"
 * as long as it has the right shape. */
const timeString = z.string().refine(
  (v) => {
    const m = /^(\d{2}):(\d{2})$/.exec(v);
    if (!m) return false;
    const h = Number(m[1]);
    const min = Number(m[2]);
    return h >= 0 && h <= 23 && min >= 0 && min <= 59;
  },
  { message: "Format masa tidak sah. Gunakan format HH:mm (cth: 07:30, 22:00)." }
);

export async function GET() {
  try {
    await requireRole("admin", "warden");
    const rows = await db.select().from(scheduleRules);
    return NextResponse.json({ rules: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

const Schema = z
  .object({
    dayType: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY", "HOLIDAY"]),
    outingStart: timeString,
    returnDeadline: timeString,
    isActive: z.boolean(),
  })
  .refine(
    (data) => {
      const [sh, sm] = data.outingStart.split(":").map(Number);
      const [dh, dm] = data.returnDeadline.split(":").map(Number);
      return sh * 60 + sm < dh * 60 + dm;
    },
    {
      message: "Waktu mula outing mesti lebih awal daripada had waktu pulang.",
      path: ["returnDeadline"],
    }
  );

export async function PUT(req: Request) {
  try {
    const user = await requireRole("admin");
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input tidak sah." }, { status: 400 });
    }

    const [existing] = await db.select().from(scheduleRules).where(eq(scheduleRules.dayType, parsed.data.dayType));
    if (existing) {
      await db
        .update(scheduleRules)
        .set({
          outingStart: parsed.data.outingStart,
          returnDeadline: parsed.data.returnDeadline,
          isActive: parsed.data.isActive,
        })
        .where(eq(scheduleRules.dayType, parsed.data.dayType));
    } else {
      await db.insert(scheduleRules).values({
        id: crypto.randomUUID(),
        ...parsed.data,
      });
    }

    await logAudit({
      userId: user.id,
      action: "SCHEDULE_RULE_CHANGE",
      target: parsed.data.dayType,
      description: `start=${parsed.data.outingStart} deadline=${parsed.data.returnDeadline} active=${parsed.data.isActive}`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
