'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useEventSource } from './useEventSource';

// Define types for the hybrid hook
export type ConnectionMethod = 'sse' | 'polling';
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting';
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
  sseEndpoint?: string;
  pollingEndpoint?: string;
  pollingInterval?: number;
  eventHandlers?: EventHandlersMap;
  clientMetadata?: Record<string, string>;
  debug?: boolean;
  forcePolling?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

/**
 * Hybrid real-time hook that uses SSE as primary method with polling fallback
 *
 * This hook automatically switches between Server-Sent Events and polling based on
 * connection reliability and browser support.
 *
 * @example
 * ```tsx
 * const {
 *   isConnected,
 *   activeMethod,
 *   lastEvent,
 *   error,
 *   reconnect,
 *   forceSSE,
 *   forcePolling
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
  const [activeMethod, setActiveMethod] = useState<ConnectionMethod>('sse');
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastPollTime, setLastPollTime] = useState(0);
  const [sseFailureCount, setSseFailureCount] = useState(0);
  const [forcedMethod, setForcedMethod] = useState<ConnectionMethod | null>(null);

  // Default options
  const defaultOptions = {
    sseEndpoint: '/api/realtime/sse',
    pollingEndpoint: '/api/realtime/polling',
    pollingInterval: 10000, // 10 seconds
    eventHandlers: {},
    clientMetadata: {},
    debug: false,
    forcePolling: false,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000
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
    options.sseEndpoint,
    options.pollingEndpoint,
    options.pollingInterval,
    options.forcePolling,
    options.maxReconnectAttempts,
    options.reconnectDelay,
    options.debug,
    // Deep compare event handlers by stringifying them - only compare keys to avoid circular references
    JSON.stringify(Object.keys(options.eventHandlers || {})),
    user?.id,
    user?.role
  ]);

  // Debug logging
  const log = useCallback((message: string, ...args: unknown[]) => {
    if (mergedOptions.debug) {
      console.log(`[HybridRealtime] ${message}`, ...args);
    }
  }, [mergedOptions.debug]);

  // Determine if we should use SSE or polling
  const shouldUseSSE = useMemo(() => {
    if (forcedMethod) return forcedMethod === 'sse';
    if (mergedOptions.forcePolling) return false;
    if (sseFailureCount >= (mergedOptions.maxReconnectAttempts || 5)) return false;
    return typeof EventSource !== 'undefined';
  }, [forcedMethod, mergedOptions.forcePolling, mergedOptions.maxReconnectAttempts, sseFailureCount]);

  // SSE connection using our useEventSource hook
  const sseConnection = useEventSource({
    enabled: shouldUseSSE && isAuthenticated && !!user?.id,
    maxReconnectAttempts: mergedOptions.maxReconnectAttempts || 5,
    reconnectInterval: mergedOptions.reconnectDelay || 1000,
    onEvent: useCallback((event: any) => {
      const realtimeEvent: RealtimeEvent = {
        id: crypto.randomUUID(),
        type: event.type,
        data: event.data,
        timestamp: Date.now()
      };
      
      setLastEvent(realtimeEvent);
      
      // Call event handlers
      const eventHandlers = mergedOptions.eventHandlers || {};
      if (event.type && event.type in eventHandlers) {
        const handler = eventHandlers[event.type];
        if (typeof handler === 'function') {
          handler(event.data);
        }
      }
      if ('*' in eventHandlers) {
        const wildcardHandler = eventHandlers['*'];
        if (typeof wildcardHandler === 'function') {
          wildcardHandler(realtimeEvent);
        }
      }
      
      // Dispatch DOM events
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(`realtime-${event.type}`, {
          detail: realtimeEvent,
          bubbles: true,
          cancelable: true
        }));
        window.dispatchEvent(new CustomEvent('realtime-event', {
          detail: realtimeEvent,
          bubbles: true,
          cancelable: true
        }));
      }
    }, [mergedOptions.eventHandlers]),
    onError: useCallback((error: Event) => {
      const errorMessage = 'SSE connection error';
      log('SSE error:', error);
      setSseFailureCount(prev => prev + 1);
      setError(errorMessage);
      setConnectionError(errorMessage);
    }, [log, setConnectionError]),
    onConnect: useCallback(() => {
      log('SSE connected');
      setSseFailureCount(0);
      setError(null);
      setConnectionError(null);
    }, [log, setConnectionError])
  });

  // Update active method based on SSE status
  useEffect(() => {
    if (shouldUseSSE && sseConnection.isConnected) {
      setActiveMethod('sse');
      setConnectionStatus(true, 'sse');
    } else if (!shouldUseSSE || !sseConnection.isConnected) {
      setActiveMethod('polling');
    }
  }, [shouldUseSSE, sseConnection.isConnected, setConnectionStatus]);

  // Determine overall connection status
  const isConnected = (activeMethod === 'sse' && sseConnection.isConnected) || (activeMethod === 'polling' && pollingInterval !== null);

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

      // log('Polling for updates:', url.toString());

      // Fetch updates
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Polling error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // log('Polling response:', data);

      // Update last poll time
      setLastPollTime(data.timestamp || Date.now());

      // Process events
      if (data.events && Array.isArray(data.events) && data.events.length > 0) {
        // Batch state updates by collecting all events first
        const eventsToProcess = data.events.map((event: unknown) => {
          // Ensure the event has a proper structure
          const typedEvent = event as { id?: string; type: string; data?: any; timestamp?: number };
          return {
            id: typedEvent.id || crypto.randomUUID(),
            type: typedEvent.type,
            data: {
              ...typedEvent.data,
              id: typedEvent.data?.id || typedEvent.id || crypto.randomUUID(),
              timestamp: typedEvent.data?.timestamp || typedEvent.timestamp || Date.now(),
              type: typedEvent.data?.type || typedEvent.type
            },
            timestamp: typedEvent.timestamp || Date.now()
          } as RealtimeEvent;
        });

        // Set the last event only once with the most recent event
        if (eventsToProcess.length > 0) {
          setLastEvent(eventsToProcess[eventsToProcess.length - 1]);
        }

        // Process each event
        eventsToProcess.forEach((realtimeEvent: RealtimeEvent) => {
          // Call event handlers
          const eventHandlers = mergedOptions.eventHandlers || {};

          // Call specific handler if exists
          if (realtimeEvent.type && typeof realtimeEvent.type === 'string') {
            const handler = eventHandlers[realtimeEvent.type];
            if (typeof handler === 'function') {
              handler(realtimeEvent.data);
            }
          }

          // Call wildcard handler if exists
          const wildcardHandler = eventHandlers['*'];
          if (typeof wildcardHandler === 'function') {
            wildcardHandler(realtimeEvent);
          }

          // Dispatch a DOM event for components to listen for
          if (typeof window !== 'undefined') {
            const domEvent = new CustomEvent(`realtime-${realtimeEvent.type}`, {
              detail: realtimeEvent,
              bubbles: true,
              cancelable: true
            });
            window.dispatchEvent(domEvent);

            // Also dispatch a generic event that all components can listen for
            const genericEvent = new CustomEvent('realtime-event', {
              detail: realtimeEvent,
              bubbles: true,
              cancelable: true
            });
            window.dispatchEvent(genericEvent);
          }
        });
      }

      // Update connection state in a single batch
        setError(null);

        // Update dashboard store
        setConnectionStatus(true, 'polling');
        setConnectionError(null);
    } catch (err) {
      log('Polling error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown polling error';

      // Update state in a single batch
      setError(errorMessage);

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

    // log('Setting up polling with options:', mergedOptions);

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

    // Cleanup function - use a local variable to avoid dependency on state
    return () => {
      if (interval) {
        clearInterval(interval);
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

  // Force connection methods
    const forceSSE = useCallback(() => {
      log('Forcing SSE connection');
      setForcedMethod('sse');
      setSseFailureCount(0);
    }, [log]);

    const forcePolling = useCallback(() => {
      log('Forcing polling connection');
      setForcedMethod('polling');
      sseConnection.disconnect();
    }, [log, sseConnection]);

    // Return the hook API
    return {
      // Basic state
      isConnected,
      activeMethod,
      lastEvent,
      error,
      connectionStatus: isConnected ? 'connected' as ConnectionStatus : 'disconnected' as ConnectionStatus,

      // Actions
      reconnect,
      forceSSE,
      forcePolling,
      disconnect: () => {
        sseConnection.disconnect();
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
          setConnectionStatus(false, null);
          log('Disconnected');
        }
      },

    // Selectors
    getCachedEvents: (eventType?: string) => {
      // If no event type is provided, return an empty array
      if (!eventType) return [] as RealtimeEvent[];

      // Try to get cached events from localStorage
      try {
        if (typeof window !== 'undefined') {
          const cacheKey = `hybrid-realtime-cache-${eventType}`;
          const cachedData = localStorage.getItem(cacheKey);

          if (cachedData) {
            const events = JSON.parse(cachedData);
            if (Array.isArray(events)) {
              return events as RealtimeEvent[];
            }
          }
        }
      } catch (err) {
        log('Error getting cached events:', err);
      }

      return [] as RealtimeEvent[];
    },
    getTimeSinceLastEvent: () => lastEvent ? Date.now() - lastEvent.timestamp : Infinity,

    // Helpers
    isSSESupported: () => false
  };
}
