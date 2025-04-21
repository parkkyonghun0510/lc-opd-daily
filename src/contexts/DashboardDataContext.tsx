"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { useDashboardSSE } from "@/hooks/useDashboardSSE";
import { fetchDashboardSummary, DashboardSummaryData, fetchUserDashboardData } from "@/app/_actions/dashboard-actions";
import { DashboardEventTypes, DashboardEventType, DashboardUpdatePayload } from "@/lib/events/dashboard-events";

// Define the shape of the data you expect to manage in this context
// Use the interface from the server action
type UserDashboardData = {
  userReports: number;
  pendingReports: number;
  growthRate: number;
  recentActivities: { description: string; details: any; timestamp: string }[];
};

type DashboardContextDataType = DashboardSummaryData | UserDashboardData | null;

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
      // Determine user role from sessionStorage (client)
      let role: string | undefined = undefined;
      if (typeof window !== 'undefined') {
        const session = window.sessionStorage.getItem('nextauth.user');
        if (session) {
          try {
            const user = JSON.parse(session);
            role = user?.role;
          } catch {}
        }
      }
      // If role is not ADMIN or BRANCH_MANAGER, fetch user dashboard data
      if (role !== 'ADMIN' && role !== 'BRANCH_MANAGER') {
        const result = await fetchUserDashboardData();
        if (result.status === 200 && result.data) {
          setDashboardData(result.data);
        } else {
          throw new Error(result.error || "Failed to fetch user dashboard data");
        }
      } else {
        // Otherwise, fetch the regular dashboard summary
        const result = await fetchDashboardSummary();
        if (result.status === 200 && result.data) {
          setDashboardData(result.data);
        } else {
          throw new Error(result.error || "Failed to fetch dashboard summary");
        }
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

  // Handle SSE connection state
  

  // Handle SSE updates
  useEffect(() => {
    if (lastEventData?.type === 'dashboardUpdate' && lastEventData.payload) {
      //console.log('[DashboardDataContext] Received SSE update:', JSON.stringify(lastEventData, null, 2));
      
      const { type: updateType, data: payload } = lastEventData.payload as DashboardUpdatePayload;
      
      if (!updateType || !payload) {
        console.warn('[DashboardDataContext] Invalid payload format:', JSON.stringify(lastEventData.payload, null, 2));
        //console.log('[DashboardDataContext] Triggering refresh due to invalid format');
        refreshDashboardData();
        return;
      }

      //console.log('[DashboardDataContext] Processing update - Type:', updateType, 'Payload:', JSON.stringify(payload, null, 2));
      
      const prevDashboardData = dashboardData;
      //console.log('[DashboardDataContext] Current dashboard data:', JSON.stringify(prevDashboardData, null, 2));

      // Define which update types should trigger a full refresh

      // Define update types that trigger a full dashboard refresh
      // Grouped by domain for better organization and maintenance
      const refreshTriggers: DashboardEventType[] = [
        // Report Core Events
        DashboardEventTypes.REPORT_CREATED,
        DashboardEventTypes.REPORT_UPDATED,
        DashboardEventTypes.REPORT_DELETED,
        
        // Report Attribute Events
        DashboardEventTypes.REPORT_STATUS_UPDATED,
        DashboardEventTypes.REPORT_PRIORITY_UPDATED,
        DashboardEventTypes.REPORT_CATEGORY_UPDATED,
        DashboardEventTypes.REPORT_DUE_DATE_UPDATED,
        DashboardEventTypes.REPORT_ASSIGNMENT_UPDATED,
        
        // Report Content Events
        DashboardEventTypes.REPORT_TAG_UPDATED,
        DashboardEventTypes.REPORT_COMMENT_UPDATED,
        DashboardEventTypes.REPORT_ATTACHMENT_UPDATED,
        
        // Resolution Events
        DashboardEventTypes.REPORT_RESOLUTION_UPDATED,
        DashboardEventTypes.REPORT_RESOLUTION_STATUS_UPDATED,
        DashboardEventTypes.REPORT_RESOLUTION_CONTENT_UPDATED,
        
        // User Events
        DashboardEventTypes.USER_CREATED,
        DashboardEventTypes.USER_UPDATED,
        DashboardEventTypes.USER_DELETED,
        DashboardEventTypes.USER_ASSIGNMENT_UPDATED,
        
        // Branch Events
        DashboardEventTypes.BRANCH_CREATED,
        DashboardEventTypes.BRANCH_UPDATED,
        DashboardEventTypes.BRANCH_DELETED,
        DashboardEventTypes.BRANCH_ASSIGNMENT_UPDATED,
        
        // Analytics Events
        DashboardEventTypes.GROWTH_RATE_UPDATED,
        DashboardEventTypes.DASHBOARD_METRICS_UPDATED,
      ];

      if (refreshTriggers.includes(updateType)) {
        //console.log(`[DashboardDataContext] Refreshing dashboard data due to ${updateType} event`);
        refreshDashboardData();
      } else {
        // Only update specific fields without a full refresh
        //console.log(`[DashboardDataContext] Handling specific update for ${updateType} event`);
        setDashboardData(prevData => {
          if (!prevData) return null;
          const newData = { ...prevData };

          // Type guard for payload
          interface GrowthRatePayload {
            growthRate: number;
          }

          // Only update if we have valid payload data
          if (payload && typeof payload === 'object') {
            // Handle growth rate updates
            if (updateType === DashboardEventTypes.GROWTH_RATE_UPDATED &&
                'growthRate' in payload &&
                typeof (payload as GrowthRatePayload).growthRate === 'number') {
              newData.growthRate = (payload as GrowthRatePayload).growthRate;
              //console.log('[DashboardDataContext] Updated growthRate:', newData.growthRate);
            }
            // Add other specific field updates as needed, with appropriate type guards
          }
          return newData;
        });
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
