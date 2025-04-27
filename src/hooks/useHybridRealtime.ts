'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';

// Event types
export type EventType = 'notification' | 'dashboardUpdate' | 'systemAlert' | string;

// Event data structure
export interface RealtimeEvent {
  id: string;
  type: EventType;
  data: any;
  timestamp: number;
}

// Hook options
export interface HybridRealtimeOptions {
  // Endpoints
  sseEndpoint?: string;
  pollingEndpoint?: string;

  // Configuration
  pollingInterval?: number;
  preferredMethod?: 'sse' | 'polling' | 'auto';

  // Event handlers
  eventHandlers?: Record<EventType, (data: any) => void>;

  // Debug options
  debug?: boolean;
}

/**
 * Hook for hybrid real-time updates using SSE with polling fallback
 */
export function useHybridRealtime(options: HybridRealtimeOptions = {}) {
  const {
    sseEndpoint = '/api/realtime/sse',
    pollingEndpoint = '/api/realtime/polling',
    pollingInterval = 10000,
    preferredMethod = 'auto',
    eventHandlers = {},
    debug = false
  } = options;

  // Use the new auth hook instead of useSession
  const { user, isAuthenticated, needsTokenRefresh, refreshAuthToken } = useAuth();

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [activeMethod, setActiveMethod] = useState<'sse' | 'polling' | null>(null);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPollTimestampRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 5;

  // Check if SSE is supported
  const isSSESupported = typeof EventSource !== 'undefined';

  // Debug logging
  const log = useCallback((message: string, ...args: any[]) => {
    if (debug) {
      console.log(`[HybridRealtime] ${message}`, ...args);
    }
  }, [debug]);

  // Process an event
  const processEvent = useCallback((event: RealtimeEvent) => {
    log('Processing event:', event);

    // Update last event
    setLastEvent(event);

    // Call the appropriate event handler
    const handler = eventHandlers[event.type];
    if (handler) {
      handler(event.data);
    }

    // Also call the wildcard handler if it exists
    const wildcardHandler = eventHandlers['*'];
    if (wildcardHandler) {
      wildcardHandler(event);
    }
  }, [eventHandlers, log]);

  // Set up SSE connection
  const setupSSE = useCallback(() => {
    if (!isSSESupported) {
      log('SSE not supported, falling back to polling');
      return false;
    }

    if (!user?.id) {
      log('No authenticated user, cannot set up SSE');
      return false;
    }

    // Check if token needs refresh before setting up connection
    if (isAuthenticated && needsTokenRefresh()) {
      log('Auth token needs refresh, refreshing before SSE setup');
      refreshAuthToken().catch(err => {
        log('Error refreshing token:', err);
      });
    }

    try {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Create URL with query parameters
      const url = new URL(sseEndpoint, window.location.origin);
      url.searchParams.append('clientType', 'hybrid');
      url.searchParams.append('userId', user.id);
      url.searchParams.append('role', user.role || 'user');
      url.searchParams.append('_t', Date.now().toString()); // Cache buster

      // Create new EventSource
      log('Setting up SSE connection to', url.toString());
      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;

      // Set up event listeners
      eventSource.onopen = () => {
        log('SSE connection opened');
        setIsConnected(true);
        setActiveMethod('sse');
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onerror = (err) => {
        log('SSE connection error:', err);
        eventSource.close();
        eventSourceRef.current = null;
        setIsConnected(false);
        setError('SSE connection error');

        // Try to reconnect
        reconnectAttemptsRef.current++;
        if (reconnectAttemptsRef.current <= maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
          log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            if (preferredMethod === 'sse' || preferredMethod === 'auto') {
              setupSSE();
            }
          }, delay);
        } else {
          log('Maximum reconnection attempts reached, falling back to polling');
          setActiveMethod('polling');
          startPolling();
        }
      };

      // Listen for specific events
      eventSource.addEventListener('connected', (e) => {
        try {
          const data = JSON.parse(e.data);
          log('Connected event:', data);
          setIsConnected(true);
          setActiveMethod('sse');
          setError(null);
        } catch (err) {
          log('Error parsing connected event:', err);
        }
      });

      // Generic event listener for all event types
      const handleEvent = (e: MessageEvent) => {
        try {
          const eventType = e.type;
          const data = JSON.parse(e.data);

          const event: RealtimeEvent = {
            id: data.id || crypto.randomUUID(),
            type: eventType,
            data,
            timestamp: data.timestamp || Date.now()
          };

          processEvent(event);
        } catch (err) {
          log('Error processing event:', err);
        }
      };

      // Add listeners for common event types
      eventSource.addEventListener('notification', handleEvent);
      eventSource.addEventListener('dashboardUpdate', handleEvent);
      eventSource.addEventListener('systemAlert', handleEvent);

      // Add listeners for custom event types
      Object.keys(eventHandlers).forEach(eventType => {
        if (!['connected', 'notification', 'dashboardUpdate', 'systemAlert', '*'].includes(eventType)) {
          eventSource.addEventListener(eventType, handleEvent);
        }
      });

      return true;
    } catch (err) {
      log('Error setting up SSE:', err);
      setError(err instanceof Error ? err.message : 'Unknown error setting up SSE');
      return false;
    }
  }, [isSSESupported, user, isAuthenticated, needsTokenRefresh, refreshAuthToken, sseEndpoint, log, preferredMethod, processEvent, eventHandlers]);

  // Polling function
  const pollForUpdates = useCallback(async () => {
    if (!user?.id) {
      log('No authenticated user, cannot poll for updates');
      return;
    }

    // Check if token needs refresh before polling
    if (isAuthenticated && needsTokenRefresh()) {
      log('Auth token needs refresh, refreshing before polling');
      await refreshAuthToken().catch(err => {
        log('Error refreshing token:', err);
      });
    }

    try {
      // Create URL with query parameters
      const url = new URL(pollingEndpoint, window.location.origin);
      url.searchParams.append('since', lastPollTimestampRef.current.toString());
      url.searchParams.append('_t', Date.now().toString()); // Cache buster

      log('Polling for updates:', url.toString());

      // Fetch updates
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Polling error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      log('Polling response:', data);

      // Update last poll timestamp
      lastPollTimestampRef.current = data.timestamp;

      // Process events
      if (data.events && Array.isArray(data.events)) {
        data.events.forEach((event: any) => {
          processEvent({
            id: event.id,
            type: event.type,
            data: event.data,
            timestamp: event.timestamp
          });
        });
      }

      // Update connection state
      setIsConnected(true);
      setActiveMethod('polling');
      setError(null);
    } catch (err) {
      log('Polling error:', err);
      setError(err instanceof Error ? err.message : 'Unknown polling error');
    }
  }, [user, isAuthenticated, needsTokenRefresh, refreshAuthToken, pollingEndpoint, log, processEvent]);

  // Start polling
  const startPolling = useCallback(() => {
    // Clear existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Initial poll
    pollForUpdates();

    // Set up interval
    pollingIntervalRef.current = setInterval(pollForUpdates, pollingInterval);
    log(`Started polling every ${pollingInterval}ms`);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [pollForUpdates, pollingInterval, log]);

  // Initialize connection based on preferred method
  useEffect(() => {
    if (!user?.id) return;

    log(`Initializing with preferred method: ${preferredMethod} for user ${user.id}`);

    if (preferredMethod === 'sse' && isSSESupported) {
      setupSSE();
    } else if (preferredMethod === 'polling') {
      startPolling();
    } else if (preferredMethod === 'auto') {
      // Try SSE first, fall back to polling if not supported
      if (isSSESupported) {
        const success = setupSSE();
        if (!success) {
          startPolling();
        }
      } else {
        startPolling();
      }
    }

    // Cleanup function
    return () => {
      // Close SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Clear polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [user, preferredMethod, isSSESupported, setupSSE, startPolling, log]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    log('Manual reconnect requested');

    // Reset reconnect attempts
    reconnectAttemptsRef.current = 0;

    // Close existing connections
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Try to reconnect based on preferred method
    if (preferredMethod === 'sse' && isSSESupported) {
      setupSSE();
    } else if (preferredMethod === 'polling') {
      startPolling();
    } else if (preferredMethod === 'auto') {
      if (isSSESupported) {
        const success = setupSSE();
        if (!success) {
          startPolling();
        }
      } else {
        startPolling();
      }
    }
  }, [preferredMethod, isSSESupported, setupSSE, startPolling, log]);

  // Return the hook API
  return {
    isConnected,
    activeMethod,
    lastEvent,
    error,
    reconnect
  };
}
