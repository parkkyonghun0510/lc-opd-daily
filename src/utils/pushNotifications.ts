/**
 * Cross-platform push notification utilities with better error handling
 * Supports web push for browsers and PWAs
 */

// Check if push notifications are supported in this browser
export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission | null {
  if (!("Notification" in window)) {
    return null;
  }
  return Notification.permission;
}

// Convert base64 string to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Request permission and subscribe to push notifications
export async function requestNotificationPermission(): Promise<PushSubscription | null> {
  try {
    if (!isPushSupported()) {
      console.error("Push notifications not supported");
      return null;
    }

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      //console.log('Notification permission not granted');
      return null;
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    if (!registration || !registration.pushManager) {
      console.error("Push manager not available");
      return null;
    }

    // Get VAPID public key
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error("VAPID public key not available");
      return null;
    }

    // Convert the VAPID key to the format expected by the push manager
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // Try to use existing subscription or create a new one
    let subscription = await registration.pushManager.getSubscription();

    // If subscription exists but has changed (e.g. different key), unsubscribe first
    if (subscription) {
      const existingKey = JSON.stringify(subscription);
      if (!existingKey.includes(vapidPublicKey.substring(0, 10))) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }

    // If no subscription exists, create one
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey,
      });
    }

    // Save subscription to server
    await saveSubscriptionToServer(subscription);

    return subscription;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    // Try to provide more helpful error messages based on error type
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      console.error("Permission request was denied by the user");
    } else if (error instanceof DOMException && error.name === "AbortError") {
      console.error(
        "Push subscription failed - browser might be in private browsing mode",
      );
    }
    return null;
  }
}

// Key for caching subscription status
const SUBSCRIPTION_STATUS_KEY = "push_subscription_status";
const SUBSCRIPTION_STATUS_TIMESTAMP_KEY = "push_subscription_status_timestamp";
const CACHE_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

// Check if user is already subscribed
export async function checkSubscription(): Promise<boolean> {
  try {
    if (!isPushSupported()) {
      return false;
    }

    // First check localStorage cache to avoid unnecessary API calls
    try {
      const cachedStatus = localStorage.getItem(SUBSCRIPTION_STATUS_KEY);
      const cachedTimestamp = localStorage.getItem(
        SUBSCRIPTION_STATUS_TIMESTAMP_KEY,
      );

      if (cachedStatus && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp, 10);
        const now = Date.now();

        // If cache is fresh (less than 24 hours old), use it
        if (now - timestamp < CACHE_TIMEOUT_MS) {
          return cachedStatus === "true";
        }
      }
    } catch (error) {
      console.error("Error reading from localStorage:", error);
      // Continue with normal flow if localStorage fails
    }

    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    if (!registration?.pushManager) {
      return false;
    }

    // Check if subscription exists
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      // Cache the result
      try {
        localStorage.setItem(SUBSCRIPTION_STATUS_KEY, "false");
        localStorage.setItem(
          SUBSCRIPTION_STATUS_TIMESTAMP_KEY,
          Date.now().toString(),
        );
      } catch (error) {
        console.error("Error writing to localStorage:", error);
      }
      return false;
    }

    // Verify the subscription with the server
    try {
      const response = await fetch("/api/push/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const isValid = result.valid === true;

        // Cache the result
        try {
          localStorage.setItem(SUBSCRIPTION_STATUS_KEY, isValid.toString());
          localStorage.setItem(
            SUBSCRIPTION_STATUS_TIMESTAMP_KEY,
            Date.now().toString(),
          );
        } catch (error) {
          console.error("Error writing to localStorage:", error);
        }

        return isValid;
      }
    } catch (error) {
      console.error("Error validating subscription with server:", error);
      // If server validation fails, fall back to local check
    }

    // If server validation failed or wasn't available, just check locally
    // Cache the result that we have a subscription
    try {
      localStorage.setItem(SUBSCRIPTION_STATUS_KEY, "true");
      localStorage.setItem(
        SUBSCRIPTION_STATUS_TIMESTAMP_KEY,
        Date.now().toString(),
      );
    } catch (error) {
      console.error("Error writing to localStorage:", error);
    }

    return true;
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
}

// Save subscription to server
async function saveSubscriptionToServer(
  subscription: PushSubscription,
): Promise<boolean> {
  try {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(
            String.fromCharCode.apply(
              null,
              Array.from(
                new Uint8Array(subscription.getKey("p256dh") as ArrayBuffer),
              ),
            ),
          ),
          auth: btoa(
            String.fromCharCode.apply(
              null,
              Array.from(
                new Uint8Array(subscription.getKey("auth") as ArrayBuffer),
              ),
            ),
          ),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to save subscription");
    }

    // Update local cache after successful server save
    try {
      localStorage.setItem(SUBSCRIPTION_STATUS_KEY, "true");
      localStorage.setItem(
        SUBSCRIPTION_STATUS_TIMESTAMP_KEY,
        Date.now().toString(),
      );
    } catch (error) {
      console.error("Error writing to localStorage:", error);
    }

    return true;
  } catch (error) {
    console.error("Error saving subscription to server:", error);
    return false;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    if (!isPushSupported()) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    if (!registration?.pushManager) {
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      // Already unsubscribed, update cache
      try {
        localStorage.setItem(SUBSCRIPTION_STATUS_KEY, "false");
        localStorage.setItem(
          SUBSCRIPTION_STATUS_TIMESTAMP_KEY,
          Date.now().toString(),
        );
      } catch (error) {
        console.error("Error writing to localStorage:", error);
      }
      return true; // Already unsubscribed
    }

    // Delete subscription from server
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });

    // Unsubscribe locally
    const result = await subscription.unsubscribe();

    // Update local cache after unsubscription
    try {
      localStorage.setItem(SUBSCRIPTION_STATUS_KEY, "false");
      localStorage.setItem(
        SUBSCRIPTION_STATUS_TIMESTAMP_KEY,
        Date.now().toString(),
      );
    } catch (error) {
      console.error("Error writing to localStorage:", error);
    }

    return result;
  } catch (error) {
    console.error("Error unsubscribing from push notifications:", error);
    return false;
  }
}

// Send a test notification to verify everything works
export async function sendTestNotification(): Promise<boolean> {
  try {
    const response = await fetch("/api/push/test", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to send test notification");
    }

    return true;
  } catch (error) {
    console.error("Error sending test notification:", error);
    return false;
  }
}

// Check for support and permissions at once
export function getNotificationStatus(): {
  isSupported: boolean;
  permission: NotificationPermission | null;
  isGranted: boolean;
} {
  const isSupported = isPushSupported();
  const permission = getNotificationPermission();
  return {
    isSupported,
    permission,
    isGranted: permission === "granted",
  };
}
