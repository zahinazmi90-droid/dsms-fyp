// Firebase Cloud Messaging Service Worker.
// This file MUST live at the site root (public/firebase-messaging-sw.js)
// so its scope covers the whole origin. Replace the placeholder config
// values below with your actual Firebase project's public config values
// (same as NEXT_PUBLIC_FIREBASE_* in .env) before deploying. These are
// public identifiers, not secrets.

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_NEXT_PUBLIC_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "DSMS";
  const body = payload.notification?.body || "";
  const requestId = payload.data?.requestId;

  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    data: { requestId },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestId = event.notification.data?.requestId;
  const url = requestId ? `/outing/request/${requestId}` : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
