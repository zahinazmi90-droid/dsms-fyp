import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";

export async function logAudit(params: {
  userId: string | null;
  action: string;
  target?: string;
  description?: string;
  ipAddress?: string | null;
}) {
  await db.insert(auditLogs).values({
    id: randomUUID(),
    userId: params.userId,
    action: params.action,
    target: params.target,
    description: params.description,
    ipAddress: params.ipAddress ?? undefined,
  });
}

export function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
