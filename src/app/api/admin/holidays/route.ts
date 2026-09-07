import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { holidayDates } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { logAudit, getClientIp } from "@/lib/audit";

/** "HH:mm" format AND value validation (00-23 / 00-59) -- a regex alone
 * accepts nonsense like "25:99" as long as the shape matches. */
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

/** "YYYY-MM-DD" format AND real-calendar-date validation -- a regex alone
 * accepts nonsense like "2026-13-45". */
const dateString = z.string().refine(
  (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return false;
    const [, y, mo, d] = m;
    const dt = new Date(`${y}-${mo}-${d}T00:00:00.000Z`);
    return (
      dt.getUTCFullYear() === Number(y) &&
      dt.getUTCMonth() + 1 === Number(mo) &&
      dt.getUTCDate() === Number(d)
    );
  },
  { message: "Tarikh tidak sah." }
);

export async function GET() {
  try {
    await requireRole("admin", "warden");
    const rows = await db.select().from(holidayDates);
    return NextResponse.json({ holidays: rows });
  } catch (err) {
    return handleApiError(err);
  }
}

const CreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    date: dateString,
    outingStart: timeString,
    returnDeadline: timeString,
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      const [sh, sm] = data.outingStart.split(":").map(Number);
      const [dh, dm] = data.returnDeadline.split(":").map(Number);
      return sh * 60 + sm < dh * 60 + dm;
    },
    { message: "Waktu mula outing mesti lebih awal daripada had waktu pulang.", path: ["returnDeadline"] }
  );

export async function POST(req: Request) {
  try {
    const user = await requireRole("admin");
    const body = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

    // Prevent duplicate ACTIVE holidays on the same date -- resolveScheduleWindow
    // only ever picks the first active one it finds for a given date, so a
    // second active holiday on that date would be silently ignored rather
    // than raising an error. Better to reject the duplicate up front.
    if (parsed.data.isActive) {
      const existingOnDate = await db.select().from(holidayDates).where(eq(holidayDates.date, parsed.data.date));
      if (existingOnDate.some((h) => h.isActive)) {
        return NextResponse.json(
          { error: "Sudah ada cuti AKTIF pada tarikh ini. Nyahaktifkan cuti sedia ada dahulu, atau pilih tarikh lain." },
          { status: 409 }
        );
      }
    }

    const id = randomUUID();
    await db.insert(holidayDates).values({ id, ...parsed.data });

    await logAudit({ userId: user.id, action: "HOLIDAY_CREATE", target: id, ipAddress: getClientIp(req) });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return handleApiError(err);
  }
}

const UpdateSchema = z.object({
  id: z.string(),
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(200).optional(),
  outingStart: timeString.optional(),
  returnDeadline: timeString.optional(),
});

export async function PUT(req: Request) {
  try {
    const user = await requireRole("admin");
    const body = await req.json().catch(() => null);
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input tidak sah." }, { status: 400 });

    const { id, ...rest } = parsed.data;

    // Same duplicate-active-holiday check applies when re-activating one.
    if (rest.isActive) {
      const [current] = await db.select().from(holidayDates).where(eq(holidayDates.id, id)).limit(1);
      if (current) {
        const others = await db
          .select()
          .from(holidayDates)
          .where(and(eq(holidayDates.date, current.date)));
        if (others.some((h) => h.id !== id && h.isActive)) {
          return NextResponse.json(
            { error: "Sudah ada cuti AKTIF lain pada tarikh ini." },
            { status: 409 }
          );
        }
      }
    }

    await db.update(holidayDates).set(rest).where(eq(holidayDates.id, id));
    await logAudit({ userId: user.id, action: "HOLIDAY_UPDATE", target: id, ipAddress: getClientIp(req) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
