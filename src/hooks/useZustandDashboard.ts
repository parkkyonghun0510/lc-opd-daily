"use client";

import { useAuth } from "@/auth/hooks/useAuth";
import { useDashboardData, useReconnect } from "@/stores/dashboardStore";

/**
 * Hook for accessing dashboard data with Zustand state management
 *
 * This hook combines the dashboard data from the Zustand store with
 * the user's role from the auth store to provide a unified interface
 * for dashboard data access.
 */
import { useMemo } from "react";

export function useZustandDashboard() {
  // Get user role from auth store
  const { user } = useAuth();
  const role = user?.role || "USER";

  // Get dashboard data from dashboard store
  const dashboard = useDashboardData(role);

  // Get reconnect function
  const { reconnect } = useReconnect();

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      ...dashboard,
      reconnect,
      role,
    }),
    [dashboard, reconnect, role],
  );
}
