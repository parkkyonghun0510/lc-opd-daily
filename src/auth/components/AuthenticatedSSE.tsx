"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/auth/hooks/useAuth";
import { useHybridRealtime, EventHandlersMap } from "@/hooks/useHybridRealtime";

interface AuthenticatedSSEProps {
  eventHandlers: EventHandlersMap;
  debug?: boolean;
}

/**
 * AuthenticatedSSE component
 *
 * Provides authenticated polling connections that stay in sync with the auth store.
 * This is a simplified version that uses polling instead of SSE to avoid conflicts.
 */
export function AuthenticatedSSE({
  eventHandlers,
  debug = false,
}: AuthenticatedSSEProps) {
  const { user, isAuthenticated } = useAuth();
  const lastUserIdRef = useRef<string | null>(null);

  // Use the simplified realtime hook
  const { isConnected, activeMethod, reconnect } = useHybridRealtime({
    eventHandlers,
    debug,
  });

  // Reconnect when user changes
  useEffect(() => {
    if (user?.id !== lastUserIdRef.current) {
      lastUserIdRef.current = user?.id || null;
      reconnect();
    }
  }, [user?.id, reconnect]);

  // Debug logging
  useEffect(() => {
    if (debug) {
      console.log(
        `[AuthenticatedSSE] Connection status: ${isConnected ? "connected" : "disconnected"}`,
      );
      console.log(
        `[AuthenticatedSSE] Active method: ${activeMethod || "none"}`,
      );
    }
  }, [isConnected, activeMethod, debug]);

  // This component doesn't render anything
  return null;
}
