"use client";

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import {
  fetchDashboardSummary,
  fetchUserDashboardData,
} from "@/app/_actions/dashboard-actions";
import { toast } from "sonner";

// Define types for dashboard state
export interface DashboardState {
  // Data
  dashboardData: unknown;

  // Status
  isLoading: boolean;
  isConnected: boolean;
  connectionMethod: "sse" | "polling" | null;
  connectionError: string | null;
  hasNewUpdates: boolean;
  retryCount: number;
  lastUpdated: number | null;

  // Actions
  setDashboardData: (data: unknown) => void;
  setLoading: (isLoading: boolean) => void;
  setConnectionStatus: (
    isConnected: boolean,
    method?: "sse" | "polling" | null,
  ) => void;
  setConnectionError: (error: string | null) => void;
  setHasNewUpdates: (hasUpdates: boolean) => void;
  incrementRetryCount: () => void;
  resetRetryCount: () => void;
  clearNewUpdates: () => void;

  // Async actions
  fetchDashboardData: (role: string) => Promise<void>;
  refreshDashboardData: (role: string) => Promise<void>;
}

// Create the dashboard store
export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        dashboardData: null,
        isLoading: false,
        isConnected: false,
        connectionMethod: null,
        connectionError: null,
        hasNewUpdates: false,
        retryCount: 0,
        lastUpdated: null,

        // Actions
        setDashboardData: (data) =>
          set({ dashboardData: data, lastUpdated: Date.now() }),
        setLoading: (isLoading) => set({ isLoading }),
        setConnectionStatus: (isConnected, method) =>
          set({
            isConnected,
            connectionMethod: method || get().connectionMethod,
          }),
        setConnectionError: (error) => set({ connectionError: error }),
        setHasNewUpdates: (hasUpdates) => set({ hasNewUpdates: hasUpdates }),
        incrementRetryCount: () =>
          set((state) => ({ retryCount: state.retryCount + 1 })),
        resetRetryCount: () => set({ retryCount: 0 }),
        clearNewUpdates: () => set({ hasNewUpdates: false }),

        // Async actions
        fetchDashboardData: async (role) => {
          const state = get();

          try {
            set({ isLoading: true, connectionError: null });

            // Fetch dashboard data based on user role
            let response;
            if (role === "ADMIN" || role === "BRANCH_MANAGER") {
              response = await fetchDashboardSummary();
            } else {
              response = await fetchUserDashboardData();
            }

            if (response.status === 200 && response.data) {
              set({
                dashboardData: response.data,
                lastUpdated: Date.now(),
              });
              // console.log('Dashboard data fetched successfully:', response.data);
            } else {
              console.error("Failed to fetch dashboard data:", response.error);
              set({
                connectionError:
                  response.error || "Failed to fetch dashboard data",
                retryCount: state.retryCount + 1,
              });

              // Show toast notification
              toast.error(
                `Error connecting to dashboard: ${response.error || "Unknown error"}`,
              );
            }
          } catch (error) {
            console.error("Error fetching dashboard data:", error);
            const errorMessage =
              error instanceof Error ? error.message : "Connection error";

            set({
              connectionError: errorMessage,
              retryCount: state.retryCount + 1,
            });

            // Show toast notification
            toast.error(`Error connecting to dashboard: ${errorMessage}`);
          } finally {
            set({ isLoading: false });
          }
        },

        refreshDashboardData: async (role) => {
          // Reset retry count when manually refreshing
          set({ retryCount: 0, hasNewUpdates: false });
          await get().fetchDashboardData(role);
        },
      }),
      {
        name: "dashboard-storage",
        partialize: (state) => ({
          // Only persist these fields
          dashboardData: state.dashboardData,
          lastUpdated: state.lastUpdated,
        }),
      },
    ),
  ),
);

// Custom hook for dashboard data with role awareness
export function useDashboardData(role: string = "USER") {
  const {
    dashboardData,
    isLoading,
    isConnected,
    connectionMethod,
    connectionError,
    hasNewUpdates,
    retryCount,
    fetchDashboardData,
    refreshDashboardData,
    setConnectionStatus,
    setHasNewUpdates,
    clearNewUpdates,
  } = useDashboardStore();

  // Wrapper function that includes the role
  const fetchData = async () => {
    await fetchDashboardData(role);
  };

  // Wrapper function that includes the role
  const refresh = async () => {
    await refreshDashboardData(role);
  };

  return {
    dashboardData,
    isLoading,
    isConnected,
    connectionMethod,
    connectionError,
    hasNewUpdates,
    retryCount,
    fetchDashboardData: fetchData,
    refreshDashboardData: refresh,
    setConnectionStatus,
    setHasNewUpdates,
    clearNewUpdates,
  };
}

// Export a reconnect function for SSE
export function useReconnect() {
  return {
    reconnect: () => {
      // This is a placeholder - the actual reconnect logic will be in the SSE component
      console.log("Reconnect requested");
      // We'll dispatch a custom event that the SSE component can listen for
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sse-reconnect-requested"));
      }
      return true;
    },
  };
}
