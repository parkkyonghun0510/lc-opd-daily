"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchDashboardSummary, fetchUserDashboardData } from '@/app/_actions/dashboard-actions';
import { useUserData } from './UserDataContext';
import { useHybridRealtime } from '@/hooks/useHybridRealtime';
import { toast } from '@/components/ui/use-toast';

interface DashboardContextType {
  dashboardData: any;
  isLoading: boolean;
  isConnected: boolean;
  connectionMethod: 'sse' | 'polling' | null;
  connectionError: string | null;
  refreshDashboardData: () => Promise<void>;
  reconnect: () => void;
  retryCount: number;
  hasNewUpdates: boolean;
  clearNewUpdates: () => void;
}

const DashboardDataContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const { userData } = useUserData();

  const role = userData?.computedFields?.accessLevel || 'USER';

  // Use the hybrid realtime hook
  const {
    isConnected,
    activeMethod,
    lastEvent,
    error,
    reconnect
  } = useHybridRealtime({
    eventHandlers: {
      // Handle dashboard updates
      dashboardUpdate: (data) => {
        console.log('Received dashboard update via hybrid realtime:', data);
        setHasNewUpdates(true);

        // Dispatch a custom event that components can listen for
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('dashboard-update', { detail: data });
          window.dispatchEvent(event);
        }

        // Show a toast notification
        toast({
          title: "Dashboard Updated",
          description: `New dashboard data is available.`,
          duration: 5000,
        });

        // Automatically refresh data when we receive an update
        fetchData();
      },
      // Handle role-specific updates
      [`${role.toLowerCase()}Update`]: (data) => {
        console.log(`Received ${role.toLowerCase()} update via hybrid realtime:`, data);
        setHasNewUpdates(true);
        fetchData();
      }
    },
    debug: process.env.NODE_ENV === 'development'
  });

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setConnectionError(null);

      // Fetch dashboard data based on user role
      let response;
      if (role === 'ADMIN' || role === 'BRANCH_MANAGER') {
        response = await fetchDashboardSummary();
      } else {
        response = await fetchUserDashboardData();
      }

      if (response.status === 200 && response.data) {
        setDashboardData(response.data);
        console.log('Dashboard data fetched successfully:', response.data);
      } else {
        console.error('Failed to fetch dashboard data:', response.error);
        setConnectionError(response.error || 'Failed to fetch dashboard data');

        // Increment retry count
        setRetryCount(prev => prev + 1);

        // Show toast notification
        toast({
          title: "Dashboard Connection Error",
          description: `Error connecting to dashboard: ${response.error || 'Unknown error'}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Connection error';
      setConnectionError(errorMessage);

      // Increment retry count
      setRetryCount(prev => prev + 1);

      // Show toast notification
      toast({
        title: "Dashboard Connection Error",
        description: `Error connecting to dashboard: ${errorMessage}`,
        variant: "destructive",
      });
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

  // Handle realtime updates from the lastEvent
  useEffect(() => {
    if (lastEvent && lastEvent.type === 'dashboardUpdate') {
      console.log('Processing dashboard update from lastEvent:', lastEvent.data);
      // We don't need to call fetchData() here as it's already handled in the event handler
    }
  }, [lastEvent]);

  // Enhanced refresh function with retry handling
  const refreshDashboardData = async () => {
    // Reset retry count when manually refreshing
    setRetryCount(0);
    setHasNewUpdates(false);
    await fetchData();
  };

  // Function to clear new updates flag
  const clearNewUpdates = () => {
    setHasNewUpdates(false);
  };

  return (
    <DashboardDataContext.Provider
      value={{
        dashboardData,
        isLoading,
        isConnected,
        connectionMethod: activeMethod,
        connectionError: connectionError || error,
        refreshDashboardData,
        reconnect,
        retryCount,
        hasNewUpdates,
        clearNewUpdates
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
