import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { sendPushToUser } from "./fcmAdmin";

export type NotificationType =
  | "OUTING_SUBMITTED"
  | "LECTURER_APPROVAL_REQUIRED"
  | "HOP_APPROVAL_REQUIRED"
  | "LECTURER_APPROVED"
  | "LECTURER_REJECTED"
  | "HOP_APPROVED"
  | "HOP_REJECTED"
  | "OUTING_APPROVED"
  | "OUTING_REJECTED"
  | "AFTER_HOURS_REQUEST"
  | "WARDEN_APPROVED"
  | "WARDEN_REJECTED"
  | "LATE_RETURN"
  | "OUTING_CANCELLED";

/**
 * Single entry point for notifying a user. Two layers, always in order:
 *   1. Write the DB row (authoritative -- always succeeds if the
 *      business event succeeded).
 *   2. Best-effort FCM push (secondary -- may silently be skipped/fail).
 */
export async function notifyUser(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  requestId?: string | null;
  movementId?: string | null;
}): Promise<void> {
  const id = randomUUID();

  await db.insert(notifications).values({
    id,
    recipientUserId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    requestId: params.requestId ?? null,
    movementId: params.movementId ?? null,
  });

  try {
    await sendPushToUser({
      userId: params.userId,
      title: params.title,
      body: params.message,
      requestId: params.requestId,
    });
  } catch (err) {
    console.error("[notifyUser] Unexpected error sending push (DB notification already saved):", err);
  }
}

export async function notifyUsers(
  userIds: string[],
  rest: Omit<Parameters<typeof notifyUser>[0], "userId">
): Promise<void> {
  await Promise.all(userIds.map((userId) => notifyUser({ userId, ...rest })));
}
