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
  '/favicon.ico'
];

// Cache for offline reports
const OFFLINE_REPORTS_CACHE = 'offline-reports-v1';

// Event types for offline sync
const SYNC_EVENT_TYPES = {
  REPORT_SUBMISSION: 'report-submission',
  REPORT_UPDATE: 'report-update',
  COMMENT_ADD: 'comment-add'
};

// Routes to prefetch for offline access
const PREFETCH_ROUTES = [
  '/dashboard',
  '/profile',
  '/settings',
];

// Dynamic routes that should work offline
const DYNAMIC_ROUTES = [
  /^\/dashboard\/reports\/[\w-]+$/,  // Individual report pages
  /^\/dashboard\/users\/[\w-]+$/,    // Individual user pages
];

// Install event - cache app shell
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        
        // Cache app shell resources individually to prevent complete failure
        const appShellResults = await Promise.allSettled(
          APP_SHELL.map(async (url) => {
            try {
              await cache.add(url);
              console.log(`✅ Cached: ${url}`);
              return { success: true, url };
            } catch (error) {
              console.warn(`⚠️ Failed to cache: ${url}`, error.message);
              return { success: false, url, error: error.message };
            }
          })
        );

        // Prefetch routes with validation
        const prefetchResults = await Promise.allSettled(
          PREFETCH_ROUTES.map(async (route) => {
            try {
              const response = await fetch(route, { method: 'HEAD' });
              if (response.ok) {
                await cache.add(route);
                console.log(`✅ Prefetched: ${route}`);
                return { success: true, route };
              } else {
                console.warn(`⚠️ Route not available: ${route} (status: ${response.status})`);
                return { success: false, route, status: response.status };
              }
            } catch (error) {
              console.warn(`⚠️ Failed to prefetch: ${route}`, error.message);
              return { success: false, route, error: error.message };
            }
          })
        );

        const successful = [
          ...appShellResults.filter(r => r.status === 'fulfilled' && r.value.success).length,
          ...prefetchResults.filter(r => r.status === 'fulfilled' && r.value.success).length
        ].length;

        console.log(`Service Worker: Cached ${successful} resources successfully`);
      } catch (error) {
        console.error('Service Worker: Failed to initialize cache:', error);
      }
    })()
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

// Enhanced fetch event handler with dynamic route support
self.addEventListener('fetch', event => {
  // Skip non-GET requests unless they're report submissions
  if (event.request.method !== 'GET') {
    if (event.request.url.includes('/api/reports') && !navigator.onLine) {
      // Handle offline report submissions
      event.respondWith(handleOfflineSubmission(event.request));
    }
    return;
  }

  // Check if the request matches any dynamic routes
  const url = new URL(event.request.url);
  const isDynamicRoute = DYNAMIC_ROUTES.some(pattern => pattern.test(url.pathname));

  // Handle API requests
  if (event.request.url.includes('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Handle static assets and pages
  event.respondWith(
    handleStaticRequest(event.request, isDynamicRoute)
  );
});

// Sync event - handle background synchronization
self.addEventListener('sync', event => {
  if (event.tag === SYNC_EVENT_TYPES.REPORT_SUBMISSION) {
    event.waitUntil(syncReports());
  } else if (event.tag === SYNC_EVENT_TYPES.REPORT_UPDATE) {
    event.waitUntil(syncReportUpdates());
  } else if (event.tag === SYNC_EVENT_TYPES.COMMENT_ADD) {
    event.waitUntil(syncComments());
  }
});

// Periodic background sync
self.addEventListener('periodicsync', event => {
  if (event.tag === 'sync-all') {
    event.waitUntil(syncAll());
  }
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  try {
    // Try network first, ensuring credentials are sent.
    const response = await fetch(new Request(request, { credentials: 'include' }));
    
    // Cache successful GET responses
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // If offline, try to return cached response
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline data structure if we have any
    if (request.url.includes('/api/reports')) {
      return createOfflineResponse('reports');
    }
    
    // Return generic offline response
    return new Response(
      JSON.stringify({ error: 'No internet connection' }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Enhanced static request handler with dynamic route support
async function handleStaticRequest(request, isDynamicRoute) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Return cached response immediately
    return cachedResponse;
  }
  
  try {
    // If not in cache, try network
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful responses for static and dynamic routes
      if (isDynamicRoute || PREFETCH_ROUTES.includes(new URL(request.url).pathname)) {
        cache.put(request, response.clone());
      }
    }
    
    return response;
  } catch (error) {
    // If offline and requesting a page, return offline page
    if (request.mode === 'navigate') {
      const offlineResponse = await cache.match(OFFLINE_URL);
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    // Otherwise fail
    throw error;
  }
}

// Handle offline report submissions
async function handleOfflineSubmission(request) {
  try {
    // Store the report data for later sync
    const reportData = await request.json();
    const cache = await caches.open(OFFLINE_REPORTS_CACHE);
    
    // Add timestamp and generated ID
    const offlineReport = {
      ...reportData,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      synced: false
    };
    
    // Get existing offline reports
    const offlineReports = await getOfflineReports();
    offlineReports.push(offlineReport);
    
    // Store updated reports
    await cache.put('pending-reports', new Response(JSON.stringify(offlineReports)));
    
    // Register for background sync
    await self.registration.sync.register(SYNC_EVENT_TYPES.REPORT_SUBMISSION);
    
    // Return success response
    return new Response(JSON.stringify({
      success: true,
      message: 'Report saved offline and will sync when online',
      reportId: offlineReport.id
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to save report offline'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Sync offline reports with the server
async function syncReports() {
  const cache = await caches.open(OFFLINE_REPORTS_CACHE);
  const reports = await getOfflineReports();
  
  for (const report of reports) {
    if (!report.synced) {
      try {
        const response = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report)
        });
        
        if (response.ok) {
          // Mark report as synced
          report.synced = true;
          
          // Show sync success notification
          await showSyncNotification('Report Synced', 'Your offline report has been synchronized');
        }
      } catch (error) {
        console.error('Error syncing report:', error);
      }
    }
  }
  
  // Update stored reports
  await cache.put('pending-reports', new Response(JSON.stringify(reports)));
}

// Get offline reports from the cache
async function getOfflineReports() {
  try {
    const cache = await caches.open(OFFLINE_REPORTS_CACHE);
    const response = await cache.match('pending-reports');
    return response ? await response.json() : [];
  } catch (error) {
    console.error('Error getting offline reports:', error);
    return [];
  }
}

// Show synchronization notification
async function showSyncNotification(title, body) {
  const options = {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-info.png',
    tag: 'sync-notification',
    renotify: true
  };
  
  await self.registration.showNotification(title, options);
}

// Create an offline response structure
async function createOfflineResponse(type) {
  switch (type) {
    case 'reports':
      const reports = await getOfflineReports();
      return new Response(JSON.stringify({
        offline: true,
        data: reports
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    default:
      return new Response(JSON.stringify({
        offline: true,
        data: null
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
  }
}

// Function to sync all offline data
async function syncAll() {
  await Promise.all([
    syncReports(),
    syncReportUpdates(),
    syncComments()
  ]);
}

// Helper functions for other sync types
async function syncReportUpdates() {
  // Implementation for syncing report updates
}

async function syncComments() {
  // Implementation for syncing comments
}

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