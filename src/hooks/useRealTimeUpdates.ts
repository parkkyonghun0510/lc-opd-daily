'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSSE, SSEEventType } from './useSSE';
import { usePollingFallback } from './usePollingFallback';

/**
 * Options for the useRealTimeUpdates hook
 */
export interface RealTimeUpdatesOptions {
  /**
   * SSE endpoint URL
   */
  sseEndpoint?: string;

  /**
   * Polling endpoint URL (for fallback)
   */
  pollingEndpoint?: string;

  /**
   * Polling interval in milliseconds
   */
  pollingInterval?: number;

  /**
   * Event handlers for specific event types
   */
  eventHandlers?: Record<SSEEventType, (data: any) => void>;

  /**
   * Whether to enable client-side caching of events
   */
  enableCache?: boolean;

  /**
   * Whether to enable debug logging
   */
  debug?: boolean;
}

/**
 * Hook for real-time updates with SSE and polling fallback
 *
 * This hook provides real-time updates using SSE when available,
 * and falls back to polling when SSE is not supported.
 */
export function useRealTimeUpdates(options: RealTimeUpdatesOptions = {}) {
  const {
    sseEndpoint = '/api/sse',
    pollingEndpoint = '/api/polling',
    pollingInterval = 10000,
    eventHandlers = {},
    enableCache = true,
    debug = false
  } = options;

  // State to track which method is being used
  const [updateMethod, setUpdateMethod] = useState<'sse' | 'polling' | null>(null);

  // Use SSE for real-time updates
  const {
    isConnected: sseConnected,
    error: sseError,
    lastEvent: sseLastEvent,
    reconnect: sseReconnect
  } = useSSE({
    endpoint: sseEndpoint,
    eventHandlers,
    enableCache,
    debug
  });

  // Check if SSE is supported
  const isSSESupported = typeof EventSource !== 'undefined';

  // Use polling as a fallback
  const {
    lastUpdate: pollingLastUpdate,
    isPolling,
    error: pollingError,
    refresh: refreshPolling
  } = usePollingFallback({
    endpoint: pollingEndpoint,
    interval: pollingInterval,
    onUpdate: (data) => {
      // Process updates from polling
      if (data?.updates) {
        data.updates.forEach((update: any) => {
          const handler = eventHandlers[update.type];
          if (handler) {
            handler(update);
          }
        });
      }
    },
    enabled: !isSSESupported // Only enable polling if SSE is not supported
  });

  // Determine which method is being used
  useEffect(() => {
    if (isSSESupported && sseConnected) {
      setUpdateMethod('sse');
    } else if (!isSSESupported && pollingLastUpdate) {
      setUpdateMethod('polling');
    } else {
      setUpdateMethod(null);
    }
  }, [isSSESupported, sseConnected, pollingLastUpdate]);

  // Combine errors
  const error = sseError || pollingError;

  // Combine last updates
  const lastUpdate = sseLastEvent || pollingLastUpdate;

  // Refresh function
  const refresh = useCallback(() => {
    if (isSSESupported) {
      sseReconnect();
    } else {
      refreshPolling();
    }
  }, [isSSESupported, sseReconnect, refreshPolling]);

  return {
    isConnected: sseConnected || (pollingLastUpdate !== null),
    isLoading: isPolling,
    error,
    lastUpdate,
    updateMethod,
    refresh
  };
}
