"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  fetchDashboardSummary,
  fetchUserDashboardData,
} from "@/app/_actions/dashboard-actions";
import { useAuth } from "@/auth/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { AuthenticatedSSE } from "./AuthenticatedSSE";
import { MinimalLoadingIndicator } from "./GlobalLoadingIndicator";

interface EnhancedDashboardContextType {
  dashboardData: any;
  isLoading: boolean;
  isConnected: boolean;
  connectionMethod: "sse" | "polling" | null;
  connectionError: string | null;
  refreshDashboardData: () => Promise<void>;
  hasNewUpdates: boolean;
  clearNewUpdates: () => void;
}

const EnhancedDashboardContext = createContext<
  EnhancedDashboardContextType | undefined
>(undefined);

export function EnhancedDashboardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<
    "sse" | "polling" | null
  >(null);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);

  // Use the new auth hook
  const { user, isAuthenticated } = useAuth();

  // Get role from the auth store
  const role = user?.role || "USER";

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setConnectionError(null);

      // Fetch dashboard data based on user role
      let response;
      if (role === "ADMIN" || role === "BRANCH_MANAGER") {
        response = await fetchDashboardSummary();
      } else {
        response = await fetchUserDashboardData();
      }

      // Check if the response is successful and has data
      if (response.status === 200 && response.data) {
        setDashboardData(response.data);
        console.log("Dashboard data fetched successfully");
      } else {
        throw new Error(response.error || "Failed to fetch dashboard data");
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Connection error";
      setConnectionError(errorMessage);

      // Show toast notification
      toast({
        title: "Dashboard Connection Error",
        description: `Error connecting to dashboard: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [role, toast]);

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [fetchData, isAuthenticated, user?.role]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData, isAuthenticated]);

  // Event handlers for SSE
  const eventHandlers = {
    // Handle dashboard updates
    dashboardUpdate: (data: any) => {
      console.log("Received dashboard update:", data);

      // Set the new updates flag
      setHasNewUpdates(true);

      // Show a toast notification
      toast({
        title: "Dashboard Updated",
        description: `New dashboard data is available.`,
        duration: 5000,
      });

      // Automatically refresh data when we receive an update
      fetchData();

      // Dispatch a custom event that components can listen for
      if (typeof window !== "undefined") {
        const event = new CustomEvent("dashboard-update", { detail: data });
        window.dispatchEvent(event);
      }
    },

    // Handle role-specific updates
    [`${role.toLowerCase()}Update`]: (data: any) => {
      console.log(`Received ${role.toLowerCase()} update:`, data);
      setHasNewUpdates(true);
      fetchData();
    },

    // Handle connection status updates
    connectionStatus: (data: any) => {
      setIsConnected(data.connected);
      setConnectionMethod(data.method);
    },
  };

  // Clear new updates flag
  const clearNewUpdates = useCallback(() => {
    setHasNewUpdates(false);
  }, []);

  // Enhanced refresh function
  const refreshDashboardData = useCallback(async () => {
    clearNewUpdates();
    await fetchData();
  }, [clearNewUpdates, fetchData]);

  return (
    <EnhancedDashboardContext.Provider
      value={{
        dashboardData,
        isLoading,
        isConnected,
        connectionMethod,
        connectionError,
        refreshDashboardData,
        hasNewUpdates,
        clearNewUpdates,
      }}
    >
      {/* Include the loading indicator */}
      <MinimalLoadingIndicator />

      {/* Include the AuthenticatedSSE component */}
      <AuthenticatedSSE
        eventHandlers={eventHandlers}
        debug={process.env.NODE_ENV === "development"}
      />

      {/* Render children */}
      {children}
    </EnhancedDashboardContext.Provider>
  );
}

export function useEnhancedDashboard() {
  const context = useContext(EnhancedDashboardContext);
  if (context === undefined) {
    throw new Error(
      "useEnhancedDashboard must be used within an EnhancedDashboardProvider",
    );
  }
  return context;
}
