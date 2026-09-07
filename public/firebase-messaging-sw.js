// Firebase Cloud Messaging Service Worker.
// This file MUST live at the site root (public/firebase-messaging-sw.js)
// so its scope covers the whole origin. Replace the placeholder config
// values below with your actual Firebase project's public config values
// (same as NEXT_PUBLIC_FIREBASE_* in .env) before deploying. These are
// public identifiers, not secrets.

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCNI8Lg_jRDxabYKHSFJ1At7uhAFmEq1wE",
  authDomain: "dsms-notification.firebaseapp.com",
  projectId: "dsms-notification",
  storageBucket: "dsms-notification.firebasestorage.app",
  messagingSenderId: "912525284571",
  appId: "1:912525284571:web:880a9fd26e6558fad2a8fe",
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
