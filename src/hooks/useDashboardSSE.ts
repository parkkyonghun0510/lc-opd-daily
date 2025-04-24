'use client';

import { useSSE } from './useSSE';

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
  // Use the standardized SSE hook with dashboard-specific configuration
  const {
    lastEvent,
    isConnected,
    error,
    reconnect
  } = useSSE({
    endpoint: '/api/dashboard/sse',
    clientMetadata: {
      type: 'dashboard'
    },
    eventHandlers: {
      // You can add specific handlers for dashboard events here
    }
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
