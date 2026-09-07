import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, students } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { checkLoginRateLimit, resetLoginRateLimit } from "@/lib/auth/rateLimit";
import { logAudit, getClientIp } from "@/lib/audit";

const LoginSchema = z.object({
  loginId: z.string().min(1, "Sila masukkan Nombor Matrik / ID."),
  password: z.string().min(1, "Sila masukkan kata laluan."),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input tidak sah." }, { status: 400 });
  }
  const { loginId, password } = parsed.data;

  const rlKey = `${loginId}:${ip ?? "unknown"}`;
  const rl = checkLoginRateLimit(rlKey);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Terlalu banyak percubaan. Cuba lagi selepas ${rl.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  const [user] = await db.select().from(users).where(eq(users.loginId, loginId)).limit(1);

  // Constant-shape response whether user exists or not (avoid user enumeration).
  if (!user) {
    await logAudit({ userId: null, action: "LOGIN_FAILED", target: loginId, description: "User not found", ipAddress: ip });
    return NextResponse.json({ error: "Nombor Matrik / ID atau kata laluan salah." }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await logAudit({ userId: user.id, action: "LOGIN_FAILED", target: loginId, description: "Bad password", ipAddress: ip });
    return NextResponse.json({ error: "Nombor Matrik / ID atau kata laluan salah." }, { status: 401 });
  }

  // Only reveal "pending approval" once the password has already been
  // proven correct -- this never leaks account-existence info to someone
  // guessing passwords, since a wrong guess still gets the generic message
  // above regardless of whether the account is active or not.
  if (!user.isActive) {
    await logAudit({ userId: user.id, action: "LOGIN_FAILED", target: loginId, description: "Account pending approval", ipAddress: ip });
    return NextResponse.json(
      { error: "Akaun anda masih menunggu pengesahan oleh Admin. Sila cuba lagi kemudian." },
      { status: 403 }
    );
  }

  resetLoginRateLimit(rlKey);
  await createSession(user.id);
  await logAudit({ userId: user.id, action: "LOGIN", ipAddress: ip });

  let name: string | null = null;
  if (user.role === "student") {
    const [s] = await db.select().from(students).where(eq(students.id, user.id)).limit(1);
    name = s?.name ?? null;
  }

  return NextResponse.json({ ok: true, role: user.role, name });
}
