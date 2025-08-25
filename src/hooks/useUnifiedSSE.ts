'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

// Unified SSE Event Interface
export interface SSEEvent {
  type: string;
  data: any;
  timestamp?: string;
  id?: string;
}

// Connection Methods
export type ConnectionMethod = 'sse' | 'polling' | 'disabled';
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// Unified SSE Options
export interface UnifiedSSEOptions {
  // Connection settings
  enabled?: boolean;
  endpoint?: string;
  clientType?: string;
  role?: string;
  
  // Reconnection settings
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  exponentialBackoff?: boolean;
  maxBackoffDelay?: number;
  
  // Polling fallback settings
  enablePollingFallback?: boolean;
  pollingInterval?: number;
  pollingEndpoint?: string;
  
  // Event handling
  eventHandlers?: Record<string, (data: any) => void>;
  onEvent?: (event: SSEEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event | Error) => void;
  onStatusChange?: (status: ConnectionStatus, method: ConnectionMethod) => void;
  
  // UI integration
  showToastNotifications?: boolean;
  autoReconnect?: boolean;
  
  // Debug settings
  debug?: boolean;
}

// Return interface
export interface UnifiedSSEReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionStatus: ConnectionStatus;
  activeMethod: ConnectionMethod;
  reconnectAttempts: number;
  lastEvent: SSEEvent | null;
  error: string | null;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  sendMessage: (type: string, data: any, targetUserId?: string) => Promise<boolean>;
  
  // Method control
  forceSSE: () => void;
  forcePolling: () => void;
  enableAutoMode: () => void;
  
  // Utilities
  getConnectionInfo: () => {
    method: ConnectionMethod;
    status: ConnectionStatus;
    uptime: number;
    lastActivity: number;
  };
}

const DEFAULT_OPTIONS: Required<Omit<UnifiedSSEOptions, 'eventHandlers' | 'onEvent' | 'onConnect' | 'onDisconnect' | 'onError' | 'onStatusChange'>> = {
  enabled: true,
  endpoint: '/api/realtime/sse',
  clientType: 'web',
  role: 'user',
  maxReconnectAttempts: 10,
  reconnectInterval: 3000,
  exponentialBackoff: true,
  maxBackoffDelay: 30000,
  enablePollingFallback: true,
  pollingInterval: 10000,
  pollingEndpoint: '/api/realtime/polling',
  showToastNotifications: true,
  autoReconnect: true,
  debug: false
};

export function useUnifiedSSE(options: UnifiedSSEOptions = {}): UnifiedSSEReturn {
  const { data: session, status } = useSession();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [activeMethod, setActiveMethod] = useState<ConnectionMethod>('sse');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forcedMethod, setForcedMethod] = useState<ConnectionMethod | null>(null);
  const [sseFailureCount, setSseFailureCount] = useState(0);
  const [lastPollTime, setLastPollTime] = useState(0);
  
  // Refs for cleanup and state management
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnectRef = useRef(false);
  const mountedRef = useRef(true);
  const connectionStartTime = useRef<number>(0);
  const lastActivityTime = useRef<number>(0);
  
  // Debug logging
  const log = useCallback((...args: any[]) => {
    if (opts.debug) {
      console.log('[UnifiedSSE]', ...args);
    }
  }, [opts.debug]);
  
  // Update connection status and notify
  const updateStatus = useCallback((status: ConnectionStatus, method: ConnectionMethod = activeMethod) => {
    setConnectionStatus(status);
    setActiveMethod(method);
    options.onStatusChange?.(status, method);
    log('Status changed:', { status, method });
  }, [activeMethod, options, log]);
  
  // Cleanup function
  const cleanup = useCallback(() => {
    log('Cleaning up connections');
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    updateStatus('disconnected');
  }, [log, updateStatus]);
  
  // Handle incoming events
  const handleEvent = useCallback((event: SSEEvent) => {
    lastActivityTime.current = Date.now();
    setLastEvent(event);
    
    log('Event received:', event);
    
    // Call global event handler
    options.onEvent?.(event);
    
    // Call specific event handlers
    if (options.eventHandlers && event.type in options.eventHandlers) {
      const handler = options.eventHandlers[event.type];
      if (typeof handler === 'function') {
        handler(event.data);
      }
    }
    
    // Handle built-in event types
    switch (event.type) {
      case 'notification':
        if (opts.showToastNotifications && event.data?.message) {
          if (event.data.showToast !== false) {
            toast.success(event.data.message);
          }
        }
        break;
      case 'error':
        if (opts.showToastNotifications) {
          toast.error(event.data?.message || 'An error occurred');
        }
        break;
    }
    
    // Dispatch DOM events for global listening
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`sse-${event.type}`, {
        detail: event,
        bubbles: true,
        cancelable: true
      }));
      
      window.dispatchEvent(new CustomEvent('sse-event', {
        detail: event,
        bubbles: true,
        cancelable: true
      }));
    }
  }, [options, opts.showToastNotifications, log]);
  
  // SSE Connection
  const connectSSE = useCallback(() => {
    if (!opts.enabled || status !== 'authenticated' || !session?.user || eventSourceRef.current) {
      return false;
    }
    
    log('Connecting via SSE');
    setIsConnecting(true);
    updateStatus('connecting', 'sse');
    
    try {
      const url = new URL(opts.endpoint, window.location.origin);
      url.searchParams.set('clientType', opts.clientType);
      url.searchParams.set('role', opts.role);
      
      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;
      connectionStartTime.current = Date.now();
      
      eventSource.onopen = () => {
        if (!mountedRef.current) return;
        
        log('SSE connected');
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempts(0);
        setSseFailureCount(0);
        setError(null);
        updateStatus('connected', 'sse');
        options.onConnect?.();
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const sseEvent: SSEEvent = {
            type: event.type || 'message',
            data,
            timestamp: new Date().toISOString(),
            id: event.lastEventId
          };
          handleEvent(sseEvent);
        } catch (error) {
          log('Error parsing SSE message:', error);
        }
      };
      
      // Handle specific event types
      ['connected', 'heartbeat', 'ping', 'notification', 'report-update'].forEach(eventType => {
        eventSource.addEventListener(eventType, (event) => {
          try {
            const data = JSON.parse(event.data);
            const sseEvent: SSEEvent = {
              type: eventType,
              data,
              timestamp: new Date().toISOString(),
              id: event.lastEventId
            };
            
            if (eventType !== 'heartbeat' && eventType !== 'ping') {
              handleEvent(sseEvent);
            } else {
              lastActivityTime.current = Date.now();
            }
          } catch (error) {
            log(`Error parsing ${eventType} event:`, error);
          }
        });
      });
      
      eventSource.onerror = (error) => {
        log('SSE error:', error);
        
        setIsConnected(false);
        setIsConnecting(false);
        setSseFailureCount(prev => prev + 1);
        
        const errorMessage = 'SSE connection error';
        setError(errorMessage);
        updateStatus('error', 'sse');
        options.onError?.(error);
        
        eventSource.close();
        eventSourceRef.current = null;
        
        // Attempt reconnection or fallback
        if (!isManualDisconnectRef.current && opts.autoReconnect) {
          if (reconnectAttempts < opts.maxReconnectAttempts) {
            const nextAttempt = reconnectAttempts + 1;
            setReconnectAttempts(nextAttempt);
            
            let delay = opts.reconnectInterval;
            if (opts.exponentialBackoff) {
              delay = Math.min(opts.reconnectInterval * Math.pow(2, nextAttempt - 1), opts.maxBackoffDelay);
            }
            
            log(`Reconnecting in ${delay}ms (attempt ${nextAttempt}/${opts.maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (!isManualDisconnectRef.current && mountedRef.current) {
                connect();
              }
            }, delay);
          } else if (opts.enablePollingFallback && sseFailureCount >= 3) {
            log('Max SSE attempts reached, falling back to polling');
            setActiveMethod('polling');
            startPolling();
          } else {
            log('Max reconnection attempts reached');
            updateStatus('error');
            if (opts.showToastNotifications) {
              toast.error('Connection lost. Please refresh the page.');
            }
          }
        }
      };
      
      return true;
    } catch (error) {
      log('Error creating SSE connection:', error);
      setIsConnecting(false);
      updateStatus('error', 'sse');
      options.onError?.(error as Error);
      return false;
    }
  }, [opts, status, session, reconnectAttempts, sseFailureCount, options, log, updateStatus, handleEvent]);
  
  // Polling fallback
  const startPolling = useCallback(() => {
    if (!opts.enablePollingFallback || !opts.enabled || status !== 'authenticated' || !session?.user) {
      return;
    }
    
    log('Starting polling fallback');
    updateStatus('connecting', 'polling');
    
    const poll = async () => {
      try {
        const url = new URL(opts.pollingEndpoint, window.location.origin);
        url.searchParams.set('since', lastPollTime.toString());
        url.searchParams.set('userId', session.user.id!);
        url.searchParams.set('role', session.user.role || 'USER');
        url.searchParams.set('_t', Date.now().toString());
        
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const events = await response.json();
        
        if (Array.isArray(events) && events.length > 0) {
          events.forEach(event => handleEvent(event));
          setLastPollTime(Date.now());
        }
        
        if (!isConnected) {
          setIsConnected(true);
          updateStatus('connected', 'polling');
          options.onConnect?.();
        }
        
        setError(null);
      } catch (error) {
        log('Polling error:', error);
        setError('Polling connection error');
        updateStatus('error', 'polling');
        options.onError?.(error as Error);
      }
    };
    
    // Initial poll
    poll();
    
    // Set up polling interval
    pollingIntervalRef.current = setInterval(poll, opts.pollingInterval);
  }, [opts, status, session, lastPollTime, isConnected, options, log, updateStatus, handleEvent]);
  
  // Main connect function
  const connect = useCallback(() => {
    if (!mountedRef.current || isManualDisconnectRef.current) return;
    
    cleanup();
    isManualDisconnectRef.current = false;
    
    const shouldUseSSE = forcedMethod === 'sse' || (forcedMethod !== 'polling' && sseFailureCount < 3);
    
    if (shouldUseSSE) {
      const sseSuccess = connectSSE();
      if (!sseSuccess && opts.enablePollingFallback) {
        log('SSE failed, falling back to polling');
        setActiveMethod('polling');
        startPolling();
      }
    } else {
      setActiveMethod('polling');
      startPolling();
    }
  }, [cleanup, forcedMethod, sseFailureCount, connectSSE, opts.enablePollingFallback, startPolling, log]);
  
  // Disconnect function
  const disconnect = useCallback(() => {
    log('Disconnecting');
    isManualDisconnectRef.current = true;
    cleanup();
    options.onDisconnect?.();
  }, [cleanup, options, log]);
  
  // Reconnect function
  const reconnect = useCallback(() => {
    log('Manual reconnect triggered');
    setReconnectAttempts(0);
    setSseFailureCount(0);
    connect();
  }, [connect, log]);
  
  // Send message function
  const sendMessage = useCallback(async (type: string, data: any, targetUserId?: string): Promise<boolean> => {
    try {
      const response = await fetch(opts.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data, event: type, targetUserId })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      log('Message sent successfully:', result);
      return true;
    } catch (error) {
      log('Error sending message:', error);
      if (opts.showToastNotifications) {
        toast.error('Failed to send message');
      }
      return false;
    }
  }, [opts.endpoint, opts.showToastNotifications, log]);
  
  // Method control functions
  const forceSSE = useCallback(() => {
    log('Forcing SSE mode');
    setForcedMethod('sse');
    setSseFailureCount(0);
    reconnect();
  }, [reconnect, log]);
  
  const forcePolling = useCallback(() => {
    log('Forcing polling mode');
    setForcedMethod('polling');
    reconnect();
  }, [reconnect, log]);
  
  const enableAutoMode = useCallback(() => {
    log('Enabling auto mode');
    setForcedMethod(null);
    reconnect();
  }, [reconnect, log]);
  
  // Get connection info
  const getConnectionInfo = useCallback(() => {
    return {
      method: activeMethod,
      status: connectionStatus,
      uptime: connectionStartTime.current ? Date.now() - connectionStartTime.current : 0,
      lastActivity: lastActivityTime.current
    };
  }, [activeMethod, connectionStatus]);
  
  // Auto-connect when session is ready
  useEffect(() => {
    if (opts.enabled && status === 'authenticated' && session?.user) {
      connect();
    }
  }, [opts.enabled, status, session, connect]);
  
  // Handle session changes
  useEffect(() => {
    if (status === 'unauthenticated') {
      disconnect();
    }
  }, [status, disconnect]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);
  
  return {
    // Connection state
    isConnected,
    isConnecting,
    connectionStatus,
    activeMethod,
    reconnectAttempts,
    lastEvent,
    error,
    
    // Actions
    connect,
    disconnect,
    reconnect,
    sendMessage,
    
    // Method control
    forceSSE,
    forcePolling,
    enableAutoMode,
    
    // Utilities
    getConnectionInfo
  };
}