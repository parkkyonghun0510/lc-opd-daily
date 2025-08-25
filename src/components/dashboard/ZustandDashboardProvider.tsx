'use client';

import { useEffect } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useDashboardStore } from '@/stores/dashboardStore';
import { MinimalLoadingIndicator } from '@/auth/components/GlobalLoadingIndicator';

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
  autoRefreshInterval = 2 * 60 * 1000, // Reduced to 2 minutes for better responsiveness
  debug = false
}: ZustandDashboardProviderProps) {
  // Get auth state from Zustand store
  const { user, isAuthenticated } = useAuth();

  // Get dashboard state from Zustand store
  const {
    fetchDashboardData,
    setConnectionStatus,
    setConnectionError,
    shouldFetch,
    isLoading
  } = useDashboardStore();

  // Get user role
  const role = user?.role || 'USER';

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchDashboardData(role);

      // Set connection status to connected with polling method
      setConnectionStatus(true, 'polling');
      setConnectionError(null);
    }
  }, [isAuthenticated, user, role, fetchDashboardData, setConnectionStatus, setConnectionError]);

  // Auto-refresh at specified interval with smart caching
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const interval = setInterval(() => {
      // Only fetch if we should (respects cache and loading state)
      if (shouldFetch(role) && !isLoading) {
        if (debug) {
          console.log('[ZustandDashboard] Auto-refresh triggered for role:', role);
        }
        fetchDashboardData(role, false); // Don't force, respect cache
      }
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [isAuthenticated, user, role, autoRefreshInterval, fetchDashboardData, shouldFetch, isLoading, debug]);

  // Listen for reconnect requests
  useEffect(() => {
    const handleReconnectRequest = () => {
      if (debug) {
        console.log('[ZustandDashboard] Reconnect requested');
      }

      // Just fetch data again
      fetchDashboardData(role);
    };

    window.addEventListener('sse-reconnect-requested', handleReconnectRequest);

    return () => {
      window.removeEventListener('sse-reconnect-requested', handleReconnectRequest);
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
