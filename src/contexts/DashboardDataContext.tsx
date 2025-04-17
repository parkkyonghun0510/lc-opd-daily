"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useDashboardSSE } from "@/hooks/useDashboardSSE"; // Import the updated hook
import { fetchDashboardSummary, DashboardSummaryData } from "@/app/_actions/dashboard-actions"; // Import the server action

// Define the shape of the data you expect to manage in this context
// Use the interface from the server action
type DashboardContextDataType = DashboardSummaryData | null;

type DashboardDataContextType = {
  dashboardData: DashboardContextDataType;
  isLoading: boolean;
  isSseConnected: boolean;
  sseError: string | null;
  refreshDashboardData: () => Promise<void>;
};

const DashboardDataContext = createContext<DashboardDataContextType | undefined>(undefined);

export const DashboardDataProvider = ({ children }: { children: ReactNode }) => {
  const { lastEventData, isConnected, error: sseError } = useDashboardSSE();
  const [dashboardData, setDashboardData] = useState<DashboardContextDataType>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Function to fetch/refresh dashboard data
  const refreshDashboardData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const result = await fetchDashboardSummary();
      if (result.status === 200 && result.data) {
        setDashboardData(result.data);
      } else {
        throw new Error(result.error || "Failed to fetch dashboard summary");
      }
    } catch (err: any) {
      console.error("[DashboardDataContext] Error fetching dashboard data:", err);
      setFetchError(err.message || "An unknown error occurred");
      // Optionally clear data on error or keep stale data
      // setDashboardData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    refreshDashboardData();
  }, [refreshDashboardData]);

  // Handle SSE updates
  useEffect(() => {
    if (lastEventData && lastEventData.type === 'dashboardUpdate') {
      const { type: updateType, payload } = lastEventData.payload;
      console.log('[DashboardDataContext] Received SSE update:', updateType, payload);

      // Define which update types should trigger a full refresh
      const refreshTriggers = [
        'NEW_REPORT_CREATED',
        'REPORT_UPDATED', // Covers status changes, edits
        'REPORT_DELETED', // Need to add broadcast for this
        'USER_PROFILE_UPDATED', // If dashboard shows user counts
        'BRANCH_ASSIGNMENT_CHANGED', // If dashboard filters by branch
        'USER_ASSIGNMENT_CHANGED', // If dashboard filters by user
        'BRANCH_CREATED', // If dashboard filters by branch
        'BRANCH_DELETED', // Need to add broadcast for this
        'USER_CREATED', // If dashboard filters by user
        'USER_DELETED', // Need to add broadcast for this
        'BRANCH_UPDATED', // If dashboard filters by branch
        'USER_UPDATED', // If dashboard filters by user
        'REPORT_STATUS_CHANGED', // If dashboard filters by status
        'REPORT_ASSIGNMENT_CHANGED', // If dashboard filters by user
        'REPORT_PRIORITY_CHANGED', // If dashboard filters by priority
        'REPORT_DUE_DATE_CHANGED', // If dashboard filters by due date
        'REPORT_CATEGORY_CHANGED', // If dashboard filters by category
        'REPORT_TAG_ADDED', // If dashboard filters by tags
        'REPORT_TAG_REMOVED', // If dashboard filters by tags
        'REPORT_COMMENT_ADDED', // If dashboard filters by comments
        'REPORT_COMMENT_REMOVED', // If dashboard filters by comments
        'REPORT_ATTACHMENT_ADDED', // If dashboard filters by attachments
        'REPORT_ATTACHMENT_REMOVED', // If dashboard filters by attachments
        'REPORT_RESOLUTION_ADDED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_REMOVED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_UPDATED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_STATUS_CHANGED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_COMMENT_ADDED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_COMMENT_REMOVED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_COMMENT_UPDATED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_ATTACHMENT_ADDED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_ATTACHMENT_REMOVED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_ATTACHMENT_UPDATED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_TAG_ADDED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_TAG_REMOVED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_TAG_UPDATED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_ATTACHMENT_UPDATED', // If dashboard filters by resolutions
        'REPORT_RESOLUTION_ATTACHMENT_UPDATED', // If dashboard filters by resolutions
        // Add other relevant types that affect dashboard aggregates
      ];

      if (refreshTriggers.includes(updateType)) {
        console.log(`[DashboardDataContext] Refreshing dashboard data due to ${updateType} event.`);
        refreshDashboardData();
      } else {
        // Optionally handle specific updates directly if they don't require full refresh
        console.log(`[DashboardDataContext] Refreshing dashboard data due to ${updateType} event.`);

        // Example: Update a specific counter if payload provides enough info
        // setDashboardData(prevData => {
        //   if (!prevData) return null;
        //   const newData = { ...prevData };
        //   if (updateType === 'SOME_MINOR_UPDATE') {
        //      newData.someValue = payload.newValue;
        //   }
        //   return newData;
        // });
      }
    }
  }, [lastEventData, refreshDashboardData]);

  const contextValue = useMemo(() => ({
    dashboardData,
    isLoading,
    isSseConnected: isConnected,
    sseError: sseError || fetchError, // Combine SSE and fetch errors
    refreshDashboardData,
  }), [dashboardData, isLoading, isConnected, sseError, fetchError, refreshDashboardData]);

  return (
    <DashboardDataContext.Provider value={contextValue}>
      {children}
    </DashboardDataContext.Provider>
  );
};

export const useDashboardData = () => {
  const context = useContext(DashboardDataContext);
  if (context === undefined) {
    throw new Error("useDashboardData must be used within a DashboardDataProvider");
  }
  return context;
};
