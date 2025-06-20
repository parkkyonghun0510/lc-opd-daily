// Service Worker for LC OPD Daily Report System

// Cache name
const CACHE_NAME = "lc-opd-daily-cache-v1";

// Notification event types (must match the types in src/types/notifications.ts)
const NOTIFICATION_EVENT = {
  DELIVERED: "DELIVERED",
  CLICKED: "CLICKED",
  CLOSED: "CLOSED",
  FAILED: "FAILED",
};

// Assets to cache
const CACHE_ASSETS = [
  "/",
  "/dashboard",
  "/offline",
  "/icons/default.png",
  "/icons/badge.png",
];

// Install event - cache assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_ASSETS);
    }),
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      );
    }),
  );
  self.clients.claim();
});

// Track notification deliveries
function trackNotificationEvent(notificationId, event, metadata = {}) {
  return fetch("/api/notifications/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notificationId,
      event,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    }),
  }).catch((error) =>
    console.error("Failed to track notification event:", error),
  );
}

// Push event handler
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();

    // Skip showing validation notifications entirely
    if (payload.tag === "subscription-validation" && payload.silent === true) {
      //console.log('Skipping validation notification display');
      return;
    }

    // Generate notification ID if not provided
    const notificationId = payload.id || `notification-${Date.now()}`;

    // Track that we received the notification
    if (payload.id) {
      event.waitUntil(
        trackNotificationEvent(payload.id, NOTIFICATION_EVENT.DELIVERED, {
          title: payload.title,
          url: payload.data?.url,
        }),
      );
    }

    // Show notification
    const title = payload.title || "Notification";
    const options = {
      body: payload.body || "",
      icon: payload.icon || "/icons/default.png",
      badge: payload.badge || "/icons/badge.png",
      vibrate: payload.vibrate || [100, 50, 100],
      data: {
        ...payload.data,
        notificationId: payload.id, // Store the notification ID for click tracking
      },
      actions: payload.actions || [],
      tag: payload.tag, // For grouping similar notifications
      requireInteraction: payload.requireInteraction || false,
      silent: payload.silent || false,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error("Error processing push notification:", error);
  }
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const notificationId = notificationData.notificationId;
  let url = notificationData.url || "/";

  // Handle report URLs - redirect to dashboard with report ID parameter
  if (url.startsWith("/reports/") && url.split("/").length >= 3) {
    const reportId = url.split("/")[2].split("#")[0]; // Extract report ID and remove any hash
    if (reportId) {
      // Redirect to dashboard with report ID parameter
      url = `/dashboard?viewReport=${reportId}`;

      // Handle specific actions
      if (url.includes("#reply")) {
        url += "&action=reply";
      } else if (url.includes("#edit")) {
        url += "&action=edit";
      }
    }
  }

  // Track notification click if we have an ID
  if (notificationId) {
    event.waitUntil(
      trackNotificationEvent(notificationId, NOTIFICATION_EVENT.CLICKED, {
        action: event.action || "default",
        url: url,
      }),
    );
  }

  // Open the application and navigate to the URL
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientsList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientsList) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }

      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});

// Notification close event
self.addEventListener("notificationclose", (event) => {
  const notificationData = event.notification.data || {};
  const notificationId = notificationData.notificationId;

  // Track notification close if we have an ID
  if (notificationId) {
    event.waitUntil(
      trackNotificationEvent(notificationId, NOTIFICATION_EVENT.CLOSED),
    );
  }
});

// Fetch event - serve cached assets
self.addEventListener("fetch", (event) => {
  // Skip for notification tracking API - never cache it
  if (event.request.url.includes("/api/notifications/track")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached response if available
      if (cachedResponse) {
        return cachedResponse;
      }

      // Otherwise fetch from network
      return fetch(event.request)
        .then((response) => {
          // Cache response for future
          if (
            response.ok &&
            event.request.method === "GET" &&
            !event.request.url.includes("/api/")
          ) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If both cache and network fail, serve offline page
          if (event.request.mode === "navigate") {
            return caches.match("/offline");
          }
          return null;
        });
    }),
  );
});

// Periodic sync for background tasks
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "notifications-sync") {
    event.waitUntil(
      fetch("/api/notifications/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lastSync: new Date().toISOString(),
        }),
      }),
    );
  }
});
