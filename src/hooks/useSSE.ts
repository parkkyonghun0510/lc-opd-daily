'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSSE as useSSEStore } from '@/auth/store';
import { SSEOptions, SSEEventType, SSEEvent } from '@/auth/store/slices/sseSlice';
import { useAuth } from '@/auth/store';

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
    isConnected,
    error,
    lastEvent,
    connect,
    disconnect,
    reconnect,
    setOptions
  } = useSSEStore();

  const { data: session, status } = useSession({
    required: false,
  });

  const { user, needsTokenRefresh, refreshToken } = useAuth();

  // Store options in a ref to avoid unnecessary re-renders
  const optionsRef = useRef(options);

  // Update options when they change
  useEffect(() => {
    if (JSON.stringify(optionsRef.current) !== JSON.stringify(options)) {
      optionsRef.current = options;
      setOptions(options);
    }
  }, [options, setOptions]);

  // Connect when the component mounts or session changes
  useEffect(() => {
    // Don't connect if not authenticated
    if (status !== 'authenticated' || !session?.user?.id) {
      return;
    }

    // Add user ID to client metadata
    const updatedOptions = {
      ...optionsRef.current,
      clientMetadata: {
        ...optionsRef.current.clientMetadata,
        userId: session.user.id
      }
    };

    // Connect with the updated options
    connect(updatedOptions);

    // Disconnect when the component unmounts
    return () => {
      disconnect();
    };
  }, [session?.user?.id, status, connect, disconnect]);

  // Separate effect for token refresh to avoid dependency cycles
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      return;
    }

    // Initial check
    if (needsTokenRefresh()) {
      refreshToken().catch(err => {
        console.error('Error refreshing token:', err);
      });
    }

    // Set up periodic token refresh check
    const tokenCheckInterval = setInterval(() => {
      if (needsTokenRefresh()) {
        refreshToken().catch(err => {
          console.error('Error refreshing token:', err);
        });
      }
    }, 60000); // Check every minute

    return () => clearInterval(tokenCheckInterval);
  }, [session?.user?.id, status, refreshToken]);

  return {
    isConnected,
    error,
    lastEvent,
    reconnect,
    closeConnection: disconnect
  };
}

export default useSSE;
