"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchDashboardSummary, fetchUserDashboardData } from '@/app/_actions/dashboard-actions';
import { useUserData } from './UserDataContext';
import { useDashboardSSE } from '@/hooks/useDashboardSSE';

interface DashboardContextType {
  dashboardData: any;
  isLoading: boolean;
  isSseConnected: boolean;
  sseError: string | null;
  refreshDashboardData: () => Promise<void>;
}

const DashboardDataContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { userData } = useUserData();

  // Use the SSE hook to get real-time updates and connection status
  const {
    lastEventData,
    isConnected: isSseConnected,
    error: sseError
  } = useDashboardSSE();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      // Note: We don't need to set sseError anymore as it comes from the hook

      const role = userData?.computedFields?.accessLevel || 'USER';
      let response;

      if (role === 'BRANCH_MANAGER') {
        response = await fetchDashboardSummary();
      } else {
        response = await fetchUserDashboardData();
      }

      if (response.status === 200 && response.data) {
        setDashboardData(response.data);
      } else {
        console.error('Failed to fetch dashboard data:', response.error);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [userData?.computedFields?.accessLevel]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle SSE updates
  useEffect(() => {
    if (lastEventData && lastEventData.type === 'dashboardUpdate') {
      console.log('Received dashboard update via SSE:', lastEventData.type);
      // Update dashboard data if we receive an update via SSE
      fetchData();
    }
  }, [lastEventData]);

  const refreshDashboardData = async () => {
    await fetchData();
  };

  return (
    <DashboardDataContext.Provider
      value={{
        dashboardData,
        isLoading,
        isSseConnected,
        sseError,
        refreshDashboardData,
      }}
    >
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (context === undefined) {
    throw new Error('useDashboardData must be used within a DashboardDataProvider');
  }
  return context;
}
