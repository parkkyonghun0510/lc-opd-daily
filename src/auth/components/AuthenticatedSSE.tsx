'use client';

import { useEffect, useRef } from 'react';
import { useStore } from '@/auth/store';
import { useHybridRealtime } from '@/hooks/useHybridRealtime';

interface AuthenticatedSSEProps {
  eventHandlers: Record<string, (data: any) => void>;
  preferredMethod?: 'sse' | 'polling' | 'auto';
  debug?: boolean;
}

/**
 * AuthenticatedSSE component
 *
 * Provides authenticated SSE connections that stay in sync with the auth store.
 * Handles token refresh and reconnection when authentication state changes.
 */
export function AuthenticatedSSE({
  eventHandlers,
  preferredMethod = 'auto',
  debug = false
}: AuthenticatedSSEProps) {
  const { user, isAuthenticated, needsTokenRefresh, refreshAuthToken } = useStore();
  const lastUserIdRef = useRef<string | null>(null);
  
  // Use the hybrid realtime hook
  const {
    isConnected,
    activeMethod,
    reconnect
  } = useHybridRealtime({
    eventHandlers,
    preferredMethod,
    debug
  });
  
  // Reconnect when user changes
  useEffect(() => {
    if (user?.id !== lastUserIdRef.current) {
      lastUserIdRef.current = user?.id || null;
      reconnect();
    }
  }, [user?.id, reconnect]);
  
  // Check for token refresh needs
  useEffect(() => {
    if (isAuthenticated && needsTokenRefresh()) {
      refreshAuthToken().then(() => {
        // Reconnect after token refresh
        reconnect();
      });
    }
  }, [isAuthenticated, needsTokenRefresh, refreshAuthToken, reconnect]);
  
  // This component doesn't render anything
  return null;
}
