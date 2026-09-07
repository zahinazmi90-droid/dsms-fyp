import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { setSetting, validateSettingValue, SETTINGS_DEFAULTS } from "@/lib/settings";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET() {
  try {
    await requireRole("admin");
    const rows = await db.select().from(systemSettings);
    const parsed = rows.map((r) => ({ ...r, value: safeParse(r.value) }));
    return NextResponse.json({ settings: parsed, defaults: SETTINGS_DEFAULTS });
  } catch (err) {
    return handleApiError(err);
  }
}

const Schema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export async function PUT(req: Request) {
  try {
    const user = await requireRole("admin");
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Input tidak sah." }, { status: 400 });

    const validation = validateSettingValue(parsed.data.key, parsed.data.value);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    await setSetting(parsed.data.key, parsed.data.value);
    await logAudit({
      userId: user.id,
      action: "SETTINGS_CHANGE",
      target: parsed.data.key,
      description: `New value: ${JSON.stringify(parsed.data.value)}`,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

function safeParse(v: string) {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}
