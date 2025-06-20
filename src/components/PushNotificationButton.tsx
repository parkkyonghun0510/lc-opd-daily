import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { requestNotificationPermission } from "@/utils/pushNotifications";
import { registerServiceWorker } from "@/utils/serviceWorker";

// Key for storing the last cleanup time
const LAST_CLEANUP_TIME_KEY = "last_push_cleanup_time";
// Minimum time between cleanups (24 hours in milliseconds)
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

export function PushNotificationButton() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    const checkSupport = async () => {
      if ("Notification" in window && "serviceWorker" in navigator) {
        setIsSupported(true);
        try {
          await registerServiceWorker();

          // Only run cleanup if it hasn't been run recently
          const shouldRunCleanup = () => {
            try {
              const lastCleanupTime = localStorage.getItem(
                LAST_CLEANUP_TIME_KEY,
              );
              if (!lastCleanupTime) return true;

              const lastTime = parseInt(lastCleanupTime, 10);
              const now = Date.now();
              return now - lastTime > CLEANUP_INTERVAL;
            } catch (error) {
              console.error("Error checking cleanup time:", error);
              return false;
            }
          };

          // Only run cleanup if necessary
          if (shouldRunCleanup()) {
            await fetch("/api/push/cleanup", { method: "POST" });
            // Store current time as last cleanup time
            try {
              localStorage.setItem(
                LAST_CLEANUP_TIME_KEY,
                Date.now().toString(),
              );
            } catch (error) {
              console.error("Error storing cleanup time:", error);
            }
          }
        } catch (error) {
          console.error("Failed to register service worker:", error);
        }
      }
    };
    checkSupport();
  }, []);

  const handleSubscribe = async () => {
    try {
      setIsLoading(true);
      const subscription = await requestNotificationPermission();
      if (subscription) {
        setIsSubscribed(true);
        // No need to call cleanup here again since we're throttling it
      }
    } catch (error) {
      console.error("Error subscribing to push notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return null; // Don't show the button if push notifications are not supported
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSubscribe}
      disabled={isLoading || isSubscribed}
      className="gap-2"
    >
      <Bell className="h-4 w-4" />
      {isSubscribed ? "Notifications Enabled" : "Enable Notifications"}
    </Button>
  );
}
