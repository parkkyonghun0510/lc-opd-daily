'use client';

import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useEventSource } from './useEventSource';
import { getSSEToken, refreshSSETokenIfNeeded } from '@/lib/sse/sseAuth';

// Define types for the hybrid hook
export type ConnectionMethod = 'sse' | 'polling' | 'auto';
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'error';
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
  enableTokenAuth?: boolean;
  retryOnError?: boolean;
  healthCheckInterval?: number;
}

/**
 * Enhanced Hybrid real-time hook with improved error handling and token authentication
 *
 * This hook provides a robust real-time connection with automatic failover from SSE to polling,
 * enhanced error handling, token-based authentication, and comprehensive connection management.
 */
export function useHybridRealtimeV2(options: HybridRealtimeOptions = {}) {
  // Get auth state
  const { user, isAuthenticated } = useAuth();

  // Get dashboard store actions
  const { setConnectionStatus, setConnectionError } = useDashboardStore();

  // Connection state
  const [activeMethod, setActiveMethod] = useState<ConnectionMethod>('auto');
  const [connectionStatus, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sseFailureCount, setSseFailureCount] = useState(0);
  const [pollingFailureCount, setPollingFailureCount] = useState(0);

  // Token management
  const [sseToken, setSseToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number>(0);

  // Refs for cleanup and control
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPollTimeRef = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef<boolean>(true);

  // Default options
  const defaultOptions: Required<HybridRealtimeOptions> = {
    sseEndpoint: '/api/realtime/sse',
    pollingEndpoint: '/api/realtime/polling',
    pollingInterval: 10000,
    eventHandlers: {},
    clientMetadata: {},
    debug: false,
    forcePolling: false,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    enableTokenAuth: true,
    retryOnError: true,
    healthCheckInterval: 30000
  };

  // Merge options with defaults
  const config = useMemo(() => ({
    ...defaultOptions,
    ...options,
    clientMetadata: {
      ...defaultOptions.clientMetadata,
      ...(options.clientMetadata || {}),
      userId: user?.id,
      role: user?.role || 'user'
    }
  }), [options, user?.id, user?.role]);

  // Debug logging
  const log = useCallback((message: string, ...args: unknown[]) => {
    if (config.debug) {
      console.log(`[HybridRealtimeV2] ${message}`, ...args);
    }
  }, [config.debug]);

  // Error handling
  const handleError = useCallback((error: Error | string, context: string) => {
    const errorMessage = typeof error === 'string' ? error : error.message;
    log(`Error in ${context}:`, errorMessage);
    
    setError(errorMessage);
    setConnectionError(`${context}: ${errorMessage}`);
    
    if (config.retryOnError && mountedRef.current) {
      scheduleRetry();
    }
  }, [log, setConnectionError, config.retryOnError]);

  // Schedule retry with exponential backoff
  const scheduleRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    const totalFailures = sseFailureCount + pollingFailureCount;
    if (totalFailures >= config.maxReconnectAttempts) {
      log('Max reconnect attempts reached, giving up');
      setStatus('error');
      return;
    }

    const delay = Math.min(config.reconnectDelay * Math.pow(2, totalFailures), 30000);
    log(`Scheduling retry in ${delay}ms (attempt ${totalFailures + 1}/${config.maxReconnectAttempts})`);

    retryTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        reconnect();
      }
    }, delay);
  }, [sseFailureCount, pollingFailureCount, config.maxReconnectAttempts, config.reconnectDelay, log]);

  // Token management
  const refreshToken = useCallback(async () => {
    if (!config.enableTokenAuth) return null;

    try {
      const tokenData = await refreshSSETokenIfNeeded(sseToken, tokenExpiresAt);
      if (tokenData) {
        setSseToken(tokenData.token);
        setTokenExpiresAt(tokenData.expiresAt);
        log('SSE token refreshed');
        return tokenData.token;
      }
      return sseToken;
    } catch (error) {
      handleError(error as Error, 'Token refresh');
      return null;
    }
  }, [config.enableTokenAuth, sseToken, tokenExpiresAt, log, handleError]);

  // Get initial token
  useEffect(() => {
    if (config.enableTokenAuth && isAuthenticated && !sseToken) {
      getSSEToken().then(tokenData => {
        if (tokenData && mountedRef.current) {
          setSseToken(tokenData.token);
          setTokenExpiresAt(tokenData.expiresAt);
          log('Initial SSE token obtained');
        }
      }).catch(error => {
        handleError(error, 'Initial token fetch');
      });
    }
  }, [config.enableTokenAuth, isAuthenticated, sseToken, log, handleError]);

  // Determine connection method
  const shouldUseSSE = useMemo(() => {
    if (config.forcePolling) return false;
    if (sseFailureCount >= config.maxReconnectAttempts) return false;
    if (!isAuthenticated || !user?.id) return false;
    if (config.enableTokenAuth && !sseToken) return false;
    return typeof EventSource !== 'undefined';
  }, [config.forcePolling, config.maxReconnectAttempts, config.enableTokenAuth, 
      sseFailureCount, isAuthenticated, user?.id, sseToken]);

  // Event processing
  const processEvent = useCallback((event: any, source: 'sse' | 'polling') => {
    if (!mountedRef.current) return;

    const realtimeEvent: RealtimeEvent = {
      id: event.id || crypto.randomUUID(),
      type: event.type,
      data: event.data,
      timestamp: event.timestamp || Date.now()
    };

    log(`Received event from ${source}:`, realtimeEvent.type);
    setLastEvent(realtimeEvent);

    // Call event handlers
    try {
      const handler = config.eventHandlers[event.type];
      if (typeof handler === 'function') {
        handler(event.data);
      }

      const wildcardHandler = config.eventHandlers['*'];
      if (typeof wildcardHandler === 'function') {
        wildcardHandler(realtimeEvent);
      }

      // Dispatch DOM events
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(`realtime-${event.type}`, {
          detail: realtimeEvent,
          bubbles: true,
          cancelable: true
        }));
      }
    } catch (error) {
      handleError(error as Error, 'Event processing');
    }
  }, [config.eventHandlers, log, handleError]);

  // SSE connection using useEventSource
  const sseConnection = useEventSource({
    enabled: shouldUseSSE && connectionStatus !== 'error',
    maxReconnectAttempts: config.maxReconnectAttempts,
    reconnectInterval: config.reconnectDelay,
    endpoint: config.sseEndpoint + (sseToken ? `?token=${sseToken}` : ''),
    onEvent: useCallback((event: any) => {
      processEvent(event, 'sse');
      setSseFailureCount(0); // Reset failure count on successful event
    }, [processEvent]),
    onError: useCallback((error: Event) => {
      setSseFailureCount(prev => prev + 1);
      handleError('SSE connection error', 'SSE');
    }, [handleError]),
    onConnect: useCallback(() => {
      log('SSE connected');
      setStatus('connected');
      setActiveMethod('sse');
      setError(null);
      setSseFailureCount(0);
      setConnectionStatus(true, 'sse');
    }, [log, setConnectionStatus])
  });

  // Polling implementation
  const pollForUpdates = useCallback(async () => {
    if (!isAuthenticated || !user?.id || !mountedRef.current) return;

    try {
      const url = new URL(config.pollingEndpoint, window.location.origin);
      url.searchParams.append('since', lastPollTimeRef.current.toString());
      url.searchParams.append('userId', user.id);
      url.searchParams.append('_t', Date.now().toString());

      const response = await fetch(url.toString(), {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      lastPollTimeRef.current = data.timestamp || Date.now();

      if (data.events && Array.isArray(data.events)) {
        data.events.forEach((event: any) => {
          processEvent(event, 'polling');
        });
      }

      // Reset failure count on success
      setPollingFailureCount(0);
      setError(null);
      setConnectionStatus(true, 'polling');

    } catch (error) {
      setPollingFailureCount(prev => prev + 1);
      handleError(error as Error, 'Polling');
    }
  }, [isAuthenticated, user?.id, config.pollingEndpoint, processEvent, handleError, setConnectionStatus]);

  // Manage polling interval
  useEffect(() => {
    if (!shouldUseSSE && isAuthenticated && connectionStatus !== 'error') {
      setActiveMethod('polling');
      setStatus('connected');

      // Start polling
      if (!pollingIntervalRef.current) {
        pollForUpdates(); // Initial poll
        pollingIntervalRef.current = setInterval(pollForUpdates, config.pollingInterval);
        log(`Started polling every ${config.pollingInterval}ms`);
      }
    } else {
      // Stop polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
        log('Stopped polling');
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [shouldUseSSE, isAuthenticated, connectionStatus, config.pollingInterval, pollForUpdates, log]);

  // Health check
  useEffect(() => {
    if (config.healthCheckInterval > 0) {
      healthCheckIntervalRef.current = setInterval(async () => {
        if (config.enableTokenAuth) {
          await refreshToken();
        }
      }, config.healthCheckInterval);

      return () => {
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
        }
      };
    }
  }, [config.healthCheckInterval, config.enableTokenAuth, refreshToken]);

  // Connection status management
  useEffect(() => {
    if (shouldUseSSE) {
      if (sseConnection.isConnected) {
        setStatus('connected');
        setActiveMethod('sse');
      } else {
        setStatus('connecting');
      }
    } else if (activeMethod === 'polling') {
      setStatus('connected');
    }
  }, [shouldUseSSE, sseConnection.isConnected, activeMethod]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    log('Manual reconnect requested');
    
    // Clear retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Reset failure counts
    setSseFailureCount(0);
    setPollingFailureCount(0);
    setError(null);
    setStatus('connecting');

    // Refresh token if needed
    if (config.enableTokenAuth) {
      refreshToken();
    }

    // Reconnect SSE
    if (shouldUseSSE) {
      sseConnection.reconnect();
    } else {
      // Restart polling
      lastPollTimeRef.current = 0;
      pollForUpdates();
    }
  }, [log, config.enableTokenAuth, refreshToken, shouldUseSSE, sseConnection, pollForUpdates]);

  // Disconnect
  const disconnect = useCallback(() => {
    log('Disconnecting');
    
    sseConnection.disconnect();
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setStatus('disconnected');
    setConnectionStatus(false, null);
  }, [log, sseConnection, setConnectionStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  // Determine overall connection status
  const isConnected = connectionStatus === 'connected';

  return {
    // Status
    isConnected,
    connectionStatus,
    activeMethod: activeMethod === 'auto' ? (shouldUseSSE ? 'sse' : 'polling') : activeMethod,
    lastEvent,
    error,
    
    // Statistics
    sseFailureCount,
    pollingFailureCount,
    hasToken: !!sseToken,
    tokenExpiresAt,
    
    // Actions
    reconnect,
    disconnect,
    forceSSE: () => {
      log('Forcing SSE');
      setActiveMethod('sse');
      setSseFailureCount(0);
    },
    forcePolling: () => {
      log('Forcing polling');
      setActiveMethod('polling');
      sseConnection.disconnect();
    },
    
    // Utilities
    refreshToken,
    getTimeSinceLastEvent: () => lastEvent ? Date.now() - lastEvent.timestamp : Infinity
  };
}

// Export the original hook name for backward compatibility
export const useHybridRealtime = useHybridRealtimeV2;