"use client";

import { useHybridRealtime } from "@/hooks/useHybridRealtime";
import { useUserData } from "@/contexts/UserDataContext";

/**
 * Dashboard-specific SSE data type
 */
export interface DashboardSSEData {
  type: string;
  data: any;
  timestamp?: number;
}

/**
 * Hook for dashboard-specific real-time updates
 *
 * This hook uses the Zustand hybrid realtime system with dashboard-specific configuration.
 * It provides real-time updates for dashboard data using either SSE or polling.
 */
export const useDashboardSSE = () => {
  // Get user data to determine role
  const { userData } = useUserData();
  const role = userData?.computedFields?.accessLevel || "USER";

  // Use the hybrid realtime system with dashboard-specific configuration
  const { lastEvent, isConnected, error, reconnect, activeMethod } =
    useHybridRealtime({
      pollingEndpoint: "/api/dashboard/polling",
      clientMetadata: {
        type: "dashboard",
        role: role,
      },
      eventHandlers: {
        // Handle dashboard updates
        dashboardUpdate: (data) => {
          console.log("Received dashboard update via hybrid realtime:", data);

          // Dispatch a custom event that components can listen for
          if (typeof window !== "undefined") {
            const event = new CustomEvent("dashboard-update", { detail: data });
            window.dispatchEvent(event);
          }
        },
        // Handle role-specific updates
        [`${role.toLowerCase()}Update`]: (data) => {
          console.log(
            `Received ${role.toLowerCase()} update via hybrid realtime:`,
            data,
          );

          // Dispatch a role-specific custom event
          if (typeof window !== "undefined") {
            const event = new CustomEvent(`${role.toLowerCase()}-update`, {
              detail: data,
            });
            window.dispatchEvent(event);
          }
        },
      },
      debug: process.env.NODE_ENV === "development",
    });

  // Transform the generic event into a dashboard-specific format
  const lastEventData = lastEvent
    ? {
        type: lastEvent.type,
        payload: lastEvent.data,
      }
    : null;

  return {
    lastEventData,
    isConnected,
    error,
    reconnect,
    connectionMethod: activeMethod,
  };
};
