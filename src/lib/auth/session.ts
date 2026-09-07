import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";

const SESSION_COOKIE = "dsms_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export type SessionUser = {
  id: string;
  role: "student" | "guard" | "warden" | "admin" | "lecturer" | "head_of_programme";
  loginId: string;
};

export async function createSession(userId: string) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.insert(sessions).values({ id, userId, expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return id;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.id, token));
  }
  store.delete(SESSION_COOKIE);
}

/** Reads the current session cookie and returns the authenticated user, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const nowIso = new Date().toISOString();
  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      loginId: users.loginId,
      isActive: users.isActive,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, nowIso)))
    .limit(1);

  const row = rows[0];
  if (!row || !row.isActive) return null;

  return { id: row.id, role: row.role as SessionUser["role"], loginId: row.loginId };
}

/** Throws-free guard: use in Server Components/Route Handlers. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("UNAUTHENTICATED");
    err.name = "UNAUTHENTICATED";
    throw err;
  }
  return user;
}

/** Role-based authorization guard. Always enforced server-side — never trust the client. */
export async function requireRole(
  ...roles: Array<SessionUser["role"]>
): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    const err = new Error("FORBIDDEN");
    err.name = "FORBIDDEN";
    throw err;
  }
  return user;
}
