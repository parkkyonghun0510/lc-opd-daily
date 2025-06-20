"use client";

import { useEffect } from "react";
import { useAuth } from "@/auth/hooks/useAuth";
import { useDashboardStore } from "@/stores/dashboardStore";
import { MinimalLoadingIndicator } from "@/auth/components/GlobalLoadingIndicator";

interface ZustandDashboardProviderProps {
  children: React.ReactNode;
  autoRefreshInterval?: number; // in milliseconds
  debug?: boolean;
}

/**
 * ZustandDashboardProvider component
 *
 * Provides dashboard data and polling updates using Zustand for state management.
 * This is a simplified version that doesn't use SSE or hybrid realtime to avoid conflicts.
 */
export function ZustandDashboardProvider({
  children,
  autoRefreshInterval = 5 * 60 * 1000, // 5 minutes
  debug = false,
}: ZustandDashboardProviderProps) {
  // Get auth state from Zustand store
  const { user, isAuthenticated } = useAuth();

  // Get dashboard state from Zustand store
  const { fetchDashboardData, setConnectionStatus, setConnectionError } =
    useDashboardStore();

  // Get user role
  const role = user?.role || "USER";

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchDashboardData(role);

      // Set connection status to connected with polling method
      setConnectionStatus(true, "polling");
      setConnectionError(null);
    }
  }, [
    isAuthenticated,
    user,
    role,
    fetchDashboardData,
    setConnectionStatus,
    setConnectionError,
  ]);

  // Auto-refresh at specified interval
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      fetchDashboardData(role);
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [isAuthenticated, role, autoRefreshInterval, fetchDashboardData]);

  // Listen for reconnect requests
  useEffect(() => {
    const handleReconnectRequest = () => {
      if (debug) {
        console.log("[ZustandDashboard] Reconnect requested");
      }

      // Just fetch data again
      fetchDashboardData(role);
    };

    window.addEventListener("sse-reconnect-requested", handleReconnectRequest);

    return () => {
      window.removeEventListener(
        "sse-reconnect-requested",
        handleReconnectRequest,
      );
    };
  }, [debug, fetchDashboardData, role]);

  return (
    <>
      {/* Include the loading indicator */}
      <MinimalLoadingIndicator />

      {/* Render children */}
      {children}
    </>
  );
}
