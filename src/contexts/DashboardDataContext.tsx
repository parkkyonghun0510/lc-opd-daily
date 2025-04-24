"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchDashboardSummary, fetchUserDashboardData } from '@/app/_actions/dashboard-actions';
import { useUserData } from './UserDataContext';
import { useDashboardSSE } from '@/hooks/useDashboardSSE';
import { useSSE } from '@/hooks/useSSE';

interface DashboardContextType {
  dashboardData: any;
  isLoading: boolean;
  isSseConnected: boolean;
  sseError: string | null;
  refreshDashboardData: () => Promise<void>;
  reconnectSSE: () => void;
}

const DashboardDataContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { userData } = useUserData();

  const role = userData?.computedFields?.accessLevel || 'USER';

  // Use the SSE hook directly with role-based configuration
  const {
    lastEvent,
    isConnected: isSseConnected,
    error: sseError,
    reconnect: reconnectSSE
  } = useSSE({
    endpoint: '/api/dashboard/sse',
    clientMetadata: {
      type: 'dashboard',
      role: role
    },
    eventHandlers: {
      // Handle dashboard updates
      dashboardUpdate: (data) => {
        console.log('Received dashboard update via SSE:', data);

        // Dispatch a custom event that components can listen for
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('dashboard-update', { detail: data });
          window.dispatchEvent(event);
        }

        // Automatically refresh data when we receive an update
        fetchData();
      },
      // Handle role-specific updates
      [`${role.toLowerCase()}Update`]: (data) => {
        console.log(`Received ${role.toLowerCase()} update via SSE:`, data);
        fetchData();
      }
    },
    debug: process.env.NODE_ENV === 'development'
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

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
  }, [role]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData, userData?.computedFields?.accessLevel]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle SSE updates from the lastEvent
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'dashboardUpdate') {
      console.log('Processing dashboard update from lastEvent:', lastEvent.payload);
      // We don't need to call fetchData() here as it's already handled in the event handler
    }
  }, [lastEvent]);

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
        reconnectSSE
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
