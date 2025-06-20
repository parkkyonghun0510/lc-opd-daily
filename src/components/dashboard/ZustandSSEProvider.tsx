"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/auth/hooks/useAuth";
import { useDashboardStore } from "@/stores/dashboardStore";
import { toast } from "sonner";

interface ZustandSSEProviderProps {
  children: React.ReactNode;
  debug?: boolean;
}

/**
 * ZustandSSEProvider component
 *
 * Provides Server-Sent Events (SSE) functionality for real-time dashboard updates
 * using Zustand for state management
 */
export function ZustandSSEProvider({
  children,
  debug = false,
}: ZustandSSEProviderProps) {
  // Get auth state from Zustand store
  const { user, isAuthenticated } = useAuth();

  // Get dashboard state from Zustand store
  const {
    setConnectionStatus,
    setHasNewUpdates,
    fetchDashboardData,
    setConnectionError,
  } = useDashboardStore();

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 5;

  // Debug logging
  const log = (message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[ZustandSSE] ${message}`, ...args);
    }
  };

  // Set up SSE connection
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      log("Not authenticated, skipping SSE setup");
      return;
    }

    const setupSSE = () => {
      try {
        // Close existing connection if any
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Create URL with query parameters
        const url = new URL("/api/realtime/sse", window.location.origin);
        url.searchParams.append("clientType", "zustand");
        url.searchParams.append("userId", user.id);
        url.searchParams.append("role", user.role || "USER");
        url.searchParams.append("_t", Date.now().toString()); // Cache buster

        // Create new EventSource
        log("Setting up SSE connection to", url.toString());
        const eventSource = new EventSource(url.toString());
        eventSourceRef.current = eventSource;

        // Set up event listeners
        eventSource.onopen = () => {
          log("SSE connection opened");
          setConnectionStatus(true, "sse");
          setConnectionError(null);
          reconnectAttemptsRef.current = 0;
        };

        eventSource.onerror = (err) => {
          log("SSE connection error:", err);
          eventSource.close();
          eventSourceRef.current = null;
          setConnectionStatus(false);
          setConnectionError("SSE connection error");

          // Try to reconnect
          reconnectAttemptsRef.current++;
          if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttemptsRef.current - 1),
              30000,
            );
            log(
              `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              setupSSE();
            }, delay);
          } else {
            log(
              "Maximum reconnection attempts reached, falling back to polling",
            );
            setConnectionStatus(true, "polling");
            // Start polling (handled by the dashboard component)
          }
        };

        // Listen for specific events
        eventSource.addEventListener("connected", (e) => {
          try {
            const data = JSON.parse(e.data);
            log("Connected event:", data);
            setConnectionStatus(true, "sse");
            setConnectionError(null);
          } catch (err) {
            log("Error parsing connected event:", err);
          }
        });

        // Generic event listener for all event types
        const handleEvent = (e: MessageEvent) => {
          try {
            const eventType = e.type;
            const data = JSON.parse(e.data);

            log(`Received ${eventType} event:`, data);

            // Set the new updates flag
            setHasNewUpdates(true);

            // Show a toast notification
            toast.info(`New dashboard data is available (${eventType})`);

            // Automatically refresh data when we receive an update
            fetchDashboardData(user.role);

            // Dispatch a custom event that components can listen for
            if (typeof window !== "undefined") {
              const event = new CustomEvent("dashboard-update", {
                detail: data,
              });
              window.dispatchEvent(event);
            }
          } catch (err) {
            log("Error processing event:", err);
          }
        };

        // Add listeners for common event types
        eventSource.addEventListener("notification", handleEvent);
        eventSource.addEventListener("dashboardUpdate", handleEvent);
        eventSource.addEventListener("systemAlert", handleEvent);

        // Add role-specific event listener
        if (user.role) {
          const roleEvent = `${user.role.toLowerCase()}Update`;
          eventSource.addEventListener(roleEvent, handleEvent);
        }
      } catch (err) {
        log("Error setting up SSE:", err);
        setConnectionError(
          err instanceof Error ? err.message : "Unknown error setting up SSE",
        );
      }
    };

    // Set up SSE connection
    setupSSE();

    // Listen for reconnect requests
    const handleReconnectRequest = () => {
      log("Reconnect requested");
      reconnectAttemptsRef.current = 0;
      setupSSE();
    };

    window.addEventListener("sse-reconnect-requested", handleReconnectRequest);

    // Cleanup function
    return () => {
      // Close SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Remove event listener
      window.removeEventListener(
        "sse-reconnect-requested",
        handleReconnectRequest,
      );
    };
  }, [
    isAuthenticated,
    user,
    debug,
    setConnectionStatus,
    setHasNewUpdates,
    fetchDashboardData,
    setConnectionError,
  ]);

  return <>{children}</>;
}
