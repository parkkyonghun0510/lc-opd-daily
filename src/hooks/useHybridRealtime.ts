'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useDashboardStore } from '@/stores/dashboardStore';

// Define simplified types for the hook
export type ConnectionMethod = 'polling';
export type ConnectionStatus = 'connected' | 'disconnected';
export type EventType = string;
export type EventHandler = (data: any) => void;
export type EventHandlersMap = Record<string, EventHandler>;

export interface RealtimeEvent {
  id: string;
  type: EventType;
  data: any;
  timestamp: number;
}

export interface HybridRealtimeOptions {
  pollingEndpoint?: string;
  pollingInterval?: number;
  eventHandlers?: EventHandlersMap;
  clientMetadata?: Record<string, string>;
  debug?: boolean;
}

/**
 * Simplified hook for real-time updates using polling
 *
 * This version replaces the hybrid SSE/polling approach with a simpler polling-only approach
 * to avoid conflicts with Zustand state management.
 *
 * @example
 * ```tsx
 * const {
 *   isConnected,
 *   activeMethod,
 *   lastEvent,
 *   error,
 *   reconnect
 * } = useHybridRealtime({
 *   eventHandlers: {
 *     notification: (data) => {
 *       toast.info(data.title, { description: data.message });
 *     }
 *   },
 *   debug: true
 * });
 * ```
 */
export function useHybridRealtime(options: HybridRealtimeOptions = {}) {
  // Get auth state
  const { user, isAuthenticated } = useAuth();

  // Get dashboard store actions
  const { setConnectionStatus, setConnectionError } = useDashboardStore();

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastPollTime, setLastPollTime] = useState(0);

  // Default options
  const defaultOptions = {
    pollingEndpoint: '/api/realtime/polling',
    pollingInterval: 10000, // 10 seconds
    eventHandlers: {},
    clientMetadata: {},
    debug: false
  };

  // Merge options with defaults
  const mergedOptions = useMemo(() => ({
    ...defaultOptions,
    ...options,
    clientMetadata: {
      ...defaultOptions.clientMetadata,
      ...(options.clientMetadata || {}),
      userId: user?.id,
      role: user?.role || 'user'
    }
  }), [
    options.pollingEndpoint,
    options.pollingInterval,
    options.debug,
    // Deep compare event handlers by stringifying them
    JSON.stringify(Object.keys(options.eventHandlers || {})),
    user?.id,
    user?.role
  ]);

  // Debug logging
  const log = useCallback((message: string, ...args: any[]) => {
    if (mergedOptions.debug) {
      console.log(`[SimpleRealtime] ${message}`, ...args);
    }
  }, [mergedOptions.debug]);

  // Poll for updates
  const pollForUpdates = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;

    try {
      // Create URL with query parameters
      const url = new URL(mergedOptions.pollingEndpoint || '/api/realtime/polling', window.location.origin);
      url.searchParams.append('since', lastPollTime.toString());
      url.searchParams.append('userId', user.id);
      url.searchParams.append('role', user.role || 'USER');
      url.searchParams.append('_t', Date.now().toString()); // Cache buster

      log('Polling for updates:', url.toString());

      // Fetch updates
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Polling error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      log('Polling response:', data);

      // Update last poll time
      setLastPollTime(data.timestamp || Date.now());

      // Process events
      if (data.events && Array.isArray(data.events)) {
        data.events.forEach((event: any) => {
          const realtimeEvent: RealtimeEvent = {
            id: event.id || crypto.randomUUID(),
            type: event.type,
            data: event.data,
            timestamp: event.timestamp || Date.now()
          };

          // Set last event
          setLastEvent(realtimeEvent);

          // Call event handlers
          const eventHandlers = mergedOptions.eventHandlers || {};

          // Call specific handler if exists
          if (event.type && typeof event.type === 'string' && event.type in eventHandlers) {
            (eventHandlers as any)[event.type](event.data);
          }

          // Call wildcard handler if exists
          if ('*' in eventHandlers) {
            (eventHandlers as any)['*'](realtimeEvent);
          }
        });
      }

      // Update connection state
      setIsConnected(true);
      setError(null);

      // Update dashboard store
      setConnectionStatus(true, 'polling');
      setConnectionError(null);
    } catch (err) {
      log('Polling error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown polling error';
      setError(errorMessage);
      setIsConnected(false);

      // Update dashboard store
      setConnectionStatus(false, null);
      setConnectionError(errorMessage);
    }
  }, [isAuthenticated, user, lastPollTime, mergedOptions, log, setConnectionStatus, setConnectionError]);

  // This function was removed to avoid circular dependencies
  // The functionality is now directly in the useEffect hook

  // This function was removed to avoid circular dependencies
  // The functionality is now directly in the disconnect method

  // Reconnect function
  const reconnect = useCallback(() => {
    log('Manual reconnect requested');

    // Clear existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    // Reset state
    setLastPollTime(0);

    // Trigger a new poll immediately
    pollForUpdates();

    // Set up a new interval
    const interval = setInterval(() => {
      pollForUpdates();
    }, mergedOptions.pollingInterval || 10000);

    setPollingInterval(interval);
    log(`Reconnected: polling every ${mergedOptions.pollingInterval}ms`);
  }, [pollingInterval, mergedOptions.pollingInterval, pollForUpdates, log]);

  // Initialize polling when component mounts or options change
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      log('Not authenticated, skipping polling setup');
      return;
    }

    log('Setting up polling with options:', mergedOptions);

    // Stop any existing polling
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    // Initial poll
    pollForUpdates();

    // Set up interval for regular polling
    const interval = setInterval(() => {
      pollForUpdates();
    }, mergedOptions.pollingInterval || 10000);

    setPollingInterval(interval);
    log(`Started polling every ${mergedOptions.pollingInterval}ms`);

    // Cleanup function - use a ref to the current interval
    const currentInterval = pollingInterval;
    return () => {
      if (currentInterval) {
        clearInterval(currentInterval);
        log('Stopped polling on cleanup');
      }
    };
  }, [
    isAuthenticated,
    user?.id,
    mergedOptions.pollingInterval,
    mergedOptions.pollingEndpoint,
    pollForUpdates,
    log
  ]);

  // Return the hook API
  return {
    // Basic state
    isConnected,
    activeMethod: 'polling' as ConnectionMethod,
    lastEvent,
    error,
    connectionStatus: isConnected ? 'connected' as ConnectionStatus : 'disconnected' as ConnectionStatus,

    // Actions
    reconnect,
    disconnect: () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
        setIsConnected(false);
        setConnectionStatus(false, null);
        log('Disconnected');
      }
    },

    // Dummy selectors for compatibility
    getCachedEvents: () => [] as RealtimeEvent[],
    getTimeSinceLastEvent: () => lastEvent ? Date.now() - lastEvent.timestamp : Infinity,

    // Helpers
    isSSESupported: () => false
  };
}
