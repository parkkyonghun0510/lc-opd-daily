'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

export interface SSEEvent {
  type: string;
  data: any;
  timestamp?: string;
}

export interface UseEventSourceOptions {
  enabled?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onEvent?: (event: SSEEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  clientType?: string;
  role?: string;
}

export interface UseEventSourceReturn {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastEvent: SSEEvent | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (type: string, data: any, targetUserId?: string) => Promise<boolean>;
}

const DEFAULT_OPTIONS: Required<Omit<UseEventSourceOptions, 'onEvent' | 'onConnect' | 'onDisconnect' | 'onError'>> = {
  enabled: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  clientType: 'web',
  role: 'user'
};

export function useEventSource(options: UseEventSourceOptions = {}): UseEventSourceReturn {
  const { data: session, status } = useSession();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualDisconnectRef = useRef(false);

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    setReconnectAttempts(0);
    
    options.onDisconnect?.();
  }, [options]);

  const connect = useCallback(() => {
    // Don't connect if disabled, not authenticated, or already connected
    if (!opts.enabled || status !== 'authenticated' || !session?.user || eventSourceRef.current) {
      return;
    }

    isManualDisconnectRef.current = false;
    setIsConnecting(true);

    try {
      // Build SSE URL with query parameters
      const url = new URL('/api/realtime/sse', window.location.origin);
      url.searchParams.set('clientType', opts.clientType);
      url.searchParams.set('role', opts.role);

      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;

      // Handle successful connection
      eventSource.onopen = () => {
        console.log('[SSE] Connected to server');
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempts(0);
        options.onConnect?.();
      };

      // Handle incoming messages
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const sseEvent: SSEEvent = {
            type: event.type || 'message',
            data,
            timestamp: new Date().toISOString()
          };
          
          setLastEvent(sseEvent);
          options.onEvent?.(sseEvent);
        } catch (error) {
          console.error('[SSE] Error parsing message:', error);
        }
      };

      // Handle specific event types
      eventSource.addEventListener('connected', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[SSE] Connection established:', data);
          
          const sseEvent: SSEEvent = {
            type: 'connected',
            data,
            timestamp: new Date().toISOString()
          };
          
          setLastEvent(sseEvent);
          options.onEvent?.(sseEvent);
        } catch (error) {
          console.error('[SSE] Error parsing connected event:', error);
        }
      });

      eventSource.addEventListener('heartbeat', (event) => {
        // Update last activity but don't trigger onEvent for heartbeats
        console.debug('[SSE] Heartbeat received');
      });

      eventSource.addEventListener('notification', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          const sseEvent: SSEEvent = {
            type: 'notification',
            data,
            timestamp: new Date().toISOString()
          };
          
          setLastEvent(sseEvent);
          options.onEvent?.(sseEvent);
          
          // Show toast notification if it's a user-facing message
          if (data.showToast && data.message) {
            toast.success(data.message);
          }
        } catch (error) {
          console.error('[SSE] Error parsing notification event:', error);
        }
      });

      // Handle errors and reconnection
      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        
        setIsConnected(false);
        setIsConnecting(false);
        
        options.onError?.(error);
        
        // Close the current connection
        eventSource.close();
        eventSourceRef.current = null;
        
        // Attempt reconnection if not manually disconnected
        if (!isManualDisconnectRef.current && reconnectAttempts < opts.maxReconnectAttempts) {
          const nextAttempt = reconnectAttempts + 1;
          setReconnectAttempts(nextAttempt);
          
          const delay = Math.min(opts.reconnectInterval * Math.pow(2, nextAttempt - 1), 30000);
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${nextAttempt}/${opts.maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isManualDisconnectRef.current) {
              connect();
            }
          }, delay);
        } else if (reconnectAttempts >= opts.maxReconnectAttempts) {
          console.error('[SSE] Max reconnection attempts reached');
          toast.error('Connection lost. Please refresh the page.');
        }
      };
    } catch (error) {
      console.error('[SSE] Error creating EventSource:', error);
      setIsConnecting(false);
      options.onError?.(error as Event);
    }
  }, [session, status, opts, reconnectAttempts, options]);

  // Send message via POST to SSE endpoint
  const sendMessage = useCallback(async (type: string, data: any, targetUserId?: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/realtime/sse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          data,
          event: type,
          targetUserId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[SSE] Message sent successfully:', result);
      return true;
    } catch (error) {
      console.error('[SSE] Error sending message:', error);
      toast.error('Failed to send message');
      return false;
    }
  }, []);

  // Auto-connect when session is ready
  useEffect(() => {
    if (opts.enabled && status === 'authenticated' && session?.user && !eventSourceRef.current) {
      connect();
    }
  }, [opts.enabled, status, session, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Handle session changes
  useEffect(() => {
    if (status === 'unauthenticated' && eventSourceRef.current) {
      disconnect();
    }
  }, [status, disconnect]);

  return {
    isConnected,
    isConnecting,
    reconnectAttempts,
    lastEvent,
    connect,
    disconnect,
    sendMessage
  };
}