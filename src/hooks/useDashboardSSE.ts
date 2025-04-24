'use client';

import { useSSE } from './useSSE';
import { useUserData } from '@/contexts/UserDataContext';

/**
 * Dashboard-specific SSE data type
 */
export interface DashboardSSEData {
  type: string;
  data: any;
  timestamp?: number;
}

/**
 * Hook for dashboard-specific SSE connections
 *
 * This hook uses the standardized useSSE hook with dashboard-specific configuration.
 * It provides real-time updates for dashboard data.
 */
export const useDashboardSSE = () => {
  // Get user data to determine role
  const { userData } = useUserData();
  const role = userData?.computedFields?.accessLevel || 'USER';

  // Use the standardized SSE hook with dashboard-specific configuration
  const {
    lastEvent,
    isConnected,
    error,
    reconnect
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
      },
      // Handle role-specific updates
      [`${role.toLowerCase()}Update`]: (data) => {
        console.log(`Received ${role.toLowerCase()} update via SSE:`, data);

        // Dispatch a role-specific custom event
        if (typeof window !== 'undefined') {
          const event = new CustomEvent(`${role.toLowerCase()}-update`, { detail: data });
          window.dispatchEvent(event);
        }
      }
    },
    debug: process.env.NODE_ENV === 'development'
  });

  // Transform the generic SSE event into a dashboard-specific format
  const lastEventData = lastEvent ? {
    type: lastEvent.type,
    payload: lastEvent.payload
  } : null;

  return {
    lastEventData,
    isConnected,
    error,
    reconnect
  };
};
