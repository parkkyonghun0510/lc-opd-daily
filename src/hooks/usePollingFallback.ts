'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Polling fallback for browsers that don't support SSE
 *
 * This hook provides a fallback mechanism for real-time updates
 * using polling instead of SSE.
 */
export function usePollingFallback(options: {
  endpoint: string;
  interval?: number;
  onUpdate?: (data: any) => void;
  enabled?: boolean;
}) {
  const {
    endpoint,
    interval = 10000, // Default to 10 seconds
    onUpdate,
    enabled = true
  } = options;

  const { data: session } = useSession();
  const [lastUpdate, setLastUpdate] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to track polling state
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // We no longer need to check if SSE is supported here
  // as it's now handled in the parent hook

  // Fetch updates
  const fetchUpdates = useCallback(async () => {
    // Don't fetch if not enabled
    if (!enabled) {
      return;
    }

    // Don't fetch if not authenticated
    if (!session?.user?.id) {
      return;
    }

    // Create a new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      setIsPolling(true);
      setError(null);

      // Add a timestamp to prevent caching
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.append('_t', Date.now().toString());
      url.searchParams.append('userId', session.user.id);

      // Fetch updates
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Error fetching updates: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Update state
      setLastUpdate(data);

      // Call the update handler
      if (onUpdate) {
        onUpdate(data);
      }
    } catch (err) {
      // Ignore aborted requests
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      console.error('Error polling for updates:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsPolling(false);
    }
  }, [endpoint, enabled, session, onUpdate]);

  // Set up polling
  useEffect(() => {
    // SSE support is now handled in the parent hook via the enabled prop

    // Don't set up polling if not enabled
    if (!enabled) {
      return;
    }

    // Don't set up polling if not authenticated
    if (!session?.user?.id) {
      return;
    }

    // Initial fetch
    fetchUpdates();

    // Set up interval
    intervalRef.current = setInterval(fetchUpdates, interval);

    // Clean up
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [fetchUpdates, interval, enabled, session]);

  return {
    lastUpdate,
    isPolling,
    error,
    refresh: fetchUpdates
  };
}
