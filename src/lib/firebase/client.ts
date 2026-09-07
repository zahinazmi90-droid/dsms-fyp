"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

let app: FirebaseApp | null = null;
function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export async function setupPushNotifications(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.warn("[FCM] This browser does not support push messaging (or is running without HTTPS).");
    return null;
  }

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    console.warn(
      "[FCM] Firebase client is not configured (NEXT_PUBLIC_FIREBASE_* env vars missing). Push notifications disabled; in-app notification bell still works normally via the database."
    );
    return null;
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set -- cannot request a push token.");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("[FCM] Notification permission was not granted by the user.");
    return null;
  }

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

  if (!token) return null;

  await fetch("/api/notifications/device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, browser: navigator.userAgent.slice(0, 200) }),
  });

  return token;
}

export function listenForForegroundMessages(onMessageReceived: (title: string, body: string, requestId?: string) => void) {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return () => {};

  let messaging: Messaging;
  try {
    messaging = getMessaging(firebaseApp);
  } catch {
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    onMessageReceived(
      payload.notification?.title ?? "Notifikasi",
      payload.notification?.body ?? "",
      payload.data?.requestId
    );
  });
}
