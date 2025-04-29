'use client';

import { useHybridRealtime, HybridRealtimeOptions as SSEOptions } from '@/hooks/useHybridRealtime';

/**
 * DEPRECATED: Use useHybridRealtime from @/auth/store directly instead.
 *
 * This hook is a simple wrapper around useHybridRealtime for backward compatibility.
 * It will be removed in a future version.
 *
 * @example
 * ```tsx
 * // Old way (deprecated)
 * const { lastEvent, isConnected, error } = useSSE({
 *   eventHandlers: {
 *     notification: (data) => {
 *       toast({ title: data.title, description: data.body });
 *     }
 *   }
 * });
 *
 * // New way (recommended)
 * const { lastEvent, isConnected, error } = useHybridRealtime({
 *   eventHandlers: {
 *     notification: (data) => {
 *       toast({ title: data.title, description: data.body });
 *     }
 *   }
 * });
 * ```
 */
export function useSSE(options: SSEOptions = {}) {
  // Simply forward to the Zustand hybrid realtime hook
  const {
    isConnected,
    error,
    lastEvent,
    reconnect,
    disconnect
  } = useHybridRealtime(options);

  return {
    isConnected,
    error,
    lastEvent,
    reconnect,
    closeConnection: disconnect
  };
}

export default useSSE;
