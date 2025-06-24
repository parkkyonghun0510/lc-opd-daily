interface PWAEvent {
  category: "PWA";
  action: "install" | "offline_usage" | "sync" | "share" | "file_handle";
  label?: string;
  value?: number;
  id?: number; // For IndexedDB
  timestamp?: number; // For IndexedDB
}

export const trackPWAEvent = async (event: PWAEvent) => {
  try {
    await fetch("/api/analytics/pwa", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
      // Allow the request to be retried when back online
      keepalive: true,
    });
  } catch (error) {
    // Store failed analytics in IndexedDB to retry later
    if (typeof window !== "undefined" && "indexedDB" in window) {
      const db = await openAnalyticsDB();
      const tx = db.transaction("failedEvents", "readwrite");
      const store = tx.objectStore("failedEvents");
      await store.add({
        ...event,
        timestamp: Date.now(),
      });
      console.error("Failed to send analytics, stored for retry:", error);
    }
  }
};

const openAnalyticsDB = async () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB not available in this environment"));
      return;
    }

    const request = indexedDB.open("pwaAnalytics", 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      db.createObjectStore("failedEvents", {
        keyPath: "id",
        autoIncrement: true,
      });
    };
  });
};

// Retry sending failed analytics events when online
if (typeof window !== "undefined") {
  window.addEventListener("online", async () => {
    try {
      const db = await openAnalyticsDB();
      const tx = db.transaction("failedEvents", "readwrite");
      const store = tx.objectStore("failedEvents");
      const eventsRequest = store.getAll();

      eventsRequest.onsuccess = async () => {
        const events = eventsRequest.result as PWAEvent[];
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          await trackPWAEvent(event);
          if (event.id) {
            await store.delete(event.id);
          }
        }
      };
    } catch (error) {
      console.error("Error retrying analytics:", error);
    }
  });
}
