'use client';

import { ReactNode, useEffect, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useHybridRealtime, EventHandlersMap, EventType, HybridRealtimeOptions } from '@/hooks/useHybridRealtime';
import { toast } from 'sonner';

interface HybridRealtimeProviderProps {
  children: ReactNode;
  options?: Partial<HybridRealtimeOptions>;
  onEvent?: (eventType: EventType, data: any) => void;
  autoReconnect?: boolean;
  showToasts?: boolean;
  debug?: boolean;
}

/**
 * Simplified provider component for realtime updates
 *
 * This component initializes the realtime connection using polling and handles
 * reconnection and event processing. This is a simplified version that avoids
 * conflicts with Zustand state management.
 *
 * @example
 * ```tsx
 * <HybridRealtimeProvider
 *   options={{
 *     pollingInterval: 15000
 *   }}
 *   onEvent={(type, data) => console.log(`Received ${type} event:`, data)}
 *   showToasts={true}
 *   debug={process.env.NODE_ENV === 'development'}
 * >
 *   <App />
 * </HybridRealtimeProvider>
 * ```
 */
export function HybridRealtimeProvider({
  children,
  options = {},
  onEvent,
  autoReconnect = true,
  showToasts = true,
  debug = false
}: HybridRealtimeProviderProps) {
  // Get auth state
  const { user, isAuthenticated } = useAuth();

  // Create default event handlers
  const createDefaultHandlers = (): EventHandlersMap => ({
    notification: (data: any) => {
      // Show toast notification if enabled
      if (showToasts) {
        toast.info(data.title || 'New notification', {
          description: data.message || data.body || 'You have a new notification',
        });
      }

      // Call onEvent callback if provided
      if (onEvent) {
        onEvent('notification', data);
      }
    },

    dashboardUpdate: (data: any) => {
      // Show toast notification if enabled
      if (showToasts) {
        toast.info('Dashboard updated', {
          description: 'New data is available',
        });
      }

      // Call onEvent callback if provided
      if (onEvent) {
        onEvent('dashboardUpdate', data);
      }
    },

    systemAlert: (data: any) => {
      // Show toast notification if enabled
      if (showToasts) {
        toast.warning(data.title || 'System alert', {
          description: data.message || data.body || 'System alert received',
        });
      }

      // Call onEvent callback if provided
      if (onEvent) {
        onEvent('systemAlert', data);
      }
    },

    // Wildcard handler for all events
    '*': (event: any) => {
      if (onEvent && event.type) {
        onEvent(event.type, event.data);
      }
    }
  });

  // Memoize event handlers to prevent unnecessary reconnections
  const defaultHandlers = useMemo(createDefaultHandlers, [showToasts, onEvent]);

  // Merge default handlers with custom handlers
  const eventHandlers = useMemo(() => {
    const customHandlers = options.eventHandlers || {};

    // Create a new object with default handlers
    const mergedHandlers: EventHandlersMap = { ...defaultHandlers };

    // Add or override with custom handlers
    Object.entries(customHandlers).forEach(([type, handler]) => {
      const eventType = type as EventType;

      // If there's a default handler, create a wrapper that calls both
      if (type in defaultHandlers) {
        mergedHandlers[eventType] = (data: any) => {
          // Call custom handler first
          (customHandlers as any)[eventType]?.(data);

          // Then call default handler
          (defaultHandlers as any)[eventType]?.(data);
        };
      } else {
        // Otherwise just use the custom handler
        mergedHandlers[eventType] = handler;
      }
    });

    return mergedHandlers;
  }, [options.eventHandlers, defaultHandlers]);

  // Use the simplified realtime hook
  const {
    isConnected,
    activeMethod,
    reconnect
  } = useHybridRealtime({
    pollingInterval: options.pollingInterval || 10000,
    eventHandlers,
    debug: debug || options.debug,
    clientMetadata: {
      ...(options.clientMetadata || {}),
      userId: user?.id,
      role: user?.role || 'user',
      provider: 'HybridRealtimeProvider'
    }
  });

  // Set up reconnection on window focus
  useEffect(() => {
    if (!autoReconnect || !isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        if (debug) {
          console.log('[HybridRealtimeProvider] Document became visible, reconnecting');
        }
        reconnect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoReconnect, isAuthenticated, isConnected, reconnect, debug]);

  // Log connection status changes in debug mode
  useEffect(() => {
    if (debug) {
      console.log(`[HybridRealtimeProvider] Connection status: ${isConnected ? 'connected' : 'disconnected'}`);
      console.log(`[HybridRealtimeProvider] Active method: ${activeMethod || 'none'}`);
    }
  }, [isConnected, activeMethod, debug]);

  return <>{children}</>;
}
