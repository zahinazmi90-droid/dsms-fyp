import { NextResponse } from "next/server";
import { getCurrentUser, destroySession } from "@/lib/auth/session";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  await destroySession();
  if (user) {
    await logAudit({ userId: user.id, action: "LOGOUT", ipAddress: getClientIp(req) });
  }
  return NextResponse.json({ ok: true });
}
