'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { eventCache, CachedEvent } from '@/lib/sse/eventCache';

/**
 * Event types for SSE events
 */
export type SSEEventType = 'connected' | 'notification' | 'update' | 'ping' | string;

/**
 * Event data structure
 */
export interface SSEEvent<T = any> {
  type: SSEEventType;
  payload: T;
  timestamp?: number;
}

/**
 * Options for the useSSE hook
 */
export interface SSEOptions {
  /**
   * The SSE endpoint URL (defaults to /api/sse)
   */
  endpoint?: string;

  /**
   * Whether to automatically reconnect on connection loss
   */
  autoReconnect?: boolean;

  /**
   * Maximum number of reconnection attempts
   */
  maxReconnectAttempts?: number;

  /**
   * Event handlers for specific event types
   */
  eventHandlers?: Partial<Record<SSEEventType, (data: any) => void>>;

  /**
   * Additional client metadata to send with the connection
   */
  clientMetadata?: Record<string, string>;

  /**
   * Whether to enable debug logging
   */
  debug?: boolean;

  /**
   * Whether to enable client-side caching of events
   */
  enableCache?: boolean;
}

/**
 * Hook for Server-Sent Events (SSE) connections
 *
 * This hook manages the lifecycle of an SSE connection and provides
 * a standardized way to handle SSE events.
 *
 * @example
 * ```tsx
 * const { lastEvent, isConnected, error } = useSSE({
 *   eventHandlers: {
 *     notification: (data) => {
 *       toast({ title: data.title, description: data.body });
 *     }
 *   }
 * });
 * ```
 */
export function useSSE(options: SSEOptions = {}) {
  const {
    endpoint = '/api/sse',
    autoReconnect = true,
    maxReconnectAttempts = 5,
    eventHandlers = {},
    clientMetadata = {},
    debug = false,
    enableCache = true
  } = options;

  const { data: session, status } = useSession({
    required: false,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);

  // Refs to track connection state
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Debug logging helper
  const log = useCallback((...args: any[]) => {
    if (debug) {
      console.log('[SSE]', ...args);
    }
  }, [debug]);

  // Close the current connection
  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      log('Closing SSE connection');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsConnected(false);
  }, [log]);

  // Set up the SSE connection
  const setupConnection = useCallback(() => {
    // Close any existing connection
    closeConnection();

    // Don't connect if not authenticated
    if (status !== 'authenticated' || !session?.user?.id) {
      log('Not authenticated, skipping SSE connection');
      return;
    }

    try {
      // Build the SSE URL with authentication and metadata
      const url = new URL(endpoint, window.location.origin);

      // Add user ID if available from session
      if (session?.user?.id) {
        url.searchParams.append('userId', session.user.id);
      }

      // Add client metadata
      url.searchParams.append('clientType', 'browser');
      url.searchParams.append('clientInfo', navigator.userAgent);

      // Add any custom metadata
      Object.entries(clientMetadata).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      log(`Connecting to SSE endpoint: ${url.toString()}`);

      // Create the EventSource
      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;

      // Connection opened
      eventSource.onopen = () => {
        log('SSE connection opened');
        reconnectAttemptsRef.current = 0;
        setIsConnected(true);
        setError(null);
        lastActivityRef.current = Date.now();
      };

      // Generic message handler (for unnamed events)
      eventSource.onmessage = (event) => {
        log('Received generic SSE message:', event.data);
        try {
          const data = JSON.parse(event.data);
          lastActivityRef.current = Date.now();

          // Handle as a generic update event
          const eventType = data.type || 'message';
          const timestamp = data.timestamp || Date.now();
          const genericEvent: SSEEvent = {
            type: eventType,
            payload: data,
            timestamp
          };

          setLastEvent(genericEvent);

          // Cache the event if caching is enabled
          if (enableCache) {
            eventCache.addEvent({
              id: data.id || crypto.randomUUID(),
              type: eventType,
              data,
              timestamp
            });
          }

          // Call the appropriate event handler if defined
          if (eventHandlers[eventType]) {
            eventHandlers[eventType]!(data);
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      // Set up handlers for specific event types
      const setupEventHandler = (eventType: string) => {
        eventSource.addEventListener(eventType, (event) => {
          log(`Received '${eventType}' event:`, event.data);
          try {
            const data = JSON.parse(event.data);
            lastActivityRef.current = Date.now();

            const timestamp = data.timestamp || Date.now();
            const typedEvent: SSEEvent = {
              type: eventType,
              payload: data,
              timestamp
            };

            setLastEvent(typedEvent);

            // Cache the event if caching is enabled
            if (enableCache) {
              eventCache.addEvent({
                id: data.id || crypto.randomUUID(),
                type: eventType,
                data,
                timestamp
              });
            }

            // Call the appropriate event handler if defined
            if (eventHandlers[eventType]) {
              eventHandlers[eventType]!(data);
            }
          } catch (err) {
            console.error(`Error parsing '${eventType}' event:`, err);
          }
        });
      };

      // Set up handlers for common event types
      setupEventHandler('connected');
      setupEventHandler('notification');
      setupEventHandler('update');
      setupEventHandler('ping');

      // Set up handlers for any additional event types
      Object.keys(eventHandlers).forEach(eventType => {
        if (!['connected', 'notification', 'update', 'ping'].includes(eventType)) {
          setupEventHandler(eventType);
        }
      });

      // Error handler
      eventSource.onerror = (err) => {
        log('SSE connection error:', err);
        setIsConnected(false);
        setError('Connection error');

        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt to reconnect if enabled
        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          // Improved exponential backoff with jitter to prevent thundering herd
          const baseDelay = 1000; // Start with 1 second
          const exponentialPart = Math.pow(1.5, reconnectAttemptsRef.current); // Use 1.5 as base (gentler than 2)
          const maxDelay = 60000; // Cap at 60 seconds

          // Calculate delay with jitter (±20%)
          let delay = Math.min(baseDelay * exponentialPart, maxDelay);
          const jitter = delay * 0.2 * (Math.random() * 2 - 1); // Random value between -20% and +20%
          delay = Math.floor(delay + jitter);

          log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            setupConnection();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Maximum reconnection attempts reached');

          // After reaching max attempts, try one final reconnection after a longer delay (5 minutes)
          reconnectTimeoutRef.current = setTimeout(() => {
            log('Attempting final reconnection after cooling period');
            reconnectAttemptsRef.current = 0;
            setupConnection();
          }, 5 * 60 * 1000);
        }
      };
    } catch (err) {
      console.error('Error setting up SSE connection:', err);
      setError('Failed to establish connection');
    }
  }, [
    closeConnection,
    endpoint,
    autoReconnect,
    maxReconnectAttempts,
    status,
    session,
    eventHandlers,
    clientMetadata,
    log
  ]);

  // Initialize event cache
  useEffect(() => {
    if (enableCache) {
      eventCache.initialize();

      // Load cached events for each event type
      Object.keys(eventHandlers).forEach(eventType => {
        const cachedEvent = eventCache.getLatestEvent(eventType);
        if (cachedEvent) {
          log(`Loaded cached event for ${eventType}:`, cachedEvent);

          // Set as last event
          setLastEvent({
            type: cachedEvent.type,
            payload: cachedEvent.data,
            timestamp: cachedEvent.timestamp
          });

          // Call the event handler if defined
          if (eventHandlers[eventType]) {
            eventHandlers[eventType]!(cachedEvent.data);
          }
        }
      });
    }
  }, [enableCache, eventHandlers, log]);

  // Set up the connection when the component mounts or session changes
  useEffect(() => {
    setupConnection();

    // Clean up on unmount
    return () => {
      closeConnection();
    };
  }, [setupConnection, closeConnection]);

  // Manually reconnect
  const reconnect = useCallback(() => {
    log('Manually reconnecting...');
    reconnectAttemptsRef.current = 0;
    setupConnection();
  }, [setupConnection, log]);

  return {
    isConnected,
    error,
    lastEvent,
    reconnect,
    closeConnection
  };
}

export default useSSE;
