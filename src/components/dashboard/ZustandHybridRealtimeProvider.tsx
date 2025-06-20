"use client";

import { useEffect, useMemo } from "react";
import { useAuth } from "@/auth/hooks/useAuth";
import { useDashboardStore } from "@/stores/dashboardStore";
import {
  useHybridRealtime,
  EventType,
  EventHandlersMap,
} from "@/hooks/useHybridRealtime";
import { toast } from "sonner";

interface ZustandHybridRealtimeProviderProps {
  children: React.ReactNode;
  autoRefreshInterval?: number;
  debug?: boolean;
  showToasts?: boolean;
  smartPolling?: boolean;
  pollingTimeout?: number;
}

/**
 * ZustandHybridRealtimeProvider component
 *
 * Provides real-time updates using the hybrid realtime hook with Zustand for state management.
 * This component is specifically designed for dashboard data and integrates with the dashboard store.
 *
 * @example
 * ```tsx
 * <ZustandHybridRealtimeProvider debug={process.env.NODE_ENV === 'development'}>
 *   <DashboardContent />
 * </ZustandHybridRealtimeProvider>
 * ```
 */
export function ZustandHybridRealtimeProvider({
  children,
  autoRefreshInterval = 10000,
  debug = false,
  showToasts = true,
  smartPolling = true,
  pollingTimeout = 60000, // 1 minute
}: ZustandHybridRealtimeProviderProps) {
  // Get auth state from Zustand store
  const { user, isAuthenticated } = useAuth();

  // Get dashboard state from Zustand store
  const {
    setConnectionStatus,
    setHasNewUpdates,
    fetchDashboardData,
    setConnectionError,
    clearNewUpdates,
  } = useDashboardStore();

  // Create event handlers
  const eventHandlers = useMemo<EventHandlersMap>(
    () => ({
      // Handle dashboard updates
      dashboardUpdate: (data: any) => {
        if (debug) {
          console.log(
            "[ZustandHybridRealtime] Received dashboard update:",
            data,
          );
        }

        // Ensure data has the expected structure
        const normalizedData = {
          ...data,
          id: data.id || crypto.randomUUID(),
          timestamp: data.timestamp || Date.now(),
          type: data.type || "dashboardUpdate",
        };

        // Set the new updates flag
        setHasNewUpdates(true);

        // Show a toast notification
        if (showToasts) {
          toast.info(
            normalizedData.title || "New dashboard data is available",
            {
              description:
                normalizedData.message ||
                normalizedData.body ||
                "Dashboard has been updated",
              action: {
                label: "Refresh",
                onClick: () => {
                  if (user?.role) {
                    fetchDashboardData(user.role);
                    clearNewUpdates();
                  }
                },
              },
            },
          );
        }

        // Automatically refresh data when we receive an update
        if (user?.role) {
          fetchDashboardData(user.role);
        }

        // Dispatch a custom event that components can listen for
        if (typeof window !== "undefined") {
          const event = new CustomEvent("dashboard-update", {
            detail: normalizedData,
            bubbles: true,
            cancelable: true,
          });
          window.dispatchEvent(event);
        }
      },

      // Handle notifications
      notification: (data: any) => {
        if (debug) {
          console.log("[ZustandHybridRealtime] Received notification:", data);
        }

        // Ensure data has the expected structure
        const normalizedData = {
          ...data,
          id: data.id || crypto.randomUUID(),
          timestamp: data.timestamp || Date.now(),
          title: data.title || "New notification",
          message: data.message || data.body || "You have a new notification",
          type: data.type || "info",
        };

        // Show a toast notification
        if (showToasts) {
          const toastType =
            normalizedData.type === "error"
              ? toast.error
              : normalizedData.type === "warning"
                ? toast.warning
                : toast.info;

          toastType(normalizedData.title, {
            description: normalizedData.message,
          });
        }
      },

      // Handle system alerts
      systemAlert: (data: any) => {
        if (debug) {
          console.log("[ZustandHybridRealtime] Received system alert:", data);
        }

        // Ensure data has the expected structure
        const normalizedData = {
          ...data,
          id: data.id || crypto.randomUUID(),
          timestamp: data.timestamp || Date.now(),
          title: data.title || "System alert",
          message: data.message || data.body || "System alert received",
          type: data.type || "warning",
        };

        // Show a toast notification
        if (showToasts) {
          const toastType =
            normalizedData.type === "error"
              ? toast.error
              : normalizedData.type === "warning"
                ? toast.warning
                : toast.info;

          toastType(normalizedData.title, {
            description: normalizedData.message,
          });
        }
      },

      // Handle role-specific updates
      [`${user?.role?.toLowerCase() || "user"}Update`]: (data: any) => {
        if (debug) {
          console.log(
            `[ZustandHybridRealtime] Received ${user?.role} update:`,
            data,
          );
        }

        // Ensure data has the expected structure
        const normalizedData = {
          ...data,
          id: data.id || crypto.randomUUID(),
          timestamp: data.timestamp || Date.now(),
          type: data.type || `${user?.role?.toLowerCase() || "user"}Update`,
        };

        // Set the new updates flag
        setHasNewUpdates(true);

        // Show a toast notification
        if (showToasts) {
          toast.info(
            normalizedData.title || `New ${user?.role} data is available`,
            {
              description:
                normalizedData.message ||
                normalizedData.body ||
                `${user?.role} dashboard has been updated`,
              action: {
                label: "Refresh",
                onClick: () => {
                  if (user?.role) {
                    fetchDashboardData(user.role);
                    clearNewUpdates();
                  }
                },
              },
            },
          );
        }

        // Automatically refresh data when we receive an update
        if (user?.role) {
          fetchDashboardData(user.role);
        }
      },

      // Wildcard handler for all events
      "*": (event: any) => {
        if (debug && event?.type) {
          console.log(
            `[ZustandHybridRealtime] Received generic event (${event.type}):`,
            event,
          );
        }
      },
    }),
    [
      user?.role,
      debug,
      showToasts,
      setHasNewUpdates,
      fetchDashboardData,
      clearNewUpdates,
    ],
  );

  // Use the hybrid realtime hook
  const {
    isConnected,
    activeMethod,
    connectionStatus,
    error,
    reconnect,
    getCachedEvents,
    getTimeSinceLastEvent,
  } = useHybridRealtime({
    pollingEndpoint: "/api/realtime/polling",
    pollingInterval: autoRefreshInterval,
    eventHandlers,
    debug,
    clientMetadata: {
      component: "ZustandHybridRealtimeProvider",
      role: user?.role || "user",
    },
  });

  // Update dashboard store with connection status
  useEffect(() => {
    setConnectionStatus(isConnected, activeMethod);
  }, [isConnected, activeMethod, setConnectionStatus]);

  // Update dashboard store with connection error
  useEffect(() => {
    setConnectionError(error);
  }, [error, setConnectionError]);

  // Listen for reconnect requests
  useEffect(() => {
    const handleReconnectRequest = () => {
      if (debug) {
        console.log("[ZustandHybridRealtime] Reconnect requested");
      }
      reconnect();
    };

    window.addEventListener("sse-reconnect-requested", handleReconnectRequest);

    return () => {
      window.removeEventListener(
        "sse-reconnect-requested",
        handleReconnectRequest,
      );
    };
  }, [reconnect, debug]);

  // Log connection status changes in debug mode
  useEffect(() => {
    if (debug) {
      console.log(
        `[ZustandHybridRealtime] Connection status: ${connectionStatus}`,
      );
      console.log(
        `[ZustandHybridRealtime] Active method: ${activeMethod || "none"}`,
      );
      console.log(
        `[ZustandHybridRealtime] Smart polling: ${smartPolling ? "enabled" : "disabled"}`,
      );

      // Log time since last event
      const timeSinceLastEvent = getTimeSinceLastEvent();
      if (timeSinceLastEvent !== Infinity) {
        console.log(
          `[ZustandHybridRealtime] Time since last event: ${Math.round(timeSinceLastEvent / 1000)}s`,
        );
      }

      // Log cached events count
      const dashboardEvents = getCachedEvents("dashboardUpdate");
      if (dashboardEvents.length > 0) {
        console.log(
          `[ZustandHybridRealtime] Cached dashboard events: ${dashboardEvents.length}`,
        );
      }
    }
  }, [
    connectionStatus,
    activeMethod,
    debug,
    getTimeSinceLastEvent,
    getCachedEvents,
    smartPolling,
  ]);

  return <>{children}</>;
}
