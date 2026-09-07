import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    await requireRole("admin");
    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        target: auditLogs.target,
        description: auditLogs.description,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        userLoginId: users.loginId,
        userRole: users.role,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(200);
    return NextResponse.json({ logs: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
