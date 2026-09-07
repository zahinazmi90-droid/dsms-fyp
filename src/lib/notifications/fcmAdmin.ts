import { db } from "@/db/client";
import { userPushTokens } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Firebase Admin SDK wrapper for sending FCM push notifications.
 *
 * Lazily initializes only when actually sending, and only if required
 * env vars are present. If missing, sends are skipped with a clear log
 * message instead of crashing -- the database notification record (the
 * authoritative layer) is created regardless by the caller
 * (see src/lib/notifications/service.ts).
 *
 * Required env vars (server-side only, never exposed to the browser):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (with literal \n escaped, see .env.example)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminApp: any = null;
let initTried = false;

async function getAdminMessaging() {
  if (adminApp) return adminApp;
  if (initTried) return null;
  initTried = true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "[FCM] Firebase Admin credentials not configured (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY). " +
        "Push notifications will be skipped; database notification records are still created normally."
    );
    return null;
  }

  try {
    const { initializeApp, cert, getApps } = await import("firebase-admin/app");
    const { getMessaging } = await import("firebase-admin/messaging");
    if (!getApps().length) {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    }
    adminApp = getMessaging();
    return adminApp;
  } catch (err) {
    console.error("[FCM] Failed to initialize Firebase Admin SDK:", err);
    return null;
  }
}

/**
 * Sends a push notification to every active device token for a user.
 * Invalid/unregistered tokens are deactivated (not deleted). Never
 * throws -- failures are logged and swallowed.
 */
export async function sendPushToUser(params: {
  userId: string;
  title: string;
  body: string;
  requestId?: string | null;
}): Promise<{ sent: number; failed: number; skipped: boolean }> {
  const messaging = await getAdminMessaging();
  if (!messaging) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const tokens = await db
    .select()
    .from(userPushTokens)
    .where(and(eq(userPushTokens.userId, params.userId), eq(userPushTokens.isActive, true)));

  if (tokens.length === 0) {
    return { sent: 0, failed: 0, skipped: false };
  }

  let sent = 0;
  let failed = 0;

  for (const t of tokens) {
    try {
      await messaging.send({
        token: t.token,
        notification: { title: params.title, body: params.body },
        webpush: {
          fcmOptions: {
            link: params.requestId ? `/outing/request/${params.requestId}` : "/",
          },
        },
        data: {
          requestId: params.requestId ?? "",
        },
      });
      sent++;
    } catch (err: unknown) {
      failed++;
      const code = (err as { code?: string })?.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        await db.update(userPushTokens).set({ isActive: false }).where(eq(userPushTokens.id, t.id));
      } else {
        console.error(`[FCM] Send failed for token ${t.id}:`, err);
      }
    }
  }

  return { sent, failed, skipped: false };
}
