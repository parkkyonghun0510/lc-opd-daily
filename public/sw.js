// This is the service worker with the Cache-first network
// Production-optimized service worker

const CACHE_NAME = "lc-opd-daily-cache-v1";
const OFFLINE_URL = '/offline.html';
const APP_SHELL = [
  '/',
  '/login',
  '/dashboard',
  OFFLINE_URL,
  '/icons/icon-192x192.png',
  '/icons/badge-info.png',
  '/favicon.ico'
];

// Install event - cache app shell
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).catch(error => {
      console.error('Failed to cache app shell:', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip requests from other origins
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Cache API endpoints selectively (if needed)
  if (url.pathname.startsWith('/api/')) {
    // Network first for API requests, with offline fallback
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If the request is for a page, return the offline page
              if (event.request.headers.get('accept').includes('text/html')) {
                return caches.match(OFFLINE_URL);
              }
              return new Response(
                JSON.stringify({ error: 'No internet connection' }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }

  // Stale-While-Revalidate for regular content
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.ok) {
            // Cache valid responses
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(error => {
          // On failure, return offline page for HTML pages
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match(OFFLINE_URL);
          }
          throw error;
        });

      // Return cached response immediately or wait for network
      return cachedResponse || fetchPromise;
    })
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    // Skip showing validation notifications entirely
    if (data.tag === 'subscription-validation' && data.silent === true) {
      //console.log('Skipping validation notification display');
      return;
    }

    // Default notification options
    const options = {
      body: data.body || 'You have a new notification',
      icon: data.icon || '/icons/icon-192x192.png',
      badge: data.badge || '/icons/badge-info.png',
      vibrate: data.vibrate || [100, 50, 100],
      requireInteraction: data.requireInteraction || false,
      data: {
        ...(data.data || {}),
        timestamp: Date.now(),
        url: data.url || '/dashboard'
      }
    };

    // Add actions if provided
    if (data.actions) {
      options.actions = data.actions;
    }

    // Add tag if provided
    if (data.tag) {
      options.tag = data.tag;
    }

    // Add silent option if provided
    if (data.silent) {
      options.silent = data.silent;
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'Notification', options)
    );
  } catch (error) {
    console.error('Error processing push notification:', error);
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  let urlToOpen = notificationData.url || '/dashboard';

  // Handle specific actions
  if (event.action) {
    switch (event.action) {
      case 'approve':
        if (notificationData.reportId) {
          urlToOpen = `/dashboard?viewReport=${notificationData.reportId}&action=approve`;
        }
        break;
      case 'revise':
        if (notificationData.reportId) {
          urlToOpen = `/dashboard?viewReport=${notificationData.reportId}&action=edit`;
        }
        break;
      case 'reply':
        if (notificationData.reportId) {
          urlToOpen = `/dashboard?viewReport=${notificationData.reportId}&action=reply`;
        }
        break;
      case 'viewAll':
        urlToOpen = '/dashboard?tab=approvals';
        break;
    }
  }

  // Handle report URLs - redirect to dashboard with report ID parameter
  if (urlToOpen.startsWith('/reports/') && urlToOpen.split('/').length >= 3) {
    const reportId = urlToOpen.split('/')[2].split('#')[0]; // Extract report ID and remove any hash
    if (reportId) {
      // Redirect to dashboard with report ID parameter
      urlToOpen = `/dashboard?viewReport=${reportId}`;

      // Handle specific actions
      if (urlToOpen.includes('#reply')) {
        urlToOpen += '&action=reply';
      } else if (urlToOpen.includes('#edit')) {
        urlToOpen += '&action=edit';
      } else if (urlToOpen.includes('/approve')) {
        urlToOpen += '&action=approve';
      }
    }
  }

  // Focus existing window or open new one
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    })
    .then((clientList) => {
      // Try to find an existing window to focus
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          // Navigate to the URL
          if (client.url !== urlToOpen) {
            client.navigate(urlToOpen);
          }
          return;
        }
      }

      // Open new window if no matching window found
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
    .catch(error => {
      console.error('Error handling notification click:', error);
    })
  );
});

// Notification close event - for analytics
self.addEventListener('notificationclose', (event) => {
  const notification = event.notification;
  const data = notification.data || {};

  // Could implement analytics in production
  if (data.timestamp) {
    const timeOpen = Date.now() - data.timestamp;
    // Analytics placeholder - implement actual analytics if needed
    // //console.log('Notification closed:', { type: data.type, timeOpen });
  }
});